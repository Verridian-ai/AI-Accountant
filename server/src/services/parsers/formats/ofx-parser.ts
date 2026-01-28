/**
 * OFX/QFX Statement Parser
 *
 * Parses OFX (Open Financial Exchange) and QFX (Quicken Financial Exchange)
 * bank statement files. These are XML-like files exported by most banks.
 *
 * OFX format reference: https://www.ofx.net/
 */

import { ParsedTransaction, AccountType } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface OFXTransaction {
  /** Transaction type: DEBIT, CREDIT, INT, DIV, FEE, SRVCHG, DEP, ATM, POS, XFER, CHECK, PAYMENT, CASH, DIRECTDEP, DIRECTDEBIT, REPEATPMT, OTHER */
  trntype: string;
  /** Date posted (YYYYMMDD or YYYYMMDDHHMMSS format) */
  dtposted: string;
  /** Transaction amount (positive = credit, negative = debit) */
  trnamt: string;
  /** Financial institution transaction ID */
  fitid: string;
  /** Check number (optional) */
  checknum?: string;
  /** Reference number (optional) */
  refnum?: string;
  /** Payee name */
  name?: string;
  /** Memo/description */
  memo?: string;
  /** Standard Industrial Classification code (optional) */
  sic?: string;
  /** Payee ID (optional) */
  payeeid?: string;
}

export interface OFXAccountInfo {
  /** Bank ID (routing number) */
  bankid?: string;
  /** Branch ID (optional) */
  branchid?: string;
  /** Account ID */
  acctid: string;
  /** Account type: CHECKING, SAVINGS, MONEYMRKT, CREDITLINE */
  accttype?: string;
  /** Currency */
  currency?: string;
}

export interface OFXStatement {
  /** Account information */
  account: OFXAccountInfo;
  /** Statement transactions */
  transactions: OFXTransaction[];
  /** Ledger balance */
  ledgerBalance?: {
    amount: string;
    dateAsOf: string;
  };
  /** Available balance */
  availableBalance?: {
    amount: string;
    dateAsOf: string;
  };
  /** Statement period start */
  dtstart?: string;
  /** Statement period end */
  dtend?: string;
}

export interface OFXParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  accountNumber: string | null;
  accountType: AccountType;
  bankId: string | null;
  currency: string | null;
  statementPeriod?: {
    start: string;
    end: string;
  };
  balances?: {
    ledger?: number;
    available?: number;
  };
  errors: string[];
  warnings: string[];
  metadata: {
    rowCount: number;
    parsedCount: number;
    skippedCount: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

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
      // Normalize line endings and clean content
      const normalizedContent = this.normalizeContent(content);

      // Check if this is a valid OFX file
      if (!this.isValidOFX(normalizedContent)) {
        result.errors.push('Invalid OFX/QFX file format');
        return result;
      }

      // Extract account information
      const accountInfo = this.extractAccountInfo(normalizedContent);
      if (accountInfo) {
        result.accountNumber = accountInfo.acctid;
        result.bankId = accountInfo.bankid || null;
        result.currency = accountInfo.currency || 'AUD';
        result.accountType = this.mapAccountType(accountInfo.accttype);
      }

      // Extract statement period
      const period = this.extractStatementPeriod(normalizedContent);
      if (period) {
        result.statementPeriod = period;
      }

      // Extract balances
      const balances = this.extractBalances(normalizedContent);
      if (balances.ledger !== undefined || balances.available !== undefined) {
        result.balances = balances;
      }

      // Extract and parse transactions
      const rawTransactions = this.extractTransactions(normalizedContent);
      result.metadata.rowCount = rawTransactions.length;

      for (let i = 0; i < rawTransactions.length; i++) {
        const rawTx = rawTransactions[i];

        try {
          const transaction = this.convertTransaction(rawTx, i);
          if (transaction) {
            result.transactions.push(transaction);
            result.metadata.parsedCount++;
          } else {
            result.metadata.skippedCount++;
            result.warnings.push(`Transaction ${i + 1}: Skipped - missing required fields`);
          }
        } catch (error) {
          result.warnings.push(
            `Transaction ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`
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
   * Check if content is a valid OFX file
   */
  isValidOFX(content: string): boolean {
    // OFX files contain OFXHEADER or <?OFX or <OFX> tags
    const hasOFXHeader = /OFXHEADER/i.test(content);
    const hasOFXTag = /<\?OFX|<OFX>/i.test(content);
    const hasOFXContent = /<STMTTRN>|<BANKACCTFROM>|<CCACCTFROM>/i.test(content);

    return hasOFXHeader || hasOFXTag || hasOFXContent;
  }

  /**
   * Normalize OFX content for parsing
   */
  private normalizeContent(content: string): string {
    // Remove UTF-8 BOM if present
    let normalized = content.replace(/^\uFEFF/, '');

    // Normalize line endings
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // OFX can be SGML-like (no closing tags) or XML
    // For SGML, we need to handle self-closing tags
    return normalized;
  }

  /**
   * Extract account information from OFX content
   */
  private extractAccountInfo(content: string): OFXAccountInfo | null {
    // Try bank account first
    const bankAcctMatch = content.match(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i) ||
                          content.match(/<BANKACCTFROM>([\s\S]*?)(?=<(?:BANKTRANLIST|LEDGERBAL|AVAILBAL))/i);

    if (bankAcctMatch) {
      return this.parseAccountBlock(bankAcctMatch[1], 'bank');
    }

    // Try credit card account
    const ccAcctMatch = content.match(/<CCACCTFROM>([\s\S]*?)<\/CCACCTFROM>/i) ||
                        content.match(/<CCACCTFROM>([\s\S]*?)(?=<(?:BANKTRANLIST|LEDGERBAL|AVAILBAL|CCSTMTRS))/i);

    if (ccAcctMatch) {
      return this.parseAccountBlock(ccAcctMatch[1], 'credit');
    }

    // Try investment account
    const invAcctMatch = content.match(/<INVACCTFROM>([\s\S]*?)<\/INVACCTFROM>/i);

    if (invAcctMatch) {
      return this.parseAccountBlock(invAcctMatch[1], 'investment');
    }

    return null;
  }

  /**
   * Parse account block content
   */
  private parseAccountBlock(block: string, type: string): OFXAccountInfo {
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
   * Extract statement period
   */
  private extractStatementPeriod(content: string): { start: string; end: string } | null {
    const dtstart = this.extractTag(content, 'DTSTART');
    const dtend = this.extractTag(content, 'DTEND');

    if (dtstart && dtend) {
      return {
        start: this.parseOFXDate(dtstart) || dtstart,
        end: this.parseOFXDate(dtend) || dtend,
      };
    }

    return null;
  }

  /**
   * Extract balance information
   */
  private extractBalances(content: string): { ledger?: number; available?: number } {
    const balances: { ledger?: number; available?: number } = {};

    // Ledger balance
    const ledgerMatch = content.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i);
    if (ledgerMatch) {
      const balamt = this.extractTag(ledgerMatch[1], 'BALAMT');
      if (balamt) {
        balances.ledger = this.parseAmount(balamt);
      }
    }

    // Available balance
    const availMatch = content.match(/<AVAILBAL>([\s\S]*?)(?:<\/AVAILBAL>|<\/STMTRS>)/i);
    if (availMatch) {
      const balamt = this.extractTag(availMatch[1], 'BALAMT');
      if (balamt) {
        balances.available = this.parseAmount(balamt);
      }
    }

    return balances;
  }

  /**
   * Extract all transactions from OFX content
   */
  private extractTransactions(content: string): OFXTransaction[] {
    const transactions: OFXTransaction[] = [];

    // Match all STMTTRN blocks (with or without closing tags)
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|<LEDGERBAL>|<AVAILBAL>|$))/gi;
    let match;

    while ((match = stmttrnRegex.exec(content)) !== null) {
      const txBlock = match[1];
      const transaction = this.parseTransactionBlock(txBlock);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  /**
   * Parse a single transaction block
   */
  private parseTransactionBlock(block: string): OFXTransaction | null {
    const getValue = (tag: string): string | undefined => {
      // Handle both XML style (<TAG>value</TAG>) and SGML style (<TAG>value)
      const xmlMatch = block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'));
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

    // Required fields
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
  private convertTransaction(tx: OFXTransaction, index: number): ParsedTransaction | null {
    // Parse date
    const date = this.parseOFXDate(tx.dtposted);
    if (!date) {
      throw new Error(`Invalid date format: ${tx.dtposted}`);
    }

    // Parse amount (OFX uses positive for credits, negative for debits)
    const amountCents = this.parseAmount(tx.trnamt);

    // Build description from name and memo
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

    // Build reference from various fields
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
      description: this.cleanDescription(description),
      amount: amountCents,
      reference,
      rawDate: tx.dtposted,
      rawAmount: tx.trnamt,
      rawDescription: `${tx.name || ''} ${tx.memo || ''}`.trim(),
      lineNumber: index + 1,
    };
  }

  /**
   * Parse OFX date format (YYYYMMDD or YYYYMMDDHHMMSS)
   */
  private parseOFXDate(dateStr: string): string | null {
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
  private parseAmount(amountStr: string): number {
    if (!amountStr || amountStr.trim() === '') {
      return 0;
    }

    // Remove any non-numeric characters except minus and decimal point
    const cleaned = amountStr
      .replace(/[^0-9.\-]/g, '')
      .trim();

    const value = parseFloat(cleaned);
    if (isNaN(value)) {
      return 0;
    }

    // Convert to cents
    return Math.round(value * 100);
  }

  /**
   * Extract a single tag value from content
   */
  private extractTag(content: string, tag: string): string | null {
    // Try XML style first
    const xmlMatch = content.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`, 'i'));
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
  private mapAccountType(ofxType?: string): AccountType {
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
   * Clean up transaction description
   */
  private cleanDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')
      .replace(/^\s*-\s*/, '')
      .trim();
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
