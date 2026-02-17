/**
 * Invoice PDF — Section rendering functions (line items, totals, footer).
 */

import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import type { InvoiceWithLines } from '../invoicing.js';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN_LEFT,
  CONTENT_WIDTH,
  GOLD,
  DARK_TEXT,
  GREY_TEXT,
  LIGHT_GREY,
  BODY_SIZE,
  SMALL_SIZE,
} from './types.js';
import {
  sanitizePDFText,
  formatCurrency,
  drawText,
  drawRightAlignedText,
  drawHorizontalLine,
  wrapText,
} from './helpers.js';

/**
 * Draw the line items table on the invoice page.
 * Returns the updated Y position after the table.
 */
export function drawLineItems(
  page: PDFPage,
  pdfDoc: PDFDocument,
  startY: number,
  lines: InvoiceWithLines['lines'],
  font: PDFFont,
  boldFont: PDFFont,
  rightEdge: number,
): number {
  let y = startY;
  // Column positions
  const colDesc = MARGIN_LEFT;
  const colQty = 320;
  const colUnitPrice = 380;
  const colGST = 450;
  const colAmount = rightEdge;

  // Table header
  drawText(page, 'Description', colDesc, y, boldFont, BODY_SIZE, DARK_TEXT);
  drawRightAlignedText(page, 'Qty', colQty + 30, y, boldFont, BODY_SIZE, DARK_TEXT);
  drawRightAlignedText(page, 'Unit Price', colUnitPrice + 50, y, boldFont, BODY_SIZE, DARK_TEXT);
  drawRightAlignedText(page, 'GST', colGST + 35, y, boldFont, BODY_SIZE, DARK_TEXT);
  drawRightAlignedText(page, 'Amount', colAmount, y, boldFont, BODY_SIZE, DARK_TEXT);
  y -= 8;
  drawHorizontalLine(page, y, MARGIN_LEFT, rightEdge, 1, GOLD);
  y -= 14;

  // Table rows
  const lineItems = Array.isArray(lines) ? lines : [];
  for (const line of lineItems) {
    // Check if we need a new page
    if (y < 150) {
      const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawText(newPage, '... continued', MARGIN_LEFT, PAGE_HEIGHT - 50, font, BODY_SIZE, GREY_TEXT);
      break;
    }

    const desc = sanitizePDFText(line.description ?? '', 200);
    const qty = Number(line.quantity ?? 1);
    const unitPriceCents = Number(line.unitPrice ?? 0);
    const gstAmountCents = Number(line.gstAmount ?? 0);
    const amountCents = Number(line.amount ?? 0);

    // Wrap long descriptions
    const descLines = wrapText(desc, font, BODY_SIZE, colQty - colDesc - 10);
    drawText(page, descLines[0], colDesc, y, font, BODY_SIZE, DARK_TEXT);
    drawRightAlignedText(page, qty.toString(), colQty + 30, y, font, BODY_SIZE, DARK_TEXT);
    drawRightAlignedText(
      page,
      formatCurrency(unitPriceCents),
      colUnitPrice + 50,
      y,
      font,
      BODY_SIZE,
      DARK_TEXT,
    );
    drawRightAlignedText(
      page,
      formatCurrency(gstAmountCents),
      colGST + 35,
      y,
      font,
      BODY_SIZE,
      DARK_TEXT,
    );
    drawRightAlignedText(
      page,
      formatCurrency(amountCents),
      colAmount,
      y,
      font,
      BODY_SIZE,
      DARK_TEXT,
    );
    y -= 14;

    // Draw additional description lines if wrapped
    for (let i = 1; i < descLines.length; i++) {
      drawText(page, descLines[i], colDesc, y, font, BODY_SIZE, DARK_TEXT);
      y -= 14;
    }

    // Light separator between rows
    drawHorizontalLine(page, y + 4, MARGIN_LEFT, rightEdge, 0.3, LIGHT_GREY);
  }

  y -= 10;
  drawHorizontalLine(page, y, MARGIN_LEFT, rightEdge, 1, GOLD);
  y -= 20;

  return y;
}

/**
 * Draw the totals section on the invoice page.
 * Returns the updated Y position after the totals.
 */
export function drawTotals(
  page: PDFPage,
  startY: number,
  invoice: InvoiceWithLines['invoice'],
  font: PDFFont,
  boldFont: PDFFont,
  rightEdge: number,
): number {
  let y = startY;
  const totalsLabelX = 380;
  const totalsValueX = rightEdge;

  const subtotalCents = Number(invoice?.subtotal ?? 0);
  const gstTotalCents = Number(invoice?.gstAmount ?? 0);
  const totalCents = Number(invoice?.totalAmount ?? 0);
  const paidCents = Number(invoice?.amountPaid ?? 0);
  const dueCents = Number(invoice?.amountDue ?? 0);

  drawRightAlignedText(page, 'Subtotal:', totalsLabelX + 50, y, font, BODY_SIZE, DARK_TEXT);
  drawRightAlignedText(
    page,
    formatCurrency(subtotalCents),
    totalsValueX,
    y,
    font,
    BODY_SIZE,
    DARK_TEXT,
  );
  y -= 16;

  drawRightAlignedText(page, 'GST (10%):', totalsLabelX + 50, y, font, BODY_SIZE, DARK_TEXT);
  drawRightAlignedText(
    page,
    formatCurrency(gstTotalCents),
    totalsValueX,
    y,
    font,
    BODY_SIZE,
    DARK_TEXT,
  );
  y -= 8;
  drawHorizontalLine(page, y, totalsLabelX - 20, rightEdge, 0.5, DARK_TEXT);
  y -= 16;

  drawRightAlignedText(page, 'TOTAL:', totalsLabelX + 50, y, boldFont, 12, DARK_TEXT);
  drawRightAlignedText(page, formatCurrency(totalCents), totalsValueX, y, boldFont, 12, DARK_TEXT);
  y -= 18;

  drawRightAlignedText(page, 'Paid:', totalsLabelX + 50, y, font, BODY_SIZE, GREY_TEXT);
  drawRightAlignedText(
    page,
    formatCurrency(paidCents),
    totalsValueX,
    y,
    font,
    BODY_SIZE,
    GREY_TEXT,
  );
  y -= 16;

  drawRightAlignedText(page, 'AMOUNT DUE:', totalsLabelX + 50, y, boldFont, 12, GOLD);
  drawRightAlignedText(page, formatCurrency(dueCents), totalsValueX, y, boldFont, 12, GOLD);
  y -= 30;

  return y;
}

/**
 * Draw the footer section (payment terms and notes) on the invoice page.
 */
export function drawFooter(
  page: PDFPage,
  startY: number,
  invoice: InvoiceWithLines['invoice'],
  font: PDFFont,
  boldFont: PDFFont,
  rightEdge: number,
): void {
  let y = startY;
  drawHorizontalLine(page, y, MARGIN_LEFT, rightEdge, 0.5, LIGHT_GREY);
  y -= 16;

  if (invoice?.termsAndConditions) {
    drawText(page, 'Payment Terms', MARGIN_LEFT, y, boldFont, SMALL_SIZE, GREY_TEXT);
    y -= 12;
    const termsText = sanitizePDFText(invoice.termsAndConditions, 500);
    const termsLines = wrapText(termsText, font, SMALL_SIZE, CONTENT_WIDTH);
    for (const tl of termsLines) {
      drawText(page, tl, MARGIN_LEFT, y, font, SMALL_SIZE, DARK_TEXT);
      y -= 12;
    }
    y -= 6;
  }

  if (invoice?.notes) {
    drawText(page, 'Notes', MARGIN_LEFT, y, boldFont, SMALL_SIZE, GREY_TEXT);
    y -= 12;
    const notesText = sanitizePDFText(invoice.notes, 2000);
    const notesLines = wrapText(notesText, font, SMALL_SIZE, CONTENT_WIDTH);
    for (const nl of notesLines) {
      if (y < 40) break; // don't overflow past page bottom
      drawText(page, nl, MARGIN_LEFT, y, font, SMALL_SIZE, DARK_TEXT);
      y -= 12;
    }
  }
}
