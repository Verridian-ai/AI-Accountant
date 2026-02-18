/**
 * QIF Statement Parser
 *
 * Parses QIF (Quicken Interchange Format) bank statement files.
 * QIF is a plain-text format for exchanging financial data.
 *
 * QIF format reference: https://en.wikipedia.org/wiki/Quicken_Interchange_Format
 */

import type { QIFType, QIFTransaction, QIFAccountInfo, QIFParseResult } from './qif-types.js';
import {
  normalizeQIFType,
  mapQIFTypeToAccountType,
  extractAccountInfo,
  extractTransactions,
  convertTransaction,
} from './qif-helpers.js';

export type { QIFType, QIFTransaction, QIFAccountInfo, QIFParseResult };

// ============================================================================
// QIF PARSER CLASS
// ============================================================================

export class QIFStatementParser {
  private dateFormatPreference: 'US' | 'AU' | 'auto' = 'auto';

  /**
   * Set date format preference
   * US: MM/DD/YY, AU/EU: DD/MM/YY
   */
  setDateFormatPreference(preference: 'US' | 'AU' | 'auto'): void {
    this.dateFormatPreference = preference;
  }

  /**
   * Parse QIF file content
   */
  async parse(content: string): Promise<QIFParseResult> {
    const result: QIFParseResult = {
      success: false,
      transactions: [],
      accountType: 'unknown',
      accountName: null,
      qifType: null,
      errors: [],
      warnings: [],
      metadata: {
        rowCount: 0,
        parsedCount: 0,
        skippedCount: 0,
      },
    };

    try {
      // Normalize content
      const normalizedContent = this.normalizeContent(content);

      // Check if valid QIF
      if (!this.isValidQIF(normalizedContent)) {
        result.errors.push('Invalid QIF file format');
        return result;
      }

      // Extract account type from header
      const typeMatch = normalizedContent.match(/^!Type:(\S+)/im);
      if (typeMatch) {
        result.qifType = normalizeQIFType(typeMatch[1]);
        result.accountType = mapQIFTypeToAccountType(result.qifType);
      }

      // Extract account header if present
      const accountInfo = extractAccountInfo(normalizedContent);
      if (accountInfo) {
        result.accountName = accountInfo.name || null;
        if (accountInfo.type) {
          result.qifType = accountInfo.type;
          result.accountType = mapQIFTypeToAccountType(accountInfo.type);
        }
      }

      // Parse transactions
      const rawTransactions = extractTransactions(normalizedContent);
      result.metadata.rowCount = rawTransactions.length;

      // Detect date format from sample of transactions
      const dateFormat = this.detectDateFormat(rawTransactions);

      for (let i = 0; i < rawTransactions.length; i++) {
        const rawTx = rawTransactions[i];

        try {
          const transaction = convertTransaction(rawTx, i, dateFormat);
          if (transaction) {
            result.transactions.push(transaction);
            result.metadata.parsedCount++;
          } else {
            result.metadata.skippedCount++;
            result.warnings.push(`Transaction ${i + 1}: Skipped - missing required fields`);
          }
        } catch (error) {
          result.warnings.push(
            `Transaction ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`,
          );
          result.metadata.skippedCount++;
        }
      }

      // Calculate date range
      if (result.transactions.length > 0) {
        const dates = result.transactions
          .map((t) => t.date)
          .filter((d) => d)
          .sort();

        result.metadata.dateRange = {
          start: dates[0],
          end: dates[dates.length - 1],
        };
      }

      result.success = result.transactions.length > 0 || result.errors.length === 0;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Check if content is a valid QIF file
   */
  isValidQIF(content: string): boolean {
    // QIF files start with !Type: or !Account or !Option
    const hasTypeHeader = /^!Type:/im.test(content);
    const hasAccountHeader = /^!Account/im.test(content);
    const hasOptionHeader = /^!Option:/im.test(content);

    // Also check for transaction markers
    const hasTransactionMarkers = /^\^/m.test(content);

    return hasTypeHeader || hasAccountHeader || (hasOptionHeader && hasTransactionMarkers);
  }

  /**
   * Normalize QIF content (remove BOM, normalize line endings)
   */
  private normalizeContent(content: string): string {
    let normalized = content.replace(/^\uFEFF/, '');
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized;
  }

  /**
   * Detect the date format used in the QIF file by heuristic scoring
   */
  private detectDateFormat(transactions: QIFTransaction[]): 'US' | 'AU' {
    if (this.dateFormatPreference !== 'auto') {
      return this.dateFormatPreference;
    }

    // Sample up to 10 transactions
    const sample = transactions.slice(0, 10);
    let usScore = 0;
    let auScore = 0;

    for (const tx of sample) {
      const parts = tx.date.split(/[/.-]/);
      if (parts.length >= 2) {
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);

        if (first > 12) {
          auScore += 2; // first part > 12 → must be day (AU: DD/MM)
        } else if (second > 12) {
          usScore += 2; // second part > 12 → must be day (US: MM/DD)
        } else if (first > second) {
          auScore += 1;
        } else if (second > first) {
          usScore += 1;
        }
      }
    }

    // Default to AU format for Australian banks
    return usScore > auScore ? 'US' : 'AU';
  }

  /**
   * Get file extensions supported by this parser
   */
  static getSupportedExtensions(): string[] {
    return ['.qif'];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const qifParser = new QIFStatementParser();
