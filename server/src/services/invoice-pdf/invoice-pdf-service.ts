/**
 * Invoice PDF Service — Wave 7
 * Generates professional A4 tax invoice PDFs using pdf-lib (pure JS, no Chromium).
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import type { InvoiceWithLines } from '../invoicing.js';
import type { BusinessProfile } from '../../schema.js';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  GOLD,
  DARK_TEXT,
  GREY_TEXT,
  TITLE_SIZE,
  BODY_SIZE,
  HEADING_SIZE,
} from './types.js';
import {
  sanitizePDFText,
  formatDate,
  formatABN,
  drawText,
  drawRightAlignedText,
  drawHorizontalLine,
} from './helpers.js';
import { drawLineItems, drawTotals, drawFooter } from './pdf-sections.js';

// ============================================================================
// InvoicePDFService
// ============================================================================

export class InvoicePDFService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads', 'invoices');
  }

  /**
   * Generate a professional A4 tax invoice PDF.
   */
  async generateInvoicePDF(
    invoiceData: InvoiceWithLines,
    businessProfile?: BusinessProfile,
  ): Promise<Buffer> {
    const { invoice, lines, customer } = invoiceData;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const rightEdge = PAGE_WIDTH - MARGIN_RIGHT;
    let y = PAGE_HEIGHT - 50;

    // -- Header: Business Details --
    const bizName = sanitizePDFText(businessProfile?.businessName ?? 'Your Business', 100);
    drawText(page, bizName, MARGIN_LEFT, y, boldFont, 16, DARK_TEXT);
    y -= 18;

    if (businessProfile?.abn) {
      drawText(
        page,
        `ABN: ${formatABN(businessProfile.abn)}`,
        MARGIN_LEFT,
        y,
        font,
        BODY_SIZE,
        GREY_TEXT,
      );
      y -= 14;
    }

    // Gold accent line under header
    y -= 4;
    drawHorizontalLine(page, y, MARGIN_LEFT, rightEdge, 2, GOLD);
    y -= 20;

    // -- TAX INVOICE Title --
    drawText(page, 'TAX INVOICE', MARGIN_LEFT, y, boldFont, TITLE_SIZE, GOLD);
    y -= 30;

    // -- Invoice Details (left) + Status (right) --
    y = this.drawInvoiceDetails(page, y, invoice, font, boldFont, rightEdge);

    // -- Bill To --
    y = this.drawBillTo(page, y, customer, font, boldFont);

    // -- Line Items Table --
    y = drawLineItems(page, pdfDoc, y, lines, font, boldFont, rightEdge);

    // -- Totals Section --
    y = drawTotals(page, y, invoice, font, boldFont, rightEdge);

    // -- Footer: Payment Terms & Notes --
    drawFooter(page, y, invoice, font, boldFont, rightEdge);

    // -- Bottom accent line --
    drawHorizontalLine(page, 30, MARGIN_LEFT, rightEdge, 2, GOLD);

    // -- Generate PDF bytes --
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private drawInvoiceDetails(
    page: import('pdf-lib').PDFPage,
    startY: number,
    invoice: InvoiceWithLines['invoice'],
    font: import('pdf-lib').PDFFont,
    boldFont: import('pdf-lib').PDFFont,
    rightEdge: number,
  ): number {
    let y = startY;
    const invoiceNumber = sanitizePDFText(invoice?.invoiceNumber ?? '', 50);
    const issueDate = formatDate(invoice?.issueDate);
    const dueDate = formatDate(invoice?.dueDate);
    const status = sanitizePDFText(invoice?.status ?? 'draft', 20).toUpperCase();

    const detailsStartY = y;

    drawText(page, 'Invoice Number:', MARGIN_LEFT, y, boldFont, BODY_SIZE, GREY_TEXT);
    drawText(page, invoiceNumber, MARGIN_LEFT + 95, y, font, BODY_SIZE, DARK_TEXT);
    y -= 16;

    drawText(page, 'Issue Date:', MARGIN_LEFT, y, boldFont, BODY_SIZE, GREY_TEXT);
    drawText(page, issueDate, MARGIN_LEFT + 95, y, font, BODY_SIZE, DARK_TEXT);
    y -= 16;

    drawText(page, 'Due Date:', MARGIN_LEFT, y, boldFont, BODY_SIZE, GREY_TEXT);
    drawText(page, dueDate, MARGIN_LEFT + 95, y, font, BODY_SIZE, DARK_TEXT);
    y -= 16;

    const terms = invoice?.termsAndConditions
      ? sanitizePDFText(invoice.termsAndConditions, 50)
      : `Net ${invoice?.dueDate && invoice?.issueDate ? Math.round((new Date(invoice.dueDate).getTime() - new Date(invoice.issueDate).getTime()) / 86400000) : 30} days`;
    drawText(page, 'Terms:', MARGIN_LEFT, y, boldFont, BODY_SIZE, GREY_TEXT);
    drawText(page, terms, MARGIN_LEFT + 95, y, font, BODY_SIZE, DARK_TEXT);

    // Status badge on the right
    drawRightAlignedText(
      page,
      `Status: ${status}`,
      rightEdge,
      detailsStartY,
      boldFont,
      BODY_SIZE,
      GREY_TEXT,
    );

    y -= 24;
    drawHorizontalLine(page, y);
    y -= 20;

    return y;
  }

  private drawBillTo(
    page: import('pdf-lib').PDFPage,
    startY: number,
    customer: InvoiceWithLines['customer'],
    font: import('pdf-lib').PDFFont,
    boldFont: import('pdf-lib').PDFFont,
  ): number {
    let y = startY;
    drawText(page, 'BILL TO', MARGIN_LEFT, y, boldFont, HEADING_SIZE, GOLD);
    y -= 18;

    if (customer) {
      const custName = sanitizePDFText(customer.businessName ?? customer.contactName ?? '', 100);
      if (custName) {
        drawText(page, custName, MARGIN_LEFT, y, boldFont, BODY_SIZE, DARK_TEXT);
        y -= 14;
      }

      if (customer.contactName && customer.businessName) {
        drawText(
          page,
          `Attn: ${sanitizePDFText(customer.contactName, 100)}`,
          MARGIN_LEFT,
          y,
          font,
          BODY_SIZE,
          DARK_TEXT,
        );
        y -= 14;
      }

      if (customer.abn) {
        drawText(
          page,
          `ABN: ${formatABN(customer.abn)}`,
          MARGIN_LEFT,
          y,
          font,
          BODY_SIZE,
          GREY_TEXT,
        );
        y -= 14;
      }

      const addressParts: string[] = [];
      if (customer.address) addressParts.push(sanitizePDFText(customer.address, 200));
      const cityLine = [customer.city, customer.state, customer.postcode].filter(Boolean).join(' ');
      if (cityLine) addressParts.push(sanitizePDFText(cityLine, 100));
      for (const part of addressParts) {
        drawText(page, part, MARGIN_LEFT, y, font, BODY_SIZE, DARK_TEXT);
        y -= 14;
      }

      if (customer.email) {
        drawText(
          page,
          sanitizePDFText(customer.email, 100),
          MARGIN_LEFT,
          y,
          font,
          BODY_SIZE,
          GREY_TEXT,
        );
        y -= 14;
      }
    } else {
      drawText(page, 'Customer details not available', MARGIN_LEFT, y, font, BODY_SIZE, GREY_TEXT);
      y -= 14;
    }

    y -= 10;
    drawHorizontalLine(page, y);
    y -= 20;

    return y;
  }

  /**
   * Save a generated PDF to the uploads/invoices/ directory.
   * Returns the relative file path.
   */
  async saveInvoicePDF(invoiceId: string, pdfBuffer: Buffer): Promise<string> {
    // Sanitize invoiceId to prevent path traversal
    const safeId = invoiceId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) {
      throw new Error('Invalid invoice ID');
    }

    fs.mkdirSync(this.uploadsDir, { recursive: true });

    const fileName = `${safeId}.pdf`;
    const filePath = path.join(this.uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    return `uploads/invoices/${fileName}`;
  }

  /**
   * Get the expected file path for an invoice PDF.
   */
  getInvoicePDFPath(invoiceId: string): string {
    const safeId = invoiceId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `uploads/invoices/${safeId}.pdf`;
  }
}

export const invoicePDFService = new InvoicePDFService();
