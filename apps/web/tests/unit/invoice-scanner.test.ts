import { describe, it, expect, vi } from 'vitest';

// The engine imports pdf.js for text extraction; parsing itself is pure, so stub it.
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: vi.fn() }));

const { parseInvoiceText, exportToDatevCsv, exportToZugferdXml, missingExportFields } = await import('@/lib/pdf/invoice-scanner-engine');

const SAMPLE = `Muster Software GmbH
Hauptstraße 5, 10115 Berlin
USt-IdNr.: DE123456789
Rechnung
Rechnungsnummer: RE-2026-0042
Rechnungsdatum: 03.11.2026
Kunde: Beispiel AG
Beratung 10 Std. 1.000,00 EUR
Nettobetrag: 1.000,00 EUR
MwSt 19%: 190,00 EUR
Gesamtbetrag: 1.190,00 EUR
IBAN: DE02 1203 0000 0000 2020 51
BIC: BYLADEM1001`;

describe('parseInvoiceText', () => {
  it('extracts key accounting fields from a German invoice', () => {
    const inv = parseInvoiceText(SAMPLE, 'rechnung.pdf');
    expect(inv.invoiceNumber).toBe('RE-2026-0042');
    expect(inv.vendor.vatId?.replace(/\s/g, '')).toBe('DE123456789');
    expect(inv.vendor.iban?.replace(/\s/g, '')).toBe('DE02120300000000202051');
    expect(inv.totals.grossTotal).toBeCloseTo(1190, 2);
  });

  it('never fabricates data when fields are missing (regression)', () => {
    const inv = parseInvoiceText('Just a letter with no invoice data.', 'letter.pdf');
    // These values used to be filled with a fake vendor/IBAN/VAT ID and random numbers
    // that flowed into DATEV / ZUGFeRD exports.
    expect(inv.invoiceNumber).toBe('');
    expect(inv.vendor.iban).toBe('');
    expect(inv.vendor.vatId).toBe('');
    expect(inv.vendor.taxId).toBe('');
    expect(inv.vendor.bankName).toBe('');
    expect(inv.customer.customerId).toBe('');
    expect(JSON.stringify(inv)).not.toMatch(/Acme|DE89 3704|DE301928471/);
  });

  it('never invents amounts, dates or line items (regression: €1,190 / today)', () => {
    const inv = parseInvoiceText('nothing here', 'b.pdf');
    expect(inv.totals.grossTotal).toBe(0);
    expect(inv.totals.netSubtotal).toBe(0);
    expect(inv.totals.taxAmount).toBe(0);
    expect(inv.invoiceDate).toBe('');
    expect(inv.dueDate).toBe('');
    expect(inv.lineItems).toEqual([]);
  });

  it('derives the 14-day due date only from a real invoice date', () => {
    const inv = parseInvoiceText(SAMPLE, 'a.pdf');
    expect(inv.invoiceDate).toBe('2026-11-03');
    expect(inv.dueDate).toBe('2026-11-17');
  });

  it('refuses accounting exports while required fields are missing', () => {
    const empty = parseInvoiceText('nothing here', 'b.pdf');
    expect(missingExportFields(empty)).toEqual(expect.arrayContaining(['invoice number', 'invoice date', 'gross total']));
    expect(() => exportToDatevCsv(empty)).toThrow(/Please fill in/);
    expect(() => exportToZugferdXml(empty)).toThrow(/Please fill in/);
    const full = parseInvoiceText(SAMPLE, 'a.pdf');
    expect(missingExportFields(full)).toEqual([]);
    expect(exportToDatevCsv(full)).toContain('RE-2026-0042');
    expect(exportToZugferdXml(full)).toContain('20261103');
  });

  it('computes confidence from the fields actually found', () => {
    const full = parseInvoiceText(SAMPLE, 'a.pdf').confidenceScore;
    const empty = parseInvoiceText('nothing here', 'b.pdf').confidenceScore;
    expect(full).toBeGreaterThan(empty);
    expect(empty).toBeLessThan(50);
    expect(full).toBeLessThanOrEqual(100);
  });
});
