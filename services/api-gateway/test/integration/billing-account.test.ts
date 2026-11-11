import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '../../src/db';
import { Client, sendStripeEvent, startGateway, subscription, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startGateway(); });
afterAll(async () => { await h.close(); });

const PRO = 'price_pro_monthly';
const TEAM = 'price_team_yearly';
const now = () => Math.floor(Date.now() / 1000);

async function plan(c: Client) {
  return (await c.req('/api/auth/me')).json.user;
}

describe('Stripe webhooks', () => {
  it('rejects unsigned or wrongly signed events', async () => {
    const forged = await fetch(`${h.base}/api/billing/webhook`, {
      method: 'POST', body: '{"id":"evt_x"}', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=00' },
    });
    expect(forged.status).toBe(400);
    const wrongSecret = await sendStripeEvent(h.base, 'customer.subscription.created', {}, { secret: 'whsec_wrong' });
    expect(wrongSecret.status).toBe(400);
  });

  it('runs the subscription lifecycle: active → past_due (kept) → canceled (free)', async () => {
    const c = new Client(h.base);
    const userId = await c.signIn('subscriber@example.com');

    await sendStripeEvent(h.base, 'checkout.session.completed', { id: 'cs_1', object: 'checkout.session', client_reference_id: userId, customer: `cus_${userId.slice(0, 8)}` });
    expect((await plan(c)).hasBillingAccount).toBe(true);

    const t = now();
    await sendStripeEvent(h.base, 'customer.subscription.created', subscription(userId, 'active', PRO), { created: t });
    expect(await plan(c)).toMatchObject({ plan: 'pro', planStatus: 'active' });

    await sendStripeEvent(h.base, 'customer.subscription.updated', subscription(userId, 'past_due', PRO), { created: t + 1 });
    expect(await plan(c)).toMatchObject({ plan: 'pro', planStatus: 'past_due' });

    await sendStripeEvent(h.base, 'customer.subscription.deleted', subscription(userId, 'canceled', PRO), { created: t + 2 });
    expect((await plan(c)).plan).toBe('free');
  });

  it('is idempotent and ignores out-of-order (older) events', async () => {
    const c = new Client(h.base);
    const userId = await c.signIn('ordering@example.com');
    const t = now();
    const created = await sendStripeEvent(h.base, 'customer.subscription.created', subscription(userId, 'active', TEAM, { id: 'sub_order' }), { created: t });
    expect((await plan(c)).plan).toBe('team');

    const replay = await fetch(`${h.base}/api/billing/webhook`, { method: 'POST', body: created.payload, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': created.header } });
    expect((await replay.json()).outcome).toBe('duplicate');

    await sendStripeEvent(h.base, 'customer.subscription.updated', subscription(userId, 'canceled', TEAM, { id: 'sub_order' }), { created: t - 600 });
    expect((await plan(c)).plan).toBe('team');
  });

  it('links subscriptions to users by customer id when metadata is missing', async () => {
    const c = new Client(h.base);
    const userId = await c.signIn('by-customer@example.com');
    await query(`UPDATE users SET stripe_customer_id = 'cus_lookup' WHERE id = $1`, [userId]);
    const sub = { ...subscription(userId, 'active', PRO, { id: 'sub_lookup', customer: 'cus_lookup' }), metadata: {} };
    await sendStripeEvent(h.base, 'customer.subscription.created', sub);
    expect((await plan(c)).plan).toBe('pro');
  });

  it('does not crash (or retry forever) when a customer id belongs to another user', async () => {
    const a = new Client(h.base);
    const aId = await a.signIn('customer-a@example.com');
    await query(`UPDATE users SET stripe_customer_id = 'cus_shared' WHERE id = $1`, [aId]);
    const b = new Client(h.base);
    const bId = await b.signIn('customer-b@example.com');
    const r = await sendStripeEvent(h.base, 'customer.subscription.created', subscription(bId, 'active', PRO, { id: 'sub_shared', customer: 'cus_shared' }));
    expect(r.status).toBe(200);
    const done = await sendStripeEvent(h.base, 'checkout.session.completed', { id: 'cs_2', object: 'checkout.session', client_reference_id: bId, customer: 'cus_shared' });
    expect(done.status).toBe(200);
    const [row] = await query<{ stripe_customer_id: string | null }>('SELECT stripe_customer_id FROM users WHERE id = $1', [bId]);
    expect(row.stripe_customer_id).toBeNull(); // not stolen from user A
  });

  it('ignores subscriptions with prices that are not ours', async () => {
    const c = new Client(h.base);
    const userId = await c.signIn('unknown-price@example.com');
    const r = await sendStripeEvent(h.base, 'customer.subscription.created', subscription(userId, 'active', 'price_someone_else', { id: 'sub_foreign' }));
    expect(r.status).toBe(200);
    expect((await plan(c)).plan).toBe('free');
  });

  it('checkout and portal report BILLING_DISABLED without a Stripe key', async () => {
    const c = new Client(h.base);
    await c.signIn('nobilling@example.com');
    const r = await c.req('/api/billing/checkout', { body: { plan: 'pro', interval: 'year' } });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe('BILLING_DISABLED');
  });
});

describe('account & GDPR', () => {
  it('requires sign-in', async () => {
    expect((await new Client(h.base).req('/api/account')).status).toBe(401);
  });

  it('exports account data and erases everything on deletion', async () => {
    const c = new Client(h.base);
    const userId = await c.signIn('gdpr@example.com');
    await sendStripeEvent(h.base, 'customer.subscription.created', subscription(userId, 'canceled', PRO, { id: 'sub_gdpr' }));

    const exp = await c.req('/api/account/export');
    expect(exp.status).toBe(200);
    expect(exp.headers.get('content-disposition')).toContain('eyeshots-account-export.json');
    expect(exp.json.user.email).toBe('gdpr@example.com');
    expect(exp.json.subscriptions).toHaveLength(1);

    expect((await c.req('/api/account', { method: 'DELETE', body: {} })).status).toBe(400);
    const del = await c.req('/api/account', { method: 'DELETE', body: { confirm: 'DELETE' } });
    expect(del.status).toBe(200);

    const [left] = await query<Record<string, string>>(
      `SELECT (SELECT count(*) FROM users WHERE id = $1) u, (SELECT count(*) FROM sessions WHERE user_id = $1) s,
              (SELECT count(*) FROM subscriptions WHERE user_id = $1) sb, (SELECT count(*) FROM usage_daily WHERE subject = $2) us`,
      [userId, `user:${userId}`],
    );
    expect(Object.values(left).map(Number)).toEqual([0, 0, 0, 0]);
    expect((await c.req('/api/auth/me')).status).toBe(401);
  });
});
