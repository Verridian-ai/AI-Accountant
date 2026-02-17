/**
 * CBA Statement Line Helpers
 *
 * Utilities for detecting and classifying lines in CBA bank statements:
 * date detection, skippable line detection, and statement period extraction.
 */

import { MONTH_MAP } from './cba-config';

/**
 * Check if a line starts with DD MMM (a date pattern)
 */
export function startsWithDate(
  line: string,
): { dayStr: string; monthStr: string; rest: string } | null {
  const m = line.match(/^(\d{1,2})\s+(\w{3})(.*)/);
  if (!m) return null;
  if (!MONTH_MAP[m[2].toLowerCase()]) return null;
  return { dayStr: m[1], monthStr: m[2], rest: m[3] };
}

/**
 * Check if a line is a page header/footer/non-transaction line
 */
export function isSkippableLine(line: string): boolean {
  if (/^Statement\s+\d+/i.test(line)) return true;
  if (/^\(Page\s+\d+/i.test(line)) return true;
  if (/^Account\s+Number/i.test(line)) return true;
  if (/^\d{4}\.\d+\.\d+/i.test(line)) return true; // barcode
  if (/^SL\.R3\./i.test(line)) return true;
  if (/^V\d{2}\.\d{2}\.\d{2}/i.test(line)) return true;
  if (/^06\s+\d{4}\s+\d{8}/i.test(line)) return true;
  if (/^Date$/i.test(line)) return true;
  if (/^TransactionDebitCreditBalance/i.test(line)) return true;
  if (/OPENING\s+BALANCE/i.test(line)) return true;
  if (/CLOSING\s+BALANCE/i.test(line)) return true;
  if (/^Opening\s+balance.*Total/i.test(line)) return true;
  if (/^\$[\d,]+\.\d{2}(CR|DR)?\$[\d,]+/i.test(line)) return true; // summary line
  if (/^Fee\s+Summary/i.test(line)) return true;
  if (/^Important\s+Information/i.test(line)) return true;
  if (/^Transaction\s+Summary/i.test(line)) return true;
  if (/^Your\s+Statement/i.test(line)) return true;
  if (/^Enquiries/i.test(line)) return true;
  if (/^13\s+\d{4}/i.test(line)) return true; // phone number
  if (/^Name:/i.test(line)) return true;
  if (/^Note:/i.test(line)) return true;
  if (/^If\s+this\s+account/i.test(line)) return true;
  if (/^The\s+date\s+of\s+transactions/i.test(line)) return true;
  if (/^appears\s+on/i.test(line)) return true;
  return false;
}

/**
 * Extract statement period from CBA PDF text
 */
export function extractStatementPeriod(pdfText: string): {
  startDate: string;
  endDate: string;
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
} | null {
  // "Period1 Oct 2023 - 30 Dec 2023"
  const periodMatch = pdfText.match(
    /Period\s*(\d{1,2})\s+(\w{3})\s+(\d{4})\s*[-\u2013]\s*(\d{1,2})\s+(\w{3})\s+(\d{4})/i,
  );
  if (periodMatch) {
    const [, sd, sm, sy, ed, em, ey] = periodMatch;
    const startMonth = parseInt(MONTH_MAP[sm.toLowerCase()] || '0');
    const endMonth = parseInt(MONTH_MAP[em.toLowerCase()] || '0');
    return {
      startDate: `${sy}-${String(startMonth).padStart(2, '0')}-${sd.padStart(2, '0')}`,
      endDate: `${ey}-${String(endMonth).padStart(2, '0')}-${ed.padStart(2, '0')}`,
      startYear: parseInt(sy),
      startMonth,
      endYear: parseInt(ey),
      endMonth,
    };
  }

  const slashMatch = pdfText.match(
    /Period[\s:]*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-\u2013]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
  );
  if (slashMatch) {
    const [, sd, sm, sy, ed, em, ey] = slashMatch;
    return {
      startDate: `${sy}-${sm.padStart(2, '0')}-${sd.padStart(2, '0')}`,
      endDate: `${ey}-${em.padStart(2, '0')}-${ed.padStart(2, '0')}`,
      startYear: parseInt(sy),
      startMonth: parseInt(sm),
      endYear: parseInt(ey),
      endMonth: parseInt(em),
    };
  }

  return null;
}
