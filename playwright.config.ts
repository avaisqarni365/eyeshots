import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests against the production build of apps/web.
 *   npm run build:web && npm run test:e2e
 * Locally this uses your installed Chrome; CI installs Playwright's Chromium.
 */
const PORT = Number(process.env.E2E_PORT || 3100);
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './apps/web/tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    ...(isCI || process.env.PW_BUNDLED ? {} : { channel: 'chrome' }),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(isCI || process.env.PW_BUNDLED ? {} : { channel: 'chrome' }) }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(isCI || process.env.PW_BUNDLED ? {} : { channel: 'chrome' }) }, grep: /@mobile/ },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start apps/web -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
});
