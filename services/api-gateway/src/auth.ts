import { Router, type NextFunction, type Request, type Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { config, allowedOrigins } from './config';
import { dbEnabled, one, query, tx } from './db';
import { sendLoginCode } from './mailer';
import { rateLimit } from './security';
import type { PlanId } from './plans';

/**
 * Passwordless sign-in with 6-digit email codes.
 *
 * - Codes: 10-minute expiry, max 5 attempts, single use, stored as HMAC-SHA256.
 * - Sessions: 256-bit random token; only its SHA-256 is stored. Delivered as an
 *   HttpOnly SameSite=Lax cookie (web) or returned once for Bearer use (desktop/API).
 * - CSRF: cookie-authenticated state-changing requests must come from an
 *   allow-listed Origin.
 * - No account enumeration: request-code always answers the same way.
 */

export const SESSION_COOKIE = 'es_session';
const CODE_TTL_MIN = 10;
const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export interface SessionUser {
  id: string;
  email: string;
  plan: PlanId;
  planStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  sessionId: string;
}

type ReqWithUser = Request & { user?: SessionUser };

export function getUser(req: Request): SessionUser | undefined {
  return (req as ReqWithUser).user;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (s: string) => crypto.createHmac('sha256', config.AUTH_SECRET!).update(s).digest('hex');
const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Stable, non-reversible identifier for an IP address (for anonymous quotas). */
export function ipSubject(req: Request): string {
  return 'ip:' + hmac(`ip:${req.ip || 'unknown'}`).slice(0, 32);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch {}
  }
  return out;
}

function sessionCookie(token: string, maxAgeSec: number): string {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (config.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Resolves the session (cookie or Bearer) and attaches req.user. Never rejects
 * anonymous requests — use requireUser for that. Rejects cross-site
 * cookie-authenticated writes (CSRF).
 */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  if (!dbEnabled()) return next();
  const bearer = req.headers.authorization?.startsWith('Bearer es_') ? req.headers.authorization.slice(7) : undefined;
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const token = bearer || cookie;
  if (!token) return next();

  if (!bearer && UNSAFE.has(req.method)) {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Cross-site request blocked.', code: 'CSRF' });
    }
  }

  try {
    const row = await one<{
      session_id: string; expires_at: Date; last_seen_at: Date;
      id: string; email: string; plan: PlanId; plan_status: string | null; current_period_end: Date | null; cancel_at_period_end: boolean; stripe_customer_id: string | null;
    }>(
      `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.id, u.email, u.plan, u.plan_status, u.current_period_end, u.cancel_at_period_end, u.stripe_customer_id
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)],
    );
    if (row) {
      (req as ReqWithUser).user = {
        id: row.id,
        email: row.email,
        plan: row.plan,
        planStatus: row.plan_status,
        currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        stripeCustomerId: row.stripe_customer_id,
        sessionId: row.session_id,
      };
      // Sliding expiry, written at most once an hour per session.
      if (Date.now() - row.last_seen_at.getTime() > 3_600_000) {
        void query(`UPDATE sessions SET last_seen_at = now(), expires_at = now() + make_interval(days => $2) WHERE id = $1`, [row.session_id, config.SESSION_DAYS]).catch(() => undefined);
      }
    } else if (cookie && !bearer) {
      res.setHeader('Set-Cookie', sessionCookie('', 0)); // clear stale cookie
    }
  } catch (err: any) {
    console.error(JSON.stringify({ level: 'error', msg: 'session lookup failed', error: err?.message }));
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!dbEnabled()) return res.status(503).json({ error: 'Accounts are not enabled on this server.', code: 'AUTH_DISABLED' });
  if (!getUser(req)) return res.status(401).json({ error: 'Please sign in.', code: 'UNAUTHENTICATED' });
  next();
}

export function publicUser(u: SessionUser) {
  return {
    id: u.id,
    email: u.email,
    plan: u.plan,
    planStatus: u.planStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    cancelAtPeriodEnd: u.cancelAtPeriodEnd,
    hasBillingAccount: Boolean(u.stripeCustomerId),
  };
}

export function createAuthRouter(): Router {
  const router = Router();
  const codeLimiter = rateLimit({ bucket: 'auth-code', windowMs: 15 * 60_000, max: 10 });
  const verifyLimiter = rateLimit({ bucket: 'auth-verify', windowMs: 15 * 60_000, max: 30 });

  router.use((_req, res, next) => {
    if (!dbEnabled()) return res.status(503).json({ error: 'Accounts are not enabled on this server.', code: 'AUTH_DISABLED' });
    next();
  });

  const emailSchema = z.string().trim().email().max(254);

  router.post('/request-code', codeLimiter, async (req, res) => {
    const parsed = z.object({ email: emailSchema }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Please enter a valid email address.' });
    const email = normalizeEmail(parsed.data.email);

    const recent = await one<{ n: string }>(`SELECT count(*) AS n FROM login_codes WHERE lower(email) = $1 AND created_at > now() - interval '1 hour'`, [email]);
    if (Number(recent?.n ?? 0) >= MAX_CODES_PER_HOUR) {
      return res.status(429).json({ error: 'Too many codes requested. Please wait a while and try again.' });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await query(
      `INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [email, hmac(`${email}:${code}`), CODE_TTL_MIN],
    );
    try {
      await sendLoginCode(email, code);
    } catch (err: any) {
      console.error(JSON.stringify({ level: 'error', msg: 'sending login code failed', error: err?.message }));
      return res.status(502).json({ error: 'We could not send the email right now. Please try again.' });
    }
    // Identical response whether or not the account exists (no enumeration).
    res.json({ ok: true, expiresInMinutes: CODE_TTL_MIN });
  });

  router.post('/verify', verifyLimiter, async (req, res) => {
    const parsed = z
      .object({ email: emailSchema, code: z.string().regex(/^\d{3}\s?\d{3}$/), transport: z.enum(['cookie', 'bearer']).default('cookie') })
      .safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Enter the 6-digit code from the email.' });
    const email = normalizeEmail(parsed.data.email);
    const code = parsed.data.code.replace(/\s/g, '');

    type VerifyResult = { ok: true; token: string; userId: string; created: boolean } | { ok: false; error: string; status: number };
    const result = await tx<VerifyResult>(async (c) => {
      const row = (await c.query<{ id: string; code_hash: string; attempts: number; consumed_at: Date | null }>(
        // Only the most recent code counts: requesting a new code invalidates older ones,
        // and a used code can't "fall back" to an earlier, still-unexpired one.
        `SELECT id, code_hash, attempts, consumed_at FROM login_codes
          WHERE lower(email) = $1 AND expires_at > now()
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [email],
      )).rows[0];
      if (!row || row.consumed_at) return { ok: false, error: 'This code has expired. Please request a new one.', status: 400 } as const;
      if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: 'Too many wrong attempts. Please request a new code.', status: 429 } as const;

      const expected = Buffer.from(row.code_hash, 'hex');
      const given = Buffer.from(hmac(`${email}:${code}`), 'hex');
      if (!crypto.timingSafeEqual(expected, given)) {
        await c.query(`UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
        const left = MAX_CODE_ATTEMPTS - row.attempts - 1;
        return { ok: false, error: left > 0 ? `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Please request a new code.', status: 400 } as const;
      }

      await c.query(`UPDATE login_codes SET consumed_at = now() WHERE lower(email) = $1 AND consumed_at IS NULL`, [email]);
      const user = (await c.query<{ id: string; created: boolean }>(
        `INSERT INTO users (email, last_login_at) VALUES ($1, now())
           ON CONFLICT (lower(email)) DO UPDATE SET last_login_at = now()
           RETURNING id, (xmax = 0) AS created`,
        [email],
      )).rows[0];
      const token = 'es_' + crypto.randomBytes(32).toString('base64url');
      await c.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent) VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
        [user.id, sha256(token), config.SESSION_DAYS, String(req.headers['user-agent'] || '').slice(0, 200)],
      );
      return { ok: true, token, userId: user.id, created: user.created } as const;
    });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    console.log(JSON.stringify({ level: 'info', msg: result.created ? 'user signed up' : 'user signed in', userId: result.userId }));
    if (parsed.data.transport === 'bearer') return res.json({ ok: true, token: result.token, newAccount: result.created });
    res.setHeader('Set-Cookie', sessionCookie(result.token, config.SESSION_DAYS * 86_400));
    res.json({ ok: true, newAccount: result.created });
  });

  router.get('/me', (req, res) => {
    const u = getUser(req);
    if (!u) return res.status(401).json({ error: 'Not signed in.', code: 'UNAUTHENTICATED' });
    res.json({ user: publicUser(u) });
  });

  router.post('/logout', async (req, res) => {
    const u = getUser(req);
    if (u) await query(`DELETE FROM sessions WHERE id = $1`, [u.sessionId]);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  });

  /** Signs out every device. */
  router.post('/logout-all', requireUser, async (req, res) => {
    await query(`DELETE FROM sessions WHERE user_id = $1`, [getUser(req)!.id]);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  });

  return router;
}

/** Housekeeping: expired sessions/codes and old usage rows (data minimisation). */
export async function purgeAuthData(): Promise<void> {
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  await query(`DELETE FROM login_codes WHERE created_at < now() - interval '1 day'`);
  await query(`DELETE FROM usage_daily WHERE day < (now() AT TIME ZONE 'utc')::date - 35`);
}
