/**
 * Pipeline module barrel export.
 * Re-exports all public types, functions, and the singleton pipeline instance.
 */
export type { AccountDetectionResult, RawTransactionData, CategorizationResult } from './types.js';

export {
  GST_RATE,
  GST_FREE_CATEGORIES,
  INPUT_TAXED_CATEGORIES,
  calculateGstAmount,
  inferGstCategory,
  computeStatementMetadata,
} from './types.js';

export { withRetry, extractPdfText } from './text-extraction.js';

export { detectAccountInfo, detectCreditCard } from './account-detection.js';
export type { CreditCardDetectionResult } from './account-detection.js';

export { tryCreditCardParser, tryBankParser } from './bank-parser.js';

export { tryClaudeAgentParsing, tryLegacyAiParsing, runVisionVerification } from './ai-parsing.js';

export { handleAgentPathInsertion } from './agent-insertion.js';

export {
  computeTransactionHash,
  categorizeTransactions,
  prepareTransactionInserts,
  insertTransactions,
  indexInCognee,
  runEnrichment,
} from './categorization.js';

export { flagLikelyTransfersByDescription, detectTransfers } from './transfer-detection.js';

export { PipelineService, pipeline } from './pipeline.js';
