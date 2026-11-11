import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { vi } from 'vitest';
import Stripe from 'stripe';
import { createApp } from '../../src/app';
import { migrate, query, closeDb } from '../../src/db';
import { closeQueue } from '../../src/queue';
import { MOCK_STIRLING_PORT } from './env';

export const ORIGIN = 'http://localhost:3000';

export const PDF = Buffer.from('%PDF-1.4\n% integration test document\n%%EOF\n', 'latin1');
export const pdfWith = (marker: string) => Buffer.from(`%PDF-1.4\n% ${marker}\n%%EOF\n`, 'latin1');

/** Captured dev-mail output, so tests can read sign-in codes. */
const mail: string[] = [];
const realLog = console.log;
vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
  const line = args.map(String).join(' ');
  if (line.startsWith('[dev-mail]')) mail.push(line);
  else if (process.env.TEST_VERBOSE) realLog(...args);
});
vi.spyOn(console, 'warn').mockImplementation(() => undefined);
if (!process.env.TEST_VERBOSE) vi.spyOn(console, 'error').mockImplementation(() => undefined);

export function lastCodeFor(email: string): string {
  const line = [...mail].reverse().find((l) => l.includes(`sign-in code for ${email.toLowerCase()}:`));
  if (!line) throw new Error(`No sign-in code was sent to ${email}`);
  return line.split(': ').pop()!.trim();
}

export interface Harness {
  base: string;
  close: () => Promise<void>;
}

/** Boots the real gateway app on an ephemeral port against a clean database. */
export async function startGateway(): Promise<Harness> {
  await migrate();
  await query('TRUNCATE users, login_codes, sessions, subscriptions, usage_daily, stripe_events CASCADE');
  await fetch(`http://127.0.0.1:${MOCK_STIRLING_PORT}/__requests`, { method: 'DELETE' });
  const { app } = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((r) => server.close(() => r()));
      await closeQueue();
      await closeDb();
    },
  };
}

export interface ApiResponse<T = any> { status: number; json: T; headers: Headers }

/** Small HTTP client that behaves like a browser on the allow-listed origin. */
let ipSeq = 0;

export class Client {
  cookie = '';
  /** Each client looks like a distinct visitor (gateway trusts one proxy hop in tests). */
  readonly ip = `203.0.113.${(++ipSeq % 250) + 1}`;
  constructor(readonly base: string, readonly origin: string | null = ORIGIN) {}

  async req<T = any>(path: string, init: { method?: string; body?: unknown; form?: FormData; headers?: Record<string, string>; origin?: string | null } = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { 'X-Forwarded-For': this.ip, ...init.headers };
    const origin = init.origin === undefined ? this.origin : init.origin;
    if (origin) headers.Origin = origin;
    if (this.cookie) headers.Cookie = this.cookie;
    let body: BodyInit | undefined;
    if (init.form) body = init.form;
    else if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }
    const r = await fetch(this.base + path, { method: init.method ?? (body ? 'POST' : 'GET'), body, headers });
    const setCookie = r.headers.get('set-cookie');
    if (setCookie?.startsWith('es_session=')) {
      const v = setCookie.split(';')[0];
      this.cookie = v === 'es_session=' ? '' : v;
    }
    const text = await r.text();
    let json: any = text;
    try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, headers: r.headers };
  }

  upload(path: string, files: { name: string; data: Buffer; type?: string }[], fields: Record<string, string> = {}) {
    const form = new FormData();
    for (const f of files) form.append('files', new Blob([new Uint8Array(f.data)], { type: f.type ?? 'application/pdf' }), f.name);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return this.req(path, { method: 'POST', form });
  }

  async signIn(email: string): Promise<string> {
    const r1 = await this.req('/api/auth/request-code', { body: { email } });
    if (r1.status !== 200) throw new Error(`request-code failed: ${r1.status} ${JSON.stringify(r1.json)}`);
    const r2 = await this.req('/api/auth/verify', { body: { email, code: lastCodeFor(email) } });
    if (r2.status !== 200) throw new Error(`verify failed: ${r2.status} ${JSON.stringify(r2.json)}`);
    const me = await this.req('/api/auth/me');
    return me.json.user.id as string;
  }
}

export interface EngineRequest { endpoint: string; apiKey?: string; fields: Record<string, string | string[]> }

export async function engineRequests(): Promise<EngineRequest[]> {
  return (await fetch(`http://127.0.0.1:${MOCK_STIRLING_PORT}/__requests`)).json();
}

export async function clearEngineRequests(): Promise<void> {
  await fetch(`http://127.0.0.1:${MOCK_STIRLING_PORT}/__requests`, { method: 'DELETE' });
}

/** Most recent engine call to a given endpoint (robust against unrelated background calls). */
export async function lastEngineRequest(endpoint: string): Promise<EngineRequest | undefined> {
  return (await engineRequests()).filter((r) => r.endpoint === endpoint).at(-1);
}

// ── Stripe webhooks (signed exactly like Stripe does) ─────────────────

const stripe = new Stripe('sk_test_unused');
let eventSeq = 0;

export async function sendStripeEvent(base: string, type: string, object: Record<string, unknown>, opts: { created?: number; id?: string; secret?: string } = {}) {
  const payload = JSON.stringify({
    id: opts.id ?? `evt_test_${Date.now()}_${eventSeq++}`, object: 'event', type, created: opts.created ?? Math.floor(Date.now() / 1000),
    data: { object }, api_version: '2025-10-29.clover', livemode: false, pending_webhooks: 1, request: null,
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? process.env.STRIPE_WEBHOOK_SECRET! });
  const r = await fetch(`${base}/api/billing/webhook`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header } });
  return { status: r.status, json: await r.json().catch(() => null), payload, header };
}

export function subscription(userId: string, status: string, priceId: string, extra: Record<string, unknown> = {}) {
  return {
    // One Stripe customer per user, as in production.
    id: `sub_${userId.slice(0, 8)}`, object: 'subscription', customer: `cus_${userId.slice(0, 8)}`, status, cancel_at_period_end: false, cancel_at: null,
    metadata: { userId },
    items: { object: 'list', data: [{ id: 'si_1', price: { id: priceId }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
    ...extra,
  };
}
