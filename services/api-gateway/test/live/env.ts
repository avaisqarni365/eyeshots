/**
 * Live-engine smoke tests run the gateway against a REAL Stirling-PDF container
 * to catch API drift (renamed endpoints/parameters) that the mock cannot.
 *   docker compose up -d stirling-pdf-core && npm run test:live
 */
Object.assign(process.env, {
  NODE_ENV: 'test',
  STIRLING_ENGINE_URL: process.env.LIVE_STIRLING_URL || 'http://localhost:8080',
  INTERNAL_STIRLING_API_KEY: process.env.LIVE_STIRLING_API_KEY || 'eyeshots_internal_dev_secret_key',
  STIRLING_TIMEOUT_MS: '120000',
  RATE_LIMIT_PER_MINUTE: '1000',
});
// No database or queue: quotas are off and only the synchronous engine path is exercised.
delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;
