/**
 * OFX Parser Helpers
 *
 * Parsing utilities for OFX/QFX bank statement files.
 * Handles date parsing, amount conversion, tag extraction,
 * account type mapping, and transaction block parsing.
 */

import { ParsedTransaction, AccountType } from '../types.js';
import { OFXTransaction, OFXAccountInfo } from './ofx-types.js';

/**
 * Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
 */
export function parseOFXDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Remove any timezone info [...] at the end
  const cleanDate = dateStr.replace(/\[.*\]$/, '').trim();

  // YYYYMMDDHHMMSS or YYYYMMDDHHMMSS.XXX
  const fullMatch = cleanDate.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?(?:\.\d+)?$/);
  if (fullMatch) {
    const [, year, month, day] = fullMatch;
    return `${year}-${month}-${day}`;
  }

  // YYYYMMDD
  const shortMatch = cleanDate.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (shortMatch) {
    const [, year, month, day] = shortMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Parse amount string to cents
 */
export function parseOFXAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '') {
    return 0;
  }

  // Remove any non-numeric characters except minus and decimal point
  const cleaned = amountStr.replace(/[^0-9.-]/g, '').trim();

  const value = parseFloat(cleaned);
  if (isNaN(value)) {
    return 0;
  }

  return Math.round(value * 100);
}

/**
 * Extract a single tag value from content
 */
export function extractOFXTag(content: string, tag: string): string | null {
  // Try XML style first
  const xmlMatch = content.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
  if (xmlMatch) {
    return xmlMatch[1].trim();
  }

  // Try SGML style
  const sgmlMatch = content.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'));
  return sgmlMatch ? sgmlMatch[1].trim() : null;
}

/**
 * Map OFX account type to internal type
 */
export function mapOFXAccountType(ofxType?: string): AccountType {
  if (!ofxType) return 'unknown';

  const typeMap: Record<string, AccountType> = {
    CHECKING: 'transaction',
    SAVINGS: 'savings',
    MONEYMRKT: 'savings',
    CREDITLINE: 'credit',
    CD: 'term_deposit',
  };

  return typeMap[ofxType.toUpperCase()] || 'unknown';
}

/**
 * Parse account block content
 */
export function parseOFXAccountBlock(block: string, type: string): OFXAccountInfo {
  const getValue = (tag: string): string | undefined => {
    const match = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'));
    return match ? match[1].trim() : undefined;
  };

  return {
    bankid: getValue('BANKID'),
    branchid: getValue('BRANCHID'),
    acctid: getValue('ACCTID') || getValue('ACCTKEY') || 'UNKNOWN',
    accttype: getValue('ACCTTYPE') || (type === 'credit' ? 'CREDITLINE' : undefined),
    currency: getValue('CURDEF'),
  };
}

/**
 * Parse a single transaction block
 */
export function parseOFXTransactionBlock(block: string): OFXTransaction | null {
  const getValue = (tag: string): string | undefined => {
    const xmlMatch = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
    if (xmlMatch) {
      return xmlMatch[1].trim();
    }

    const sgmlMatch = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'));
    return sgmlMatch ? sgmlMatch[1].trim() : undefined;
  };

  const trntype = getValue('TRNTYPE');
  const dtposted = getValue('DTPOSTED');
  const trnamt = getValue('TRNAMT');
  const fitid = getValue('FITID');

  if (!dtposted || !trnamt) {
    return null;
  }

  return {
    trntype: trntype || 'OTHER',
    dtposted,
    trnamt,
    fitid: fitid || `${dtposted}-${trnamt}`,
    checknum: getValue('CHECKNUM'),
    refnum: getValue('REFNUM'),
    name: getValue('NAME'),
    memo: getValue('MEMO'),
    sic: getValue('SIC'),
    payeeid: getValue('PAYEEID'),
  };
}

/**
 * Convert OFX transaction to standard format
 */
export function convertOFXTransaction(tx: OFXTransaction, index: number): ParsedTransaction | null {
  const date = parseOFXDate(tx.dtposted);
  if (!date) {
    throw new Error(`Invalid date format: ${tx.dtposted}`);
  }

  const amountCents = parseOFXAmount(tx.trnamt);

  let description = '';
  if (tx.name) {
    description = tx.name;
  }
  if (tx.memo && tx.memo !== tx.name) {
    description = description ? `${description} - ${tx.memo}` : tx.memo;
  }
  if (!description) {
    description = tx.trntype || 'Transaction';
  }

  let reference: string | undefined;
  if (tx.checknum) {
    reference = `Check #${tx.checknum}`;
  } else if (tx.refnum) {
    reference = tx.refnum;
  } else if (tx.fitid) {
    reference = tx.fitid;
  }

  return {
    date,
    description: description
      .replace(/\s+/g, ' ')
      .replace(/^\s*-\s*/, '')
      .trim(),
    amount: amountCents,
    reference,
    rawDate: tx.dtposted,
    rawAmount: tx.trnamt,
    rawDescription: `${tx.name || ''} ${tx.memo || ''}`.trim(),
    lineNumber: index + 1,
  };
}
