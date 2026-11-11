import type { NextFunction, Request, Response } from 'express';
import { dbEnabled, one } from './db';
import { getUser, ipSubject } from './auth';
import { effectiveMaxFileMb, PLAN_LIMITS, type QuotaTier } from './plans';

/**
 * Per-plan metering of cloud tasks. Two middlewares:
 *  - quotaPrecheck: runs BEFORE the upload is buffered, so an over-quota user
 *    doesn't upload 100 MB just to be told no.
 *  - quotaConsume: runs AFTER validation; atomically increments today's counter
 *    and enforces per-plan file size.
 * When the database is not configured (local dev), metering is off.
 */

export function quotaContext(req: Request): { tier: QuotaTier; subject: string } {
  const u = getUser(req);
  return u ? { tier: u.plan, subject: `user:${u.id}` } : { tier: 'anonymous', subject: ipSubject(req) };
}

const TODAY = `(now() AT TIME ZONE 'utc')::date`;

export async function usageToday(subject: string): Promise<number> {
  const row = await one<{ cloud_tasks: number }>(`SELECT cloud_tasks FROM usage_daily WHERE subject = $1 AND day = ${TODAY}`, [subject]);
  return row?.cloud_tasks ?? 0;
}

function quotaExceeded(res: Response, tier: QuotaTier, limit: number) {
  return res.status(402).json({
    error: tier === 'anonymous'
      ? `You've used today's ${limit} free cloud tasks. Create a free account or upgrade to Pro for unlimited processing.`
      : `You've used today's ${limit} free cloud tasks. Upgrade to Pro for unlimited processing.`,
    code: 'QUOTA_EXCEEDED',
    limit,
    upgradeUrl: '/pricing',
  });
}

export async function quotaPrecheck(req: Request, res: Response, next: NextFunction) {
  if (!dbEnabled()) return next();
  try {
    const { tier, subject } = quotaContext(req);
    const limit = PLAN_LIMITS[tier].cloudTasksPerDay;
    // Cheap early rejection of uploads that are obviously too large for the plan.
    const declared = Number(req.headers['content-length'] || 0);
    const maxMb = effectiveMaxFileMb(tier);
    if (declared > (maxMb + 1) * 1024 * 1024 * 20) return res.status(413).json({ error: `Upload exceeds your plan's limit.`, code: 'FILE_TOO_LARGE' });
    if (limit !== null && (await usageToday(subject)) >= limit) return quotaExceeded(res, tier, limit);
    next();
  } catch (err) {
    next(err);
  }
}

/** Call after the request has passed validation; returns false if it already responded. */
export async function quotaConsume(req: Request, res: Response): Promise<boolean> {
  if (!dbEnabled()) return true;
  const { tier, subject } = quotaContext(req);
  const maxMb = effectiveMaxFileMb(tier);
  const files = (req.files as Express.Multer.File[]) || [];
  const big = files.find((f) => f.size > maxMb * 1024 * 1024);
  if (big) {
    res.status(413).json({
      error: `This file is larger than your plan allows (${maxMb} MB).${tier === 'anonymous' || tier === 'free' ? ' Upgrade to Pro for larger files.' : ''}`,
      code: 'FILE_TOO_LARGE',
      upgradeUrl: tier === 'anonymous' || tier === 'free' ? '/pricing' : undefined,
    });
    return false;
  }
  const limit = PLAN_LIMITS[tier].cloudTasksPerDay;
  // Atomic "increment if below limit": no row returned means the limit was hit
  // (safe under concurrent requests from the same user).
  const row = await one<{ cloud_tasks: number }>(
    `INSERT INTO usage_daily (subject, day, cloud_tasks) VALUES ($1, ${TODAY}, 1)
       ON CONFLICT (subject, day) DO UPDATE SET cloud_tasks = usage_daily.cloud_tasks + 1
       WHERE $2::int IS NULL OR usage_daily.cloud_tasks < $2::int
     RETURNING cloud_tasks`,
    [subject, limit],
  );
  if (!row) {
    quotaExceeded(res, tier, limit!);
    return false;
  }
  return true;
}
