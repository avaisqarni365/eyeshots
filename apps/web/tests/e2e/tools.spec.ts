import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { samplePdf, solidPng, readDownload } from './fixtures';

/** Client-side tools: the whole flow runs in the browser, so these need no backend. */
test.describe('client-side tools', () => {
  test('Images → PDF builds one page per image, in order', async ({ page }) => {
    await page.goto('/jpg-to-pdf');
    await page.locator('main input[type=file]').setInputFiles([
      { name: 'red.png', mimeType: 'image/png', buffer: solidPng(40, 30, [220, 30, 30]) },
      { name: 'blue.png', mimeType: 'image/png', buffer: solidPng(30, 40, [30, 30, 220]) },
    ]);
    await expect(page.getByText('2 images')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Convert to PDF' }).click()]);
    expect(download.suggestedFilename()).toBe('images.pdf');
    const pdf = await PDFDocument.load(await readDownload(download));
    expect(pdf.getPageCount()).toBe(2);
    // A4 with "auto" orientation: landscape image → landscape page, portrait → portrait.
    const [p1, p2] = pdf.getPages();
    expect(p1.getWidth()).toBeGreaterThan(p1.getHeight());
    expect(p2.getWidth()).toBeLessThan(p2.getHeight());
    await expect(page.getByText('Your PDF has been downloaded.')).toBeVisible();
  });

  test('PDF → Images exports a ZIP with one JPG per page', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await page.locator('main input[type=file]').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await samplePdf(3) });
    await expect(page.getByText('Leave empty for all 3 pages')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Convert to JPG/ }).click()]);
    expect(download.suggestedFilename()).toBe('doc-images.zip');
    const zip = await JSZip.loadAsync(await readDownload(download));
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['doc-page-001.jpg', 'doc-page-002.jpg', 'doc-page-003.jpg']);
    const jpg = await zip.files[names[0]].async('uint8array');
    expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
  });

  test('PDF → Images honours a page range', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await page.locator('main input[type=file]').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await samplePdf(4) });
    await page.getByPlaceholder('All pages').fill('2');
    await page.getByText('PNG', { exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Convert to PNG/ }).click()]);
    expect(download.suggestedFilename()).toBe('doc-page-2.png');
  });

  test('Crop (auto-trim) shrinks every page to its content', async ({ page }) => {
    await page.goto('/crop-pdf');
    await page.locator('main input[type=file]').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await samplePdf(2) });
    await expect(page.getByAltText('First page preview')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Crop & download/ }).click()]);
    const pdf = await PDFDocument.load(await readDownload(download));
    for (const p of pdf.getPages()) {
      const box = p.getCropBox();
      // Content block is 300×200 pt; 4 mm padding ≈ 11 pt per side (±2 pt rendering tolerance).
      expect(box.width).toBeGreaterThan(315);
      expect(box.width).toBeLessThan(330);
      expect(box.height).toBeGreaterThan(215);
      expect(box.height).toBeLessThan(230);
    }
  });

  test('Crop (manual) rejects margins larger than the page', async ({ page }) => {
    await page.goto('/crop-pdf');
    await page.locator('main input[type=file]').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: await samplePdf(1) });
    await page.getByRole('button', { name: 'Manual' }).click();
    await page.getByLabel('Left (mm)').fill('150');
    await page.getByLabel('Right (mm)').fill('150');
    await page.getByRole('button', { name: /Crop & download/ }).click();
    await expect(page.locator('main [role=alert]')).toContainText('Margins are larger than page 1');
  });

  test('dropzone rejects the wrong file type with a clear message', async ({ page }) => {
    await page.goto('/pdf-to-jpg');
    await page.locator('main input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator('main [role=alert]')).toContainText('Unsupported file type');
  });

  test('a file dropped on the home page is handed to the chosen tool (no re-upload)', async ({ page }) => {
    await page.goto('/');
    await page.locator('main input[type=file]').first().setInputFiles({ name: 'handoff.pdf', mimeType: 'application/pdf', buffer: await samplePdf(2) });
    await page.getByRole('dialog').getByRole('button', { name: /PDF to Images/ }).click();
    await expect(page).toHaveURL(/\/pdf-to-jpg$/);
    await expect(page.getByText('handoff.pdf')).toBeVisible();
    await expect(page.getByText('Leave empty for all 2 pages')).toBeVisible();
  });
});

test.describe('server-backed tools without a backend', () => {
  test('show an actionable error instead of failing silently', async ({ page }) => {
    // E2E runs without the gateway: the request fails fast and the UI must say so.
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));
    await page.goto('/word-to-pdf');
    await page.locator('main input[type=file]').setInputFiles({
      name: 'letter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    });
    await page.getByRole('button', { name: 'Convert to PDF' }).click();
    await expect(page.locator('main [role=alert]')).toContainText(/Could not reach/);
  });
});
