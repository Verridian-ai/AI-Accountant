/**
 * CBA Parser Configuration
 *
 * Configuration constants and month mapping for the Commonwealth Bank parser.
 */

import { BankParserConfig } from '../types';

export const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

export const CBA_CONFIG: BankParserConfig = {
  bankId: 'cba',
  bankName: 'Commonwealth Bank',
  displayName: 'Commonwealth Bank of Australia',

  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'DD MMM YYYY', 'DD MMM'],

  headerPatterns: [
    /Commonwealth\s*Bank/i,
    /CommBank/i,
    /CBA/i,
    /NetBank/i,
    /BSB:\s*06\d{4}/i,
    /Account\s+Statement/i,
  ],

  minHeaderMatches: 2,

  accountPatterns: [
    /Account\s*(?:Number|No\.?)[\s:]*(\d{4}\s*\d{4}\s*\d{4})/i,
    /BSB[\s:]*(\d{3}[\s-]?\d{3})[\s,]*Account[\s:]*(\d+)/i,
    /(\d{2}\s+\d{4}\s+\d{8,10})/,
  ],

  transactionPatterns: {
    datePattern: /(\d{1,2}\s+\w{3})/,
    amountPattern: /\$?([\d,]+\.\d{2})/,
    transactionLinePattern: /(\d{1,2}\s+\w{3})/,
    debitIndicators: ['-', 'DR'],
    creditIndicators: ['+', 'CR'],
    separateDebitCreditColumns: true,
  },

  accountTypes: {
    'Smart Access': 'transaction',
    'Complete Access': 'transaction',
    Streamline: 'transaction',
    'Goal Saver': 'savings',
    'NetBank Saver': 'savings',
    Youthsaver: 'savings',
    Mastercard: 'credit',
    'Credit Card': 'credit',
    Business: 'business',
    Offset: 'offset',
    'Home Loan': 'loan',
  },

  periodPatterns: [
    /Period\s*(\d{1,2}\s+\w{3}\s+\d{4})\s*[-–]\s*(\d{1,2}\s+\w{3}\s+\d{4})/i,
    /Statement\s+Period[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /From[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*To[\s:]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ],

  openingBalancePattern: /OPENING\s+BALANCE\s*\$?([\d,]+\.\d{2})/i,
  closingBalancePattern: /CLOSING\s+BALANCE\s*\$?([\d,]+\.\d{2})/i,
};
