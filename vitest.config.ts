import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Test projects:
 *   web                  – pure logic in apps/web/lib (pdf-lib pipelines, parsers, helpers)
 *   gateway              – gateway units (validation, tools, plans, blob store, rate limiting)
 *   gateway-integration  – the real Express app against Postgres + Redis and a mock Stirling engine
 *
 *   npm test                    → web + gateway (no services needed)
 *   npm run test:integration    → needs Postgres + Redis (see docs/15-TESTING-AND-CI.md)
 *   npm run test:live           → needs a real Stirling-PDF container
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': r('./apps/web') } },
        test: {
          name: 'web',
          root: r('./apps/web'),
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'gateway',
          root: r('./services/api-gateway'),
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'gateway-integration',
          root: r('./services/api-gateway'),
          include: ['test/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['test/integration/global-setup.ts'],
          setupFiles: ['test/integration/env.ts'],
          // Files share one database and Redis DB: run them one at a time.
          fileParallelism: false,
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'gateway-live',
          root: r('./services/api-gateway'),
          include: ['test/live/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['test/live/env.ts'],
          testTimeout: 180_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['apps/web/lib/**/*.ts', 'services/api-gateway/src/**/*.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
});
