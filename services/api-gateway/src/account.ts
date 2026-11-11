import { Router } from 'express';
import { z } from 'zod';
import { query } from './db';
import { getUser, publicUser, requireUser } from './auth';
import { cancelAllSubscriptions } from './billing';
import { effectiveMaxFileMb, PLAN_LIMITS } from './plans';
import { usageToday } from './quotas';

/**
 *   GET    /api/account          profile + plan + today's usage and limits
 *   GET    /api/account/export   GDPR Art. 20 data export (JSON)
 *   DELETE /api/account          GDPR Art. 17 erasure { confirm: "DELETE" }
 */
export function createAccountRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get('/', async (req, res) => {
    const u = getUser(req)!;
    const used = await usageToday(`user:${u.id}`);
    const limits = PLAN_LIMITS[u.plan];
    const sessions = await query<{ n: string }>(`SELECT count(*) AS n FROM sessions WHERE user_id = $1 AND expires_at > now()`, [u.id]);
    res.json({
      user: publicUser(u),
      usage: { cloudTasksToday: used, cloudTasksPerDay: limits.cloudTasksPerDay, maxFileMb: effectiveMaxFileMb(u.plan) },
      activeSessions: Number(sessions[0]?.n ?? 0),
    });
  });

  router.get('/export', async (req, res) => {
    const u = getUser(req)!;
    const [user] = await query(`SELECT id, email, created_at, last_login_at, plan, plan_status, current_period_end, cancel_at_period_end FROM users WHERE id = $1`, [u.id]);
    const sessions = await query(`SELECT created_at, last_seen_at, expires_at, user_agent FROM sessions WHERE user_id = $1`, [u.id]);
    const subscriptions = await query(`SELECT id, status, plan, current_period_end, cancel_at_period_end, updated_at FROM subscriptions WHERE user_id = $1`, [u.id]);
    const usage = await query(`SELECT day, cloud_tasks FROM usage_daily WHERE subject = $1 ORDER BY day`, [`user:${u.id}`]);
    res.setHeader('Content-Disposition', 'attachment; filename="eyeshots-account-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      note: 'EyeShots never stores your documents. This export contains all account data we hold. Invoices are available in the billing portal.',
      user, sessions, subscriptions, usage,
    });
  });

  router.delete('/', async (req, res) => {
    const parsed = z.object({ confirm: z.literal('DELETE') }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Confirmation required: send { "confirm": "DELETE" }.' });
    const u = getUser(req)!;
    try {
      await cancelAllSubscriptions(u.id);
    } catch (err: any) {
      console.error(JSON.stringify({ level: 'error', msg: 'cancel on delete failed', userId: u.id, error: err?.message }));
      return res.status(502).json({ error: 'We could not cancel your subscription. Please try again or contact support.' });
    }
    // Cascades to sessions and subscriptions. Stripe keeps invoices for tax law; the
    // customer object is left in Stripe without any link back to us.
    await query(`DELETE FROM usage_daily WHERE subject = $1`, [`user:${u.id}`]);
    await query(`DELETE FROM users WHERE id = $1`, [u.id]);
    console.log(JSON.stringify({ level: 'info', msg: 'account deleted', userId: u.id }));
    res.setHeader('Set-Cookie', 'es_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ ok: true });
  });

  return router;
}
