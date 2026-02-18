// ============================================================================
// CONFIG — Cognee client constants
// ============================================================================

export const COGNEE_API_URL = process.env.COGNEE_API_URL || 'http://localhost:8000';

export const REQUEST_TIMEOUT_MS = 30000;
export const COGNIFY_TIMEOUT_MS = 300000; // 5 minutes for cognify operations

/** Custom prompt for financial domain entity extraction during cognify */
export const FINANCIAL_COGNIFY_PROMPT =
  'Extract financial entities: merchant names, transaction categories, ' +
  'ABN numbers, GST registration status, payment methods, account references, ' +
  'recurring transaction patterns, and financial relationships between entities. ' +
  'Identify temporal patterns like weekly/monthly/quarterly transactions.';
