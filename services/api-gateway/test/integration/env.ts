import os from 'os';
import path from 'path';
import { TEST_API_KEY } from './mock-stirling';

/**
 * Environment for integration tests. Runs before each test file imports the
 * gateway (config.ts parses process.env at import time).
 * Override TEST_DATABASE_URL / TEST_REDIS_URL to point at other services.
 */
export const MOCK_STIRLING_PORT = Number(process.env.MOCK_STIRLING_PORT || 18080);
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://eyeshots:eyeshots_dev_password@localhost:55433/eyeshots_test';
// Redis DB 15 keeps test queues away from development data.
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/15';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  REDIS_URL: TEST_REDIS_URL,
  AUTH_SECRET: 'integration_test_auth_secret_0123456789abcdef',
  STIRLING_ENGINE_URL: `http://127.0.0.1:${MOCK_STIRLING_PORT}`,
  INTERNAL_STIRLING_API_KEY: TEST_API_KEY,
  STIRLING_TIMEOUT_MS: '10000',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_PER_MINUTE: '1000',
  // Each test client sends its own X-Forwarded-For IP, so per-IP limits are exercised realistically.
  TRUST_PROXY_HOPS: '1',
  STRIPE_WEBHOOK_SECRET: 'whsec_integration_test_secret',
  STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
  STRIPE_PRICE_TEAM_YEARLY: 'price_team_yearly',
  JOB_STORE_DIR: path.join(os.tmpdir(), `eyeshots-test-jobs-${process.pid}`),
});
delete process.env.SMTP_URL;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.ADMIN_API_TOKEN;
