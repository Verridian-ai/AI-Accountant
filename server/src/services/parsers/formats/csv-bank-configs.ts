/**
 * CSV Bank Configuration Definitions
 *
 * Column mappings and identification patterns for Australian bank CSV exports.
 */

// ============================================================================
// BANK CSV CONFIGURATIONS
// ============================================================================

export interface BankCSVConfig {
  bankId: string;
  bankName: string;
  /** Column mappings (0-indexed) or header names */
  columns: {
    date: string | number;
    description: string | number;
    debit?: string | number;
    credit?: string | number;
    amount?: string | number; // Combined debit/credit
    balance?: string | number;
  };
  /** Date formats to try (in order of preference) */
  dateFormats: string[];
  /** Whether the file has a header row */
  hasHeader: boolean;
  /** Number of rows to skip before data */
  skipRows: number;
  /** Delimiter character */
  delimiter: string;
  /** String patterns to identify this bank's CSV */
  identifyPatterns: string[];
  /** Positive amount indicates credit (true) or debit (false) */
  positiveIsCredit: boolean;
  /** Multiply amounts by this factor (e.g., 100 for cents) */
  amountMultiplier: number;
}

export const BANK_CSV_CONFIGS: Record<string, BankCSVConfig> = {
  cba: {
    bankId: 'cba',
    bankName: 'Commonwealth Bank',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['commonwealth', 'netbank', 'cba'],
    positiveIsCredit: true, // CBA CSVs: negative = debit, positive = credit
    amountMultiplier: 100,
  },
  anz: {
    bankId: 'anz',
    bankName: 'ANZ',
    columns: {
      date: 0,
      description: 1,
      amount: 2,
      balance: 3,
    },
    dateFormats: ['DD/MM/YYYY', 'D/M/YYYY'],
    hasHeader: false,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['anz'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  westpac: {
    bankId: 'westpac',
    bankName: 'Westpac',
    columns: {
      date: 'Date',
      description: 'Narrative',
      debit: 'Debit Amount',
      credit: 'Credit Amount',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'D/M/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['westpac', 'narrative'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  nab: {
    bankId: 'nab',
    bankName: 'NAB',
    columns: {
      date: 'Date',
      description: 'Transaction Details',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormats: ['DD-MMM-YY', 'DD/MM/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['nab', 'national australia'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  stgeorge: {
    bankId: 'stgeorge',
    bankName: 'St.George',
    columns: {
      date: 'Date',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['st george', 'stgeorge'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  bendigo: {
    bankId: 'bendigo',
    bankName: 'Bendigo Bank',
    columns: {
      date: 'Date',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'DD/MM/YY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['bendigo'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  ing: {
    bankId: 'ing',
    bankName: 'ING',
    columns: {
      date: 'Date',
      description: 'Description',
      credit: 'Credit',
      debit: 'Debit',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['ing'],
    positiveIsCredit: true,
    amountMultiplier: 100,
  },
  macquarie: {
    bankId: 'macquarie',
    bankName: 'Macquarie',
    columns: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    },
    dateFormats: ['DD/MM/YYYY', 'YYYY-MM-DD'],
    hasHeader: true,
    skipRows: 0,
    delimiter: ',',
    identifyPatterns: ['macquarie'],
    positiveIsCredit: false,
    amountMultiplier: 100,
  },
};
