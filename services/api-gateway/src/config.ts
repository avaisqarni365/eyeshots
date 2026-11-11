import { z } from 'zod';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';

dotenv.config();

const DEV_KEY = 'eyeshots_internal_dev_secret_key';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  STIRLING_ENGINE_URL: z.string().url().default('http://localhost:8080'),
  INTERNAL_STIRLING_API_KEY: z.string().min(16).default(DEV_KEY),
  /** Comma-separated list of allowed browser origins. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,tauri://localhost,http://tauri.localhost'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(100),
  /** Requests per IP per minute across all processing endpoints. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  /** Number of reverse proxies in front of the gateway (for correct client IPs). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  /** Enables the mocked accounting/legal endpoints. Never enable in production. */
  ENABLE_DEMO_ENDPOINTS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** Bearer token for /api/v1/admin/*. Admin API is disabled when unset. */
  ADMIN_API_TOKEN: z.string().min(24).optional(),
  STIRLING_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),

  // ── Async job queue ────────────────────────────────────────────
  /** Enables the job queue (/api/jobs). When unset, only synchronous /api/tools routes work. */
  REDIS_URL: z.string().url().optional(),
  /** Where job inputs/results live: 'fs' (shared tmpfs volume) or 's3' (multi-host). */
  JOB_STORE: z.enum(['fs', 's3']).default('fs'),
  JOB_STORE_DIR: z.string().default(path.join(os.tmpdir(), 'eyeshots-jobs')),
  S3_BUCKET: z.string().optional(),
  S3_PREFIX: z.string().default('jobs/'),
  S3_REGION: z.string().default('eu-central-1'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /**
   * Lifetime of job data. The sweeper runs every JOB_SWEEP_MINUTES, so the
   * worst-case retention is TTL + sweep interval, which must stay ≤ 120 min.
   */
  JOB_TTL_MINUTES: z.coerce.number().int().min(5).default(110),
  JOB_SWEEP_MINUTES: z.coerce.number().int().min(1).default(5),
  /** Parallel jobs per worker process. Stirling is CPU-heavy; scale workers, not this. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  /** Max waiting jobs before new submissions get 503 (back-pressure). */
  QUEUE_MAX_WAITING: z.coerce.number().int().min(1).default(500),

  // ── Accounts, sessions & quotas ────────────────────────────────
  /** Postgres for users, sessions, subscriptions and usage counters — never documents. */
  DATABASE_URL: z.string().url().optional(),
  /** ≥ 32 random chars. Keys HMACs for login codes and IP hashing. */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Public URL of the web app, used in emails and Stripe redirect URLs. */
  APP_URL: z.string().url().default('http://localhost:3000'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** SMTP connection string, e.g. smtps://user:pass@smtp.example.com:465. Dev without it: codes are logged. */
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('EyeShots <no-reply@localhost>'),

  // ── Stripe billing ─────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_YEARLY: z.string().optional(),
  /** Collect VAT automatically (requires Stripe Tax to be enabled in the dashboard). */
  STRIPE_AUTOMATIC_TAX: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

{
  const problems: string[] = [];
  if (config.JOB_TTL_MINUTES + config.JOB_SWEEP_MINUTES > 120) {
    problems.push('JOB_TTL_MINUTES + JOB_SWEEP_MINUTES must be ≤ 120 (2-hour zero-retention policy)');
  }
  if (config.JOB_STORE === 's3' && !config.S3_BUCKET) problems.push('JOB_STORE=s3 requires S3_BUCKET');
  if (config.DATABASE_URL && !config.AUTH_SECRET) problems.push('DATABASE_URL requires AUTH_SECRET (≥ 32 chars)');
  if (problems.length) {
    console.error('[config] Invalid job configuration:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

if (config.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (config.INTERNAL_STIRLING_API_KEY === DEV_KEY) problems.push('INTERNAL_STIRLING_API_KEY is the public development default');
  if (config.ENABLE_DEMO_ENDPOINTS) problems.push('ENABLE_DEMO_ENDPOINTS must be false in production');
  if (!config.DATABASE_URL) problems.push('DATABASE_URL is required (accounts, quotas, billing)');
  if (!config.AUTH_SECRET) problems.push('AUTH_SECRET is required (generate with `openssl rand -hex 32`)');
  if (!config.SMTP_URL) problems.push('SMTP_URL is required to send sign-in codes');
  if (config.STRIPE_SECRET_KEY && !config.STRIPE_WEBHOOK_SECRET) problems.push('STRIPE_WEBHOOK_SECRET is required when Stripe is enabled');
  if (config.STRIPE_SECRET_KEY?.startsWith('sk_test_')) console.warn('[config] WARNING: Stripe is in TEST mode in production');
  if (problems.length) {
    console.error('[config] Refusing to start in production:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}

export const allowedOrigins = new Set(config.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean));
