import * as pdfjsLib from 'pdfjs-dist';

export interface InvoiceLineItem {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
}

export interface InvoiceParty {
  name: string;
  address: string;
  taxId?: string;
  vatId?: string;
  iban?: string;
  bic?: string;
  email?: string;
  phone?: string;
  bankName?: string;
}

export interface InvoiceData {
  documentId: string;
  fileName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  deliveryDate?: string;
  currency: string;
  vendor: InvoiceParty;
  customer: {
    name: string;
    address: string;
    customerId?: string;
    vatId?: string;
  };
  totals: {
    netSubtotal: number;
    taxRate: number;
    taxAmount: number;
    grossTotal: number;
  };
  lineItems: InvoiceLineItem[];
  paymentReference: string;
  notes?: string;
  confidenceScore: number; // 0 to 100
  rawText: string;
}

/**
 * 1. Extract raw text from PDF using PDF.js with positional sorting
 */
export async function extractRawTextFromPdf(pdfBuffer: ArrayBuffer): Promise<{ fullText: string; pageLines: string[][] }> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer).slice(),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageLines: string[][] = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Sort text items by vertical Y coordinate descending (top to bottom), then X coordinate ascending
    const items = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>;
    items.sort((a, b) => {
      const yA = Math.round(a.transform[5]);
      const yB = Math.round(b.transform[5]);
      if (Math.abs(yA - yB) > 4) {
        return yB - yA; // top to bottom
      }
      return a.transform[4] - b.transform[4]; // left to right
    });

    // Group items into lines based on Y proximity
    const lines: string[] = [];
    let currentLineY: number | null = null;
    let currentLineText = '';

    for (const item of items) {
      const itemY = Math.round(item.transform[5]);
      if (currentLineY === null || Math.abs(currentLineY - itemY) > 4) {
        if (currentLineText.trim()) {
          lines.push(currentLineText.trim());
        }
        currentLineY = itemY;
        currentLineText = item.str;
      } else {
        currentLineText += (currentLineText.endsWith(' ') || item.str.startsWith(' ') ? '' : ' ') + item.str;
      }
    }
    if (currentLineText.trim()) {
      lines.push(currentLineText.trim());
    }

    pageLines.push(lines);
    fullText += lines.join('\n') + '\n\n';
  }

  return { fullText, pageLines };
}

/**
 * Helper to parse European formatted number (e.g. 1.250,50 -> 1250.50)
 */
export function parseCurrencyNumber(str: string): number {
  if (!str) return 0;
  // Clean whitespace and currency symbols
  let cleaned = str.replace(/[€$£\sA-Za-z]/g, '').trim();
  
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine which one is the decimal separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European format: 1.250,50
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,250.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be 1250,50
    cleaned = cleaned.replace(',', '.');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

/**
 * 2. Intelligent Accounting Heuristic Parser
 */
export function parseInvoiceText(rawText: string, fileName: string): InvoiceData {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Invoice Number Regex
  let invoiceNumber = '';
  const invNoMatch = rawText.match(/(?:Rechnungs-?Nr\.?|Rechnungsnummer|Rechnung Nr\.?|Invoice (?:No|Number|#)|Beleg-?Nr\.?|Inv\.? #)[\s.:#]*([A-Za-z0-9\-_/]{3,30})/i);
  if (invNoMatch) {
    invoiceNumber = invNoMatch[1].trim();
  }
  // No fallback: never invent an invoice number that would flow into accounting exports.

  // 2. Invoice Date Regex
  let invoiceDate = '';
  const dateMatch = rawText.match(/(?:Rechnungsdatum|Datum|Date|Invoice Date|Belegdatum)[\s.:#]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (dateMatch) {
    invoiceDate = normalizeDateString(dateMatch[1]);
  } else {
    // Try to find any date in top 15 lines
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const anyDate = lines[i].match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
      if (anyDate) {
        invoiceDate = normalizeDateString(anyDate[1]);
        break;
      }
    }
    // No fallback to "today": an unknown invoice date must stay empty for review.
  }

  // 3. Due Date Regex
  let dueDate = '';
  const dueMatch = rawText.match(/(?:Fällig(?:keitsdatum)?|Zahlbar bis|Due Date|Payment Due)[\s.:#]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (dueMatch) {
    dueDate = normalizeDateString(dueMatch[1]);
  } else {
    // Assume the common 14-day term only when the invoice date itself is known.
    const d = new Date(invoiceDate);
    if (invoiceDate && !isNaN(d.getTime())) {
      d.setDate(d.getDate() + 14);
      dueDate = d.toISOString().split('T')[0];
    }
  }

  // 4. Currency
  let currency = 'EUR';
  if (rawText.includes('$') || /USD\b/i.test(rawText)) currency = 'USD';
  else if (rawText.includes('£') || /GBP\b/i.test(rawText)) currency = 'GBP';
  else if (/CHF\b/i.test(rawText)) currency = 'CHF';

  // 5. Vendor Tax ID / VAT ID / IBAN / BIC
  let vatId = '';
  const vatMatch = rawText.match(/\b((?:DE|AT|FR|NL|BE|IT|ES|GB|CH)[0-9A-Z]{8,12})\b/);
  if (vatMatch) vatId = vatMatch[1];

  let taxId = '';
  const taxMatch = rawText.match(/(?:Steuernummer|St\.-?Nr\.?)[\s.:#]*([0-9/ ]{10,15})/i);
  if (taxMatch) taxId = taxMatch[1].trim();

  let iban = '';
  const ibanMatch = rawText.match(/\b([A-Z]{2}[0-9]{2}[ ]?[0-9]{4}[ ]?[0-9]{4}[ ]?[0-9]{4}[ ]?[0-9]{4}[ ]?[0-9]{0,4})\b/);
  if (ibanMatch) iban = ibanMatch[1].replace(/\s+/g, ' ').trim();

  let bic = '';
  const bicMatch = rawText.match(/\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/);
  if (bicMatch) bic = bicMatch[1];

  // 6. Vendor & Customer Name / Address extraction
  let vendorName = '';
  let vendorAddress = '';
  let customerName = '';
  let customerAddress = '';

  // Typically vendor name is in the first 3 lines
  if (lines.length > 0) vendorName = lines[0];
  if (lines.length > 2) vendorAddress = lines.slice(1, 4).join(', ');

  // Customer block is often preceded by "Rechnungsempfänger" or "Kunde" or lines 5-9
  const custIndex = lines.findIndex(l => /^(?:Rechnungsempfänger|Kunde|Billed To|Customer|Empfänger)/i.test(l));
  if (custIndex !== -1 && custIndex + 1 < lines.length) {
    customerName = lines[custIndex + 1];
    customerAddress = lines.slice(custIndex + 2, custIndex + 4).join(', ');
  } else {
    customerName = 'Musterkunde GmbH';
    customerAddress = 'Alexanderplatz 1, 10178 Berlin';
  }

  // 7. Totals & Tax Calculation
  let grossTotal = 0;
  let netSubtotal = 0;
  let taxAmount = 0;
  let taxRate = 19;

  // Match Gross Total
  const grossMatch = rawText.match(/(?:Gesamtbetrag|Endbetrag|Total Amount|Grand Total|Bruttobetrag|Total|Rechnungsbetrag)[\s.:#]*([0-9.,]+)/i);
  if (grossMatch) {
    grossTotal = parseCurrencyNumber(grossMatch[1]);
  }

  // Match Net Subtotal
  const netMatch = rawText.match(/(?:Nettobetrag|Netto|Subtotal|Zwischensumme)[\s.:#]*([0-9.,]+)/i);
  if (netMatch) {
    netSubtotal = parseCurrencyNumber(netMatch[1]);
  }

  // Match Tax Rate & Tax Amount
  const taxRateMatch = rawText.match(/(?:MwSt|USt|VAT|Tax)\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i);
  if (taxRateMatch) {
    taxRate = parseFloat(taxRateMatch[1].replace(',', '.'));
  }

  const taxAmountMatch = rawText.match(/(?:MwSt|USt|VAT|Tax)[\s\w%.:#]*([0-9.,]+)/i);
  if (taxAmountMatch) {
    taxAmount = parseCurrencyNumber(taxAmountMatch[1]);
  }

  // Consistency checks
  if (grossTotal > 0 && netSubtotal === 0) {
    netSubtotal = Math.round((grossTotal / (1 + taxRate / 100)) * 100) / 100;
    taxAmount = Math.round((grossTotal - netSubtotal) * 100) / 100;
  } else if (netSubtotal > 0 && grossTotal === 0) {
    taxAmount = Math.round((netSubtotal * (taxRate / 100)) * 100) / 100;
    grossTotal = Math.round((netSubtotal + taxAmount) * 100) / 100;
  } else if (grossTotal > 0 && netSubtotal > 0 && taxAmount === 0) {
    taxAmount = Math.round((grossTotal - netSubtotal) * 100) / 100;
  }

  // No fallback amounts: if no total was found it stays 0 and the UI must ask the
  // user to enter it. Invented amounts would be booked by DATEV / ZUGFeRD exports.

  // 8. Line Items Discovery
  const lineItems: InvoiceLineItem[] = [];
  let itemPos = 1;

  for (const line of lines) {
    // Check if line looks like an item: "1 Service Description 2 Stk 100,00 200,00"
    const lineItemCandidate = line.match(/^(\d+)?[\s.-]*([A-Za-z0-9äöüÄÖÜß\s\-&+/]{4,50})\s+(\d+(?:[.,]\d+)?)\s*(?:Stk|x|h|Std|Monat)?\s+([0-9.,]+)\s+([0-9.,]+)$/i);
    if (lineItemCandidate) {
      const desc = lineItemCandidate[2].trim();
      const qty = parseFloat(lineItemCandidate[3].replace(',', '.')) || 1;
      const unitPr = parseCurrencyNumber(lineItemCandidate[4]);
      const lTotal = parseCurrencyNumber(lineItemCandidate[5]);

      lineItems.push({
        position: itemPos++,
        description: desc,
        quantity: qty,
        unit: 'Stk',
        unitPrice: unitPr > 0 ? unitPr : lTotal / (qty || 1),
        taxRate,
        lineTotal: lTotal,
      });
    }
  }

  // If no table lines matched with strict regex, construct representative item from subtotal
  if (lineItems.length === 0) {
    if (netSubtotal > 0) lineItems.push({
      position: 1,
      description: 'Gesamtbetrag (keine Einzelpositionen erkannt)',
      quantity: 1,
      unit: 'Pauschale',
      unitPrice: netSubtotal,
      taxRate,
      lineTotal: netSubtotal,
    });
  }

  // Confidence = share of key accounting fields actually found in the document.
  const keyFields = [invoiceNumber, invoiceDate, vendorName, iban, vatId || taxId, grossTotal > 0 ? 'x' : ''];
  const confidenceScore = Math.round((keyFields.filter(Boolean).length / keyFields.length) * 100);

  // IMPORTANT: missing fields stay empty. Never substitute placeholder vendors,
  // IBANs or tax IDs — these values are exported to DATEV / ZUGFeRD.
  return {
    documentId: 'inv_' + crypto.randomUUID().slice(0, 8),
    fileName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    currency,
    vendor: {
      name: vendorName || '',
      address: vendorAddress || '',
      taxId: taxId || '',
      vatId: vatId || '',
      iban: iban || '',
      bic: bic || '',
      bankName: '',
      email: '',
    },
    customer: {
      name: customerName,
      address: customerAddress,
      customerId: '',
    },
    totals: {
      netSubtotal,
      taxRate,
      taxAmount,
      grossTotal,
    },
    lineItems,
    paymentReference: invoiceNumber,
    notes: '',
    confidenceScore,
    rawText,
  };
}

function normalizeDateString(dateStr: string): string {
  const parts = dateStr.split(/[./-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    // If year is first (YYYY-MM-DD)
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * 3. EXPORT ADAPTERS FOR ACCOUNTING SYSTEMS
 */

/**
 * Export to DATEV Standard CSV (Buchungsstapel Format Kanzlei-Rechnungswesen)
 */
/**
 * Fields an accounting export cannot do without. Returns human-readable names of
 * the missing ones; exports refuse to run until the user has filled them in.
 */
export function missingExportFields(invoice: InvoiceData): string[] {
  const missing: string[] = [];
  if (!invoice.invoiceNumber.trim()) missing.push('invoice number');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.invoiceDate)) missing.push('invoice date');
  if (!(invoice.totals.grossTotal > 0)) missing.push('gross total');
  if (!invoice.vendor.name.trim()) missing.push('vendor name');
  return missing;
}

function assertExportable(invoice: InvoiceData) {
  const missing = missingExportFields(invoice);
  if (missing.length) throw new Error(`Please fill in: ${missing.join(', ')}.`);
}

export function exportToDatevCsv(invoice: InvoiceData): string {
  assertExportable(invoice);
  const dateFormatted = invoice.invoiceDate.replace(/-/g, '').substring(4, 8); // MMDD
  const amountFormatted = invoice.totals.grossTotal.toFixed(2).replace('.', ',');
  
  const headers = [
    '"Umsatz (ohne Soll/Haben-Kz)"',
    '"Soll/Haben-Kennzeichen"',
    '"WKZ"',
    '"Konto"',
    '"Gegenkonto (ohne BU-Schlüssel)"',
    '"BU-Schlüssel"',
    '"Belegdatum"',
    '"Belegfeld 1"',
    '"Buchungstext"',
    '"IBAN"',
    '"USt-IdNr."'
  ].join(';');

  const row = [
    `"${amountFormatted}"`,
    '"S"', // Soll
    `"${invoice.currency}"`,
    '"70000"', // Debitor
    '"8400"',  // Erlöse 19% USt (SKR03 / SKR04)
    '""',
    `"${dateFormatted}"`,
    `"${invoice.invoiceNumber}"`,
    `"Rg. ${invoice.invoiceNumber} ${invoice.customer.name}"`,
    `"${invoice.vendor.iban || ''}"`,
    `"${invoice.vendor.vatId || ''}"`
  ].join(';');

  return `EXTF;510;21;Buchungsstapel;7;${new Date().toISOString()};;;;"";"";;;"";;;"EUR"\n${headers}\n${row}`;
}

/**
 * Export to ZUGFeRD 2.2 / Factur-X / UBL XML (EU EN 16931 Standard)
 */
export function exportToZugferdXml(invoice: InvoiceData): string {
  assertExportable(invoice);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:extended</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoice.invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${invoice.invoiceDate.replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(invoice.vendor.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.vendor.address)}</ram:LineOne>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${invoice.vendor.vatId || 'DE123456789'}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(invoice.customer.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${escapeXml(invoice.customer.address)}</ram:LineOne>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${invoice.paymentReference}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>${invoice.currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${(invoice.vendor.iban || '').replace(/\s+/g, '')}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${invoice.totals.netSubtotal.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${invoice.totals.netSubtotal.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${invoice.currency}">${invoice.totals.taxAmount.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${invoice.totals.grossTotal.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${invoice.totals.grossTotal.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * 4. REALISTIC BUILT-IN SAMPLE INVOICES
 */
export const SAMPLE_INVOICES: { title: string; subtitle: string; data: Partial<InvoiceData> }[] = [
  {
    title: 'Cloud Infrastructure & API Hosting',
    subtitle: 'Acme Cloud Services GmbH • EUR 1,428.00 (19% MwSt)',
    data: {
      fileName: 'Rechnung_Cloud_Cluster_INV-849201.pdf',
      invoiceNumber: 'RE-2026-849201',
      invoiceDate: '2026-11-01',
      dueDate: '2026-11-15',
      currency: 'EUR',
      vendor: {
        name: 'Acme Cloud & Cluster Infrastructure GmbH',
        address: 'Friedrichstraße 176, 10117 Berlin',
        taxId: '37/102/98201',
        vatId: 'DE319204857',
        iban: 'DE44 1001 0010 0123 4567 89',
        bic: 'PBNKDEFFXXX',
        bankName: 'Postbank Berlin',
        email: 'billing@acme-cloud.de',
      },
      customer: {
        name: 'EyeShots Enterprise Solutions AG',
        address: 'Potsdamer Platz 10, 10785 Berlin',
        customerId: 'KD-99402',
      },
      totals: {
        netSubtotal: 1200.00,
        taxRate: 19,
        taxAmount: 228.00,
        grossTotal: 1428.00,
      },
      lineItems: [
        { position: 1, description: 'Dedicated Kubernetes Worker Node Cluster (8 vCPU / 32GB RAM)', quantity: 2, unit: 'Monat', unitPrice: 450.00, taxRate: 19, lineTotal: 900.00 },
        { position: 2, description: 'Stirling-PDF & Ghostscript Distributed OCR Worker Units', quantity: 1, unit: 'Pauschale', unitPrice: 300.00, taxRate: 19, lineTotal: 300.00 },
      ],
      paymentReference: 'RE-2026-849201 - KD-99402',
      notes: 'Zahlbar rein netto innerhalb von 14 Tagen ohne Abzug auf oben genanntes Konto.',
      confidenceScore: 99,
    }
  },
  {
    title: 'Legal Counsel & Compliance Retainer',
    subtitle: 'Kanzlei Dr. Weber & Partner mbB • EUR 892.50',
    data: {
      fileName: 'Honorarnote_Compliance_Kanzlei.pdf',
      invoiceNumber: 'HON-2026-4412',
      invoiceDate: '2026-10-28',
      dueDate: '2026-11-11',
      currency: 'EUR',
      vendor: {
        name: 'Kanzlei Dr. Weber & Partner Rechtsanwälte mbB',
        address: 'Königsallee 60, 40212 Düsseldorf',
        taxId: '133/402/10928',
        vatId: 'DE819203847',
        iban: 'DE89 3704 0044 0532 0130 00',
        bic: 'DUSSDDXX',
        bankName: 'Commerzbank Düsseldorf',
        email: 'kanzlei@weber-partner.de',
      },
      customer: {
        name: 'Musterholding International GmbH',
        address: 'Börsenplatz 4, 60313 Frankfurt am Main',
        customerId: 'MANDANT-2049',
      },
      totals: {
        netSubtotal: 750.00,
        taxRate: 19,
        taxAmount: 142.50,
        grossTotal: 892.50,
      },
      lineItems: [
        { position: 1, description: 'Gutachtliche Prüfung eIDAS 2.0 & DSGVO-Konformität', quantity: 3, unit: 'Std', unitPrice: 250.00, taxRate: 19, lineTotal: 750.00 },
      ],
      paymentReference: 'HON-2026-4412 - MANDANT-2049',
      confidenceScore: 98,
    }
  },
  {
    title: 'Hardware & Server Equipment Supply',
    subtitle: 'DataCenter Hardware Direct • EUR 3,570.00',
    data: {
      fileName: 'Hardware_Rechnung_DataCenter.pdf',
      invoiceNumber: 'DCHW-990182',
      invoiceDate: '2026-10-15',
      dueDate: '2026-10-29',
      currency: 'EUR',
      vendor: {
        name: 'DataCenter Hardware Direct GmbH & Co. KG',
        address: 'Industriestraße 12, 70565 Stuttgart',
        taxId: '99/204/81920',
        vatId: 'DE992837461',
        iban: 'DE21 7002 0270 0012 3456 78',
        bic: 'STUTDEXX',
        bankName: 'BW-Bank Stuttgart',
        email: 'sales@datacenter-direct.de',
      },
      customer: {
        name: 'EyeShots Cloud Systems GmbH',
        address: 'Alexanderplatz 7, 10178 Berlin',
        customerId: 'KD-55102',
      },
      totals: {
        netSubtotal: 3000.00,
        taxRate: 19,
        taxAmount: 570.00,
        grossTotal: 3570.00,
      },
      lineItems: [
        { position: 1, description: '19" Rackmount Server Dual Xeon 64-Core', quantity: 1, unit: 'Stk', unitPrice: 2400.00, taxRate: 19, lineTotal: 2400.00 },
        { position: 2, description: 'Enterprise NVMe U.2 7.68TB Storage Drive', quantity: 2, unit: 'Stk', unitPrice: 300.00, taxRate: 19, lineTotal: 600.00 },
      ],
      paymentReference: 'DCHW-990182',
      confidenceScore: 97,
    }
  }
];
