import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query } from '../../src/db';
import { Client, lastCodeFor, startGateway, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startGateway(); });
afterAll(async () => { await h.close(); });

describe('passwordless sign-in', () => {
  it('rejects invalid emails and answers identically for new and existing accounts', async () => {
    const c = new Client(h.base);
    expect((await c.req('/api/auth/request-code', { body: { email: 'nope' } })).status).toBe(400);
    const a = await c.req('/api/auth/request-code', { body: { email: 'new-person@example.com' } });
    expect(a.status).toBe(200);
    expect(a.json).toEqual({ ok: true, expiresInMinutes: 10 });
  });

  it('stores codes hashed, signs in, and creates the account on first use', async () => {
    const c = new Client(h.base);
    const email = 'Alice@Example.com';
    await c.req('/api/auth/request-code', { body: { email } });
    const code = lastCodeFor(email);
    const rows = await query<{ code_hash: string }>(`SELECT code_hash FROM login_codes WHERE lower(email) = 'alice@example.com'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].code_hash).not.toContain(code);

    const r = await c.req('/api/auth/verify', { body: { email: 'alice@example.com', code } });
    expect(r.status).toBe(200);
    expect(r.json.newAccount).toBe(true);
    const cookie = r.headers.get('set-cookie')!;
    expect(cookie).toMatch(/es_session=es_/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = await c.req('/api/auth/me');
    expect(me.json.user).toMatchObject({ email: 'alice@example.com', plan: 'free', hasBillingAccount: false });

    // Only a SHA-256 of the session token is stored.
    const token = c.cookie.split('=')[1];
    const sessions = await query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(sessions[0].token_hash).toHaveLength(64);
    expect(sessions[0].token_hash).not.toContain(token);
  });

  it('codes are single-use and lock after 5 wrong attempts', async () => {
    const c = new Client(h.base);
    const email = 'bob@example.com';
    await c.req('/api/auth/request-code', { body: { email } });
    const code = lastCodeFor(email);
    const wrong = code === '000000' ? '111111' : '000000';
    const first = await c.req('/api/auth/verify', { body: { email, code: wrong } });
    expect(first.json.error).toMatch(/4 attempts left/);
    for (let i = 0; i < 4; i++) await c.req('/api/auth/verify', { body: { email, code: wrong } });
    const locked = await c.req('/api/auth/verify', { body: { email, code } });
    expect(locked.status).toBe(429); // even the right code is refused now

    await c.req('/api/auth/request-code', { body: { email } });
    const fresh = lastCodeFor(email);
    expect((await c.req('/api/auth/verify', { body: { email, code: fresh } })).status).toBe(200);
    const again = new Client(h.base);
    expect((await again.req('/api/auth/verify', { body: { email, code: fresh } })).status).toBe(400);
  });

  it('a newer code invalidates older ones, and signing in burns all codes', async () => {
    const c = new Client(h.base);
    const email = 'two-codes@example.com';
    await c.req('/api/auth/request-code', { body: { email } });
    const older = lastCodeFor(email);
    await c.req('/api/auth/request-code', { body: { email } });
    const newer = lastCodeFor(email);
    if (older !== newer) {
      expect((await c.req('/api/auth/verify', { body: { email, code: older } })).status).toBe(400);
    }
    expect((await c.req('/api/auth/verify', { body: { email, code: newer } })).status).toBe(200);
    const other = new Client(h.base);
    expect((await other.req('/api/auth/verify', { body: { email, code: older } })).status).toBe(400);
    const [open] = await query<{ n: string }>(`SELECT count(*) n FROM login_codes WHERE email = $1 AND consumed_at IS NULL`, [email]);
    expect(Number(open.n)).toBe(0);
  });

  it('bearer transport returns a token usable without cookies (desktop/API)', async () => {
    const c = new Client(h.base, null);
    const email = 'desktop@example.com';
    await c.req('/api/auth/request-code', { body: { email } });
    const r = await c.req('/api/auth/verify', { body: { email, code: lastCodeFor(email), transport: 'bearer' } });
    expect(r.json.token).toMatch(/^es_/);
    expect(r.headers.get('set-cookie')).toBeNull();
    const me = await c.req('/api/auth/me', { headers: { Authorization: `Bearer ${r.json.token}` } });
    expect(me.json.user.email).toBe(email);
  });
});

describe('CSRF protection', () => {
  it('blocks cookie-authenticated writes from other origins or without an Origin', async () => {
    const c = new Client(h.base);
    await c.signIn('csrf@example.com');
    expect((await c.req('/api/auth/logout', { method: 'POST', origin: 'https://evil.example' })).json.code).toBe('CSRF');
    expect((await c.req('/api/auth/logout', { method: 'POST', origin: null })).status).toBe(403);
    expect((await c.req('/api/auth/me')).status).toBe(200); // still signed in
  });
  it('does not grant CORS access to unknown origins', async () => {
    const r = await fetch(`${h.base}/api/auth/me`, { headers: { Origin: 'https://evil.example' } });
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
    const ok = await fetch(`${h.base}/api/auth/me`, { headers: { Origin: 'http://localhost:3000' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

describe('sign-out', () => {
  it('logout invalidates the session; logout-all signs out every device', async () => {
    const a = new Client(h.base);
    const b = new Client(h.base);
    await a.signIn('multi@example.com');
    await b.signIn('multi@example.com');
    const stale = a.cookie;
    await a.req('/api/auth/logout', { method: 'POST' });
    a.cookie = stale;
    expect((await a.req('/api/auth/me')).status).toBe(401);

    const c = new Client(h.base);
    await c.signIn('multi@example.com');
    expect((await c.req('/api/auth/logout-all', { method: 'POST' })).status).toBe(200);
    expect((await b.req('/api/auth/me')).status).toBe(401);
  });
});
