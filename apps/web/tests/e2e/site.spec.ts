import { test, expect } from '@playwright/test';
import { PDF_TOOLS } from '../../lib/tools-data';

test.describe('site shell', () => {
  test('home page renders hero, dropzone and the full tool grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Every PDF tool you need');
    await expect(page.getByRole('button', { name: /Drop your files here/i })).toBeVisible();
    const grid = page.locator('#all-tools');
    await expect(grid.getByRole('link', { name: /Merge PDF/ })).toBeVisible();

    await grid.getByRole('tab', { name: 'Convert to PDF' }).click();
    await expect(grid.getByRole('link', { name: /Images to PDF/ })).toBeVisible();
    await expect(grid.getByRole('link', { name: /Merge PDF/ })).toHaveCount(0);
  });

  test('every tool in the registry has a working, titled page', async ({ request }) => {
    for (const tool of PDF_TOOLS) {
      const res = await request.get(tool.path);
      expect(res.status(), tool.path).toBe(200);
      const html = await res.text();
      const escaped = tool.name.replace(/&/g, "&amp;");
      expect(html, `${tool.path} <title>`).toContain(`<title>${escaped}`);
      expect(html, `${tool.path} meta description`).toContain('name="description"');
    }
  });

  test('command palette finds and opens a tool', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder(/Search \d+ tools/);
    // The shortcut is registered on hydration; on a busy CI runner the first key
    // press can land before that, so retry until the palette opens.
    await expect(async () => {
      if (!(await input.isVisible())) await page.keyboard.press('/');
      await expect(input).toBeFocused({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await input.fill('crop');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/crop-pdf$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crop PDF');
  });

  test('theme choice persists across reloads', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /theme/i });
    for (let i = 0; i < 3; i++) {
      if ((await page.evaluate(() => document.documentElement.classList.contains('dark')))) break;
      await toggle.click();
    }
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('unknown routes show the branded 404 with tool suggestions', async ({ page }) => {
    const res = await page.goto('/definitely-not-a-tool');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /doesn’t exist/ })).toBeVisible();
  });

  test('legacy /german-forms redirects to /forms', async ({ page }) => {
    await page.goto('/german-forms');
    await expect(page).toHaveURL(/\/forms$/);
  });

  test('sends security headers and serves robots/sitemap', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers()['x-powered-by']).toBeUndefined();
    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /account');
    expect(await (await request.get('/sitemap.xml')).text()).toContain('/jpg-to-pdf');
  });

  test('pdf.js assets are self-hosted (no CDN requests)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) external.push(r.url());
    });
    await page.goto('/pdf-to-jpg');
    expect((await page.request.get('/pdfjs/cmaps/78-H.bcmap')).status()).toBe(200);
    expect(external).toEqual([]);
  });
});

test.describe('mobile', () => {
  test('home has no horizontal overflow and the menu lists all tools @mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile project only');
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Open menu' }).click();
    for (const name of ['Merge', 'Compress', 'JPG to PDF', 'Crop']) {
      await expect(page.locator('header').getByRole('link', { name, exact: true })).toBeVisible();
    }
  });
});
