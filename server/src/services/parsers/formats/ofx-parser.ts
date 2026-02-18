/**
 * OFX/QFX Statement Parser
 *
 * Parses OFX (Open Financial Exchange) and QFX (Quicken Financial Exchange)
 * bank statement files. These are XML-like files exported by most banks.
 *
 * OFX format reference: https://www.ofx.net/
 */

import type { OFXTransaction, OFXAccountInfo, OFXStatement, OFXParseResult } from './ofx-types.js';
import {
  parseOFXDate,
  parseOFXAmount,
  extractOFXTag,
  mapOFXAccountType,
  parseOFXAccountBlock,
  parseOFXTransactionBlock,
  convertOFXTransaction,
} from './ofx-helpers.js';

export type { OFXTransaction, OFXAccountInfo, OFXStatement, OFXParseResult };

// ============================================================================
// OFX PARSER CLASS
// ============================================================================

export class OFXStatementParser {
  /**
   * Parse OFX/QFX file content
   */
  async parse(content: string): Promise<OFXParseResult> {
    const result: OFXParseResult = {
      success: false,
      transactions: [],
      accountNumber: null,
      accountType: 'unknown',
      bankId: null,
      currency: null,
      errors: [],
      warnings: [],
      metadata: {
        rowCount: 0,
        parsedCount: 0,
        skippedCount: 0,
      },
    };

    try {
      const normalizedContent = this.normalizeContent(content);

      if (!this.isValidOFX(normalizedContent)) {
        result.errors.push('Invalid OFX/QFX file format');
        return result;
      }

      const accountInfo = this.extractAccountInfo(normalizedContent);
      if (accountInfo) {
        result.accountNumber = accountInfo.acctid;
        result.bankId = accountInfo.bankid || null;
        result.currency = accountInfo.currency || 'AUD';
        result.accountType = mapOFXAccountType(accountInfo.accttype);
      }

      const period = this.extractStatementPeriod(normalizedContent);
      if (period) {
        result.statementPeriod = period;
      }

      const balances = this.extractBalances(normalizedContent);
      if (balances.ledger !== undefined || balances.available !== undefined) {
        result.balances = balances;
      }

      const rawTransactions = this.extractTransactions(normalizedContent);
      result.metadata.rowCount = rawTransactions.length;

      for (let i = 0; i < rawTransactions.length; i++) {
        const rawTx = rawTransactions[i];

        try {
          const transaction = convertOFXTransaction(rawTx, i);
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
   * Check if content is a valid OFX file
   */
  isValidOFX(content: string): boolean {
    const hasOFXHeader = /OFXHEADER/i.test(content);
    const hasOFXTag = /<\?OFX|<OFX>/i.test(content);
    const hasOFXContent = /<STMTTRN>|<BANKACCTFROM>|<CCACCTFROM>/i.test(content);
    return hasOFXHeader || hasOFXTag || hasOFXContent;
  }

  /**
   * Normalize OFX content (remove BOM, normalize line endings)
   */
  private normalizeContent(content: string): string {
    let normalized = content.replace(/^\uFEFF/, '');
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return normalized;
  }

  /**
   * Extract account information from OFX content
   */
  private extractAccountInfo(content: string): OFXAccountInfo | null {
    const bankAcctMatch =
      content.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i) ||
      content.match(/<BANKACCTFROM>([\s\S]*?)(?=<(?:BANKTRANLIST|LEDGERBAL|AVAILBAL))/i);
    if (bankAcctMatch) return parseOFXAccountBlock(bankAcctMatch[1], 'bank');

    const ccAcctMatch =
      content.match(/<CCACCTFROM>([\s\S]*?)<\/CCACCTFROM>/i) ||
      content.match(/<CCACCTFROM>([\s\S]*?)(?=<(?:BANKTRANLIST|LEDGERBAL|AVAILBAL|CCSTMTRS))/i);
    if (ccAcctMatch) return parseOFXAccountBlock(ccAcctMatch[1], 'credit');

    const invAcctMatch = content.match(/<INVACCTFROM>([\s\S]*?)<\/INVACCTFROM>/i);
    if (invAcctMatch) return parseOFXAccountBlock(invAcctMatch[1], 'investment');

    return null;
  }

  /**
   * Extract statement period
   */
  private extractStatementPeriod(content: string): { start: string; end: string } | null {
    const dtstart = extractOFXTag(content, 'DTSTART');
    const dtend = extractOFXTag(content, 'DTEND');
    if (!dtstart || !dtend) return null;
    return {
      start: parseOFXDate(dtstart) || dtstart,
      end: parseOFXDate(dtend) || dtend,
    };
  }

  /**
   * Extract balance information
   */
  private extractBalances(content: string): { ledger?: number; available?: number } {
    const balances: { ledger?: number; available?: number } = {};

    const ledgerMatch = content.match(
      /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i,
    );
    if (ledgerMatch) {
      const balamt = extractOFXTag(ledgerMatch[1], 'BALAMT');
      if (balamt) balances.ledger = parseOFXAmount(balamt);
    }

    const availMatch = content.match(/<AVAILBAL>([\s\S]*?)(?:<\/AVAILBAL>|<\/STMTRS>)/i);
    if (availMatch) {
      const balamt = extractOFXTag(availMatch[1], 'BALAMT');
      if (balamt) balances.available = parseOFXAmount(balamt);
    }

    return balances;
  }

  /**
   * Extract all transactions from OFX content
   */
  private extractTransactions(content: string): OFXTransaction[] {
    const transactions: OFXTransaction[] = [];
    const pattern =
      /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|<LEDGERBAL>|<AVAILBAL>|$))/gi;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const tx = parseOFXTransactionBlock(match[1]);
      if (tx) transactions.push(tx);
    }
    return transactions;
  }

  /**
   * Get file extensions supported by this parser
   */
  static getSupportedExtensions(): string[] {
    return ['.ofx', '.qfx'];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ofxParser = new OFXStatementParser();
