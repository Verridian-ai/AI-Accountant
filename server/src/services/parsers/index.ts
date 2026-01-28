/**
 * Multi-Bank Statement Parsers
 *
 * Main export for the bank statement parsing system.
 */

// Types
export * from './types';

// Base parser utilities
export { parseDate, parseAmount, BaseBankParser } from './base-parser';

// Registry
export { parserRegistry, type BankParser, type ParseOptions } from './registry';

// Detector
export {
  detectBank,
  getBestBankMatch,
  isConfidentDetection,
  needsAIAssistance,
  parseStatementAuto,
  parseStatementWithBank,
  getSupportedBanks,
  getBankDisplayName,
  analyzeStatement,
  generateDetectionReport,
  CONFIDENCE_THRESHOLDS,
} from './detector';

// Individual bank parsers (for direct use if needed)
export {
  CBAParser,
  ANZParser,
  WestpacParser,
  NABParser,
  StGeorgeParser,
  BendigoParser,
  INGParser,
  MacquarieParser,
} from './banks';
