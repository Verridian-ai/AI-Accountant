/**
 * Invoice PDF — Input sanitization and drawing helpers.
 */

import type { PDFFont, PDFPage } from 'pdf-lib';
import { MARGIN_LEFT, PAGE_WIDTH, MARGIN_RIGHT, LIGHT_GREY, DARK_TEXT } from './types.js';

// ============================================================================
// Input Sanitization
// ============================================================================

export function sanitizePDFText(input: unknown, maxLength = 500): string {
  if (input == null) return '';
  const str = String(input);
  return (
    str
      .replace(/<[^>]*>/g, '') // strip HTML tags
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars
      .slice(0, maxLength)
  );
}

export function formatCurrency(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return `$${value.toFixed(2)}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return sanitizePDFText(dateStr, 20);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatABN(abn: string | null | undefined): string {
  if (!abn) return '';
  const digits = abn.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  return sanitizePDFText(abn, 20);
}

// ============================================================================
// PDF Drawing Helpers
// ============================================================================

export function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = DARK_TEXT,
): void {
  page.drawText(text, { x, y, size, font, color });
}

export function drawRightAlignedText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = DARK_TEXT,
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, size, font, color });
}

export function drawHorizontalLine(
  page: PDFPage,
  y: number,
  startX = MARGIN_LEFT,
  endX = PAGE_WIDTH - MARGIN_RIGHT,
  thickness = 0.5,
  color = LIGHT_GREY,
): void {
  page.drawLine({
    start: { x: startX, y },
    end: { x: endX, y },
    thickness,
    color,
  });
}

// Wraps text to fit within maxWidth, returning array of lines
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}
