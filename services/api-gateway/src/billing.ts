import express, { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { config } from './config';
import { dbEnabled, one, query, tx } from './db';
import { getUser, requireUser } from './auth';
import { betterPlan, ENTITLED_STATUSES, planForPrice, priceFor, type PlanId } from './plans';

/**
 * Stripe billing
 * --------------
 *   POST /api/billing/checkout  { plan, interval }  → { url }   (Stripe Checkout)
 *   POST /api/billing/portal                        → { url }   (Customer Portal: cancel, change card, invoices)
 *   POST /api/billing/webhook   (Stripe → us, signature-verified, raw body)
 *
 * The webhook is the single source of truth for entitlements: the redirect
 * back from Checkout is never trusted. Events are processed idempotently and
 * out-of-order safe (older events never overwrite newer subscription state).
 */

let stripe: Stripe | null = null;
export function billingEnabled(): boolean {
  return Boolean(config.STRIPE_SECRET_KEY) && dbEnabled();
}
function getStripe(): Stripe {
  if (!stripe) stripe = new Stripe(config.STRIPE_SECRET_KEY!, { appInfo: { name: 'EyeShots' } });
  return stripe;
}

/** Recomputes users.plan from all of the user's subscriptions. */
async function syncUserPlan(c: PoolClient, userId: string) {
  const subs = (await c.query<{ status: string; plan: PlanId; current_period_end: Date | null; cancel_at_period_end: boolean }>(
    `SELECT status, plan, current_period_end, cancel_at_period_end FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  )).rows;
  const entitled = subs.filter((s) => ENTITLED_STATUSES.has(s.status));
  const plan = entitled.reduce<PlanId>((p, s) => betterPlan(p, s.plan), 'free');
  const primary = entitled.find((s) => s.plan === plan) ?? subs[0];
  await c.query(
    `UPDATE users SET plan = $2, plan_status = $3, current_period_end = $4, cancel_at_period_end = $5 WHERE id = $1`,
    [userId, plan, primary?.status ?? null, primary?.current_period_end ?? null, primary?.cancel_at_period_end ?? false],
  );
  return plan;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Since API 2025-03 the period lives on subscription items.
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const ts = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

async function handleSubscription(c: PoolClient, sub: Stripe.Subscription, eventCreated: number) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId = sub.metadata?.userId;
  if (!userId) {
    userId = (await c.query<{ id: string }>(`SELECT id FROM users WHERE stripe_customer_id = $1`, [customerId])).rows[0]?.id;
  }
  if (!userId) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'subscription for unknown customer', subscription: sub.id, customer: customerId }));
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = planForPrice(priceId);
  if (!plan) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'subscription with unmapped price', subscription: sub.id, priceId }));
    return;
  }
  // Make sure the customer is linked (events can arrive before checkout.session.completed).
  await c.query(
    `UPDATE users SET stripe_customer_id = $2
      WHERE id = $1 AND stripe_customer_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM users WHERE stripe_customer_id = $2)`,
    [userId, customerId],
  );
  // Upsert, but never let an older event overwrite newer state.
  await c.query(
    `INSERT INTO subscriptions (id, user_id, status, price_id, plan, current_period_end, cancel_at_period_end, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8))
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, price_id = EXCLUDED.price_id, plan = EXCLUDED.plan,
       current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = EXCLUDED.updated_at
     WHERE subscriptions.updated_at <= EXCLUDED.updated_at`,
    [sub.id, userId, sub.status, priceId, plan, periodEnd(sub), sub.cancel_at_period_end || Boolean(sub.cancel_at), eventCreated],
  );
  const effective = await syncUserPlan(c, userId);
  console.log(JSON.stringify({ level: 'info', msg: 'subscription synced', userId, subscription: sub.id, status: sub.status, plan: effective }));
}

export async function handleStripeEvent(event: Stripe.Event): Promise<'processed' | 'duplicate' | 'ignored'> {
  return tx(async (c) => {
    const fresh = await c.query(`INSERT INTO stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`, [event.id, event.type]);
    if (fresh.rowCount === 0) return 'duplicate';

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
        if (s.client_reference_id && customerId) {
          const linked = await c.query(
            `UPDATE users SET stripe_customer_id = $2
              WHERE id = $1 AND stripe_customer_id IS NULL
                AND NOT EXISTS (SELECT 1 FROM users WHERE stripe_customer_id = $2)`,
            [s.client_reference_id, customerId],
          );
          if (linked.rowCount === 0) {
            const owner = (await c.query<{ id: string }>(`SELECT id FROM users WHERE stripe_customer_id = $1`, [customerId])).rows[0];
            if (owner && owner.id !== s.client_reference_id) {
              console.warn(JSON.stringify({ level: 'warn', msg: 'checkout customer already linked to another user', customer: customerId }));
            }
          }
        }
        return 'processed';
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await handleSubscription(c, event.data.object as Stripe.Subscription, event.created);
        return 'processed';
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        // Stripe retries and emails the customer; the subscription moves to past_due via
        // customer.subscription.updated. Logged for support visibility.
        console.warn(JSON.stringify({ level: 'warn', msg: 'invoice payment failed', invoice: inv.id, customer: inv.customer }));
        return 'processed';
      }
      default:
        return 'ignored';
    }
  });
}

/** Webhook route — must be registered BEFORE express.json() (needs the raw body). */
export function webhookHandler() {
  return [
    express.raw({ type: 'application/json', limit: '1mb' }),
    async (req: Request, res: Response) => {
      if (!config.STRIPE_WEBHOOK_SECRET || !dbEnabled()) return res.status(503).json({ error: 'Billing not configured' });
      let event: Stripe.Event;
      try {
        // constructEvent only needs the secret, so a dummy API key is fine if checkout is off.
        const verifier = stripe ?? new Stripe(config.STRIPE_SECRET_KEY || 'sk_test_unused');
        event = verifier.webhooks.constructEvent(req.body as Buffer, String(req.headers['stripe-signature'] || ''), config.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.warn(JSON.stringify({ level: 'warn', msg: 'stripe webhook signature rejected', error: err?.message }));
        return res.status(400).json({ error: 'Invalid signature' });
      }
      try {
        const outcome = await handleStripeEvent(event);
        res.json({ received: true, outcome });
      } catch (err: any) {
        // 5xx makes Stripe retry; the idempotency row was rolled back with the transaction.
        console.error(JSON.stringify({ level: 'error', msg: 'stripe webhook failed', event: event.id, type: event.type, error: err?.message }));
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    },
  ];
}

export function createBillingRouter(): Router {
  const router = Router();

  router.use((_req, res, next) => {
    if (!billingEnabled()) return res.status(503).json({ error: 'Online payments are not available yet.', code: 'BILLING_DISABLED' });
    next();
  });

  async function ensureCustomer(userId: string, email: string, existing: string | null): Promise<string> {
    if (existing) return existing;
    const customer = await getStripe().customers.create({ email, metadata: { userId } }, { idempotencyKey: `customer-${userId}` });
    // Another request may have raced us; keep whichever id landed first.
    const row = await one<{ stripe_customer_id: string }>(
      `UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $2) WHERE id = $1 RETURNING stripe_customer_id`,
      [userId, customer.id],
    );
    return row!.stripe_customer_id;
  }

  router.post('/checkout', requireUser, async (req, res) => {
    const parsed = z.object({ plan: z.enum(['pro', 'team']), interval: z.enum(['month', 'year']).default('year') }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid plan' });
    const price = priceFor(parsed.data.plan, parsed.data.interval);
    if (!price) return res.status(503).json({ error: 'This plan is not available for purchase yet.', code: 'PRICE_NOT_CONFIGURED' });

    const user = getUser(req)!;
    const customer = await ensureCustomer(user.id, user.email, user.stripeCustomerId);

    // Already subscribed → send to the portal to change plan instead of double-billing.
    if (user.plan !== 'free' && user.planStatus && ENTITLED_STATUSES.has(user.planStatus)) {
      const portal = await getStripe().billingPortal.sessions.create({ customer, return_url: `${config.APP_URL}/account` });
      return res.json({ url: portal.url, alreadySubscribed: true });
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes: true,
      billing_address_collection: 'required', // needed for EU VAT
      ...(config.STRIPE_AUTOMATIC_TAX ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto' as const, name: 'auto' as const }, tax_id_collection: { enabled: true } } : {}),
      success_url: `${config.APP_URL}/account?checkout=success`,
      cancel_url: `${config.APP_URL}/pricing?checkout=cancelled`,
    });
    console.log(JSON.stringify({ level: 'info', msg: 'checkout started', userId: user.id, plan: parsed.data.plan, interval: parsed.data.interval }));
    res.json({ url: session.url });
  });

  router.post('/portal', requireUser, async (req, res) => {
    const user = getUser(req)!;
    if (!user.stripeCustomerId) return res.status(400).json({ error: 'No billing account yet.', code: 'NO_CUSTOMER' });
    const portal = await getStripe().billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${config.APP_URL}/account` });
    res.json({ url: portal.url });
  });

  return router;
}

/** Cancels active subscriptions immediately (used when an account is deleted). */
export async function cancelAllSubscriptions(userId: string): Promise<void> {
  if (!billingEnabled()) return;
  const subs = await query<{ id: string }>(`SELECT id FROM subscriptions WHERE user_id = $1 AND status NOT IN ('canceled', 'incomplete_expired')`, [userId]);
  for (const s of subs) await getStripe().subscriptions.cancel(s.id, { prorate: false });
}
