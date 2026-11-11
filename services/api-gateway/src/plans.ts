import { config } from './config';

export type PlanId = 'free' | 'pro' | 'team';
export type QuotaTier = 'anonymous' | PlanId;

export interface PlanLimits {
  /** Cloud (server-side) tasks per UTC day; null = unlimited. */
  cloudTasksPerDay: number | null;
  /** Per-file size limit in MB (also capped by the gateway's MAX_UPLOAD_MB). */
  maxFileMb: number;
}

/**
 * Quota table. Keep in sync with apps/web/lib/plans.ts (pricing page copy).
 * Browser-based tools are never metered — only server work costs money.
 */
export const PLAN_LIMITS: Record<QuotaTier, PlanLimits> = {
  anonymous: { cloudTasksPerDay: 3, maxFileMb: 100 },
  free: { cloudTasksPerDay: 3, maxFileMb: 100 },
  pro: { cloudTasksPerDay: null, maxFileMb: 1024 },
  team: { cloudTasksPerDay: null, maxFileMb: 1024 },
};

/** Effective file limit: plan limit, but never above what the gateway buffers (MAX_UPLOAD_MB). */
export function effectiveMaxFileMb(tier: QuotaTier): number {
  return Math.min(PLAN_LIMITS[tier].maxFileMb, config.MAX_UPLOAD_MB);
}

/** Stripe price id → plan. Unknown prices map to null (ignored, logged). */
export function planForPrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  if (priceId === config.STRIPE_PRICE_PRO_MONTHLY || priceId === config.STRIPE_PRICE_PRO_YEARLY) return 'pro';
  if (priceId === config.STRIPE_PRICE_TEAM_MONTHLY || priceId === config.STRIPE_PRICE_TEAM_YEARLY) return 'team';
  return null;
}

export function priceFor(plan: 'pro' | 'team', interval: 'month' | 'year'): string | undefined {
  if (plan === 'pro') return interval === 'year' ? config.STRIPE_PRICE_PRO_YEARLY : config.STRIPE_PRICE_PRO_MONTHLY;
  return interval === 'year' ? config.STRIPE_PRICE_TEAM_YEARLY : config.STRIPE_PRICE_TEAM_MONTHLY;
}

/** Subscription statuses that grant the paid plan. past_due keeps access during Stripe's retry window. */
export const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

const RANK: Record<PlanId, number> = { free: 0, pro: 1, team: 2 };
export const betterPlan = (a: PlanId, b: PlanId): PlanId => (RANK[a] >= RANK[b] ? a : b);
