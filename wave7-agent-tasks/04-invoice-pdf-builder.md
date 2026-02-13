# Agent 4: Invoice PDF Builder

## Role
Build the PDF generation service for invoices using pdf-lib (pure JavaScript, no Chromium).

## Priority: SUB-WAVE 2 (After Agent 3)

## Files to CREATE

### 1. `server/src/services/invoice-pdf.ts`
**Purpose**: Generate professional tax invoice PDFs from invoice data
**Library**: `pdf-lib` (pure JavaScript PDF creation, ~2MB, no native dependencies)
**NOT**: Puppeteer, html-pdf, or any Chromium-based solution

#### Class: `InvoicePDFService`

**Methods**:

- [ ] `generateInvoicePDF(invoice: InvoiceWithLines, businessProfile?: BusinessProfile): Promise<Buffer>`
  - Creates a professional A4 tax invoice PDF
  - Returns PDF as Buffer

  > **REVISION NOTE (D02 — PDF Generation Security / Input Sanitization)**:
  > All input data MUST be sanitized before rendering into the PDF to prevent injection attacks:
  > 1. Strip or escape all HTML/script tags from text fields (businessName, contactName, notes, description, etc.) before embedding in PDF.
  > 2. Validate and sanitize file paths if logo images are included (prevent path traversal).
  > 3. Limit text field lengths to prevent buffer overflow in PDF rendering (e.g., description max 500 chars, notes max 2000 chars).
  > 4. Use `pdf-lib`'s `drawText()` only with sanitized strings — never interpolate raw user input into PDF operators.
  > ```typescript
  > function sanitizePDFText(input: string, maxLength = 500): string {
  >   return input
  >     .replace(/<[^>]*>/g, '') // strip HTML tags
  >     .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars
  >     .slice(0, maxLength);
  > }
  > ```

  - Layout:
    - **Header**: Business name, ABN, address (from businessProfile), logo placeholder
    - **Invoice details box**: Invoice number, issue date, due date, status
    - **Bill To**: Customer business name, contact, address, ABN
    - **Line items table**: Description | Qty | Unit Price | GST | Amount
    - **Totals section**: Subtotal, GST (10%), Total, Amount Paid, Amount Due
    - **Footer**: Payment terms, bank details placeholder, notes
  - Font: Helvetica (built-in PDF font, no external files needed)
  - Colors: Dark text (#1a1b26), gold accent (#FFCC00) for headers/borders

- [ ] `saveInvoicePDF(invoiceId: string, pdfBuffer: Buffer): Promise<string>`
  - Save PDF to `server/uploads/invoices/{invoiceId}.pdf`
  - Create `uploads/invoices/` directory if it doesn't exist
  - Return relative file path
  - Update invoice record with pdfPath

- [ ] `getInvoicePDFPath(invoiceId: string): string`
  - Return the expected file path for an invoice PDF
  - `uploads/invoices/{invoiceId}.pdf`

**PDF Layout Specification**:

```
┌─────────────────────────────────────────────┐
│  [Logo]    BUSINESS NAME                    │
│            ABN: XX XXX XXX XXX              │
│            Address Line 1                    │
│            City, State Postcode              │
├─────────────────────────────────────────────┤
│  TAX INVOICE                                │
│                                             │
│  Invoice #: INV-000001    Date: DD/MM/YYYY  │
│  Due Date: DD/MM/YYYY     Terms: Net 30     │
├─────────────────────────────────────────────┤
│  BILL TO:                                   │
│  Customer Business Name                      │
│  ABN: XX XXX XXX XXX                        │
│  Address, City, State Postcode              │
├─────────────────────────────────────────────┤
│  Description    | Qty | Unit Price | Amount │
│  ─────────────  | ─── | ────────── | ────── │
│  Line item 1    |  1  |   $100.00  | $100.00│
│  Line item 2    |  2  |    $50.00  | $100.00│
├─────────────────────────────────────────────┤
│                          Subtotal: $200.00  │
│                          GST (10%): $20.00  │
│                     ─────────────────────── │
│                          TOTAL:    $220.00  │
│                          Paid:      $0.00   │
│                          DUE:      $220.00  │
├─────────────────────────────────────────────┤
│  Payment Terms: Net 30 days                 │
│  Notes: Thank you for your business         │
└─────────────────────────────────────────────┘
```

**Currency formatting**:
- Use `Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })` equivalent
- Or manual: `$${(cents / 100).toFixed(2)}`

**pdf-lib usage pattern**:
```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const pdfDoc = await PDFDocument.create();
const page = pdfDoc.addPage([595.28, 841.89]); // A4
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

// Draw text
page.drawText('TAX INVOICE', { x: 50, y: 780, size: 24, font: boldFont });

// Draw lines
page.drawLine({ start: { x: 50, y: 750 }, end: { x: 545, y: 750 }, thickness: 1 });

// Save
const pdfBytes = await pdfDoc.save();
return Buffer.from(pdfBytes);
```

**Dependencies to add** (if not already in package.json):
```bash
npm install pdf-lib
```

## Verification
- [ ] PDF generates without errors for a sample invoice
- [ ] PDF is valid (can be opened in a PDF reader)
- [ ] All invoice data appears correctly (numbers, dates, amounts)
- [ ] Currency formatted as AUD with 2 decimal places
- [ ] GST breakdown shown separately
- [ ] File saved to uploads/invoices/ directory
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-04`

## Dependencies
- **Agent 3**: Must define `InvoiceWithLines` type and invoice data structures
- **Package**: `pdf-lib` must be installed
