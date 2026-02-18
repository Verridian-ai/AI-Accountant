// ============================================================================
// Cognee Client — Public API barrel
// ============================================================================

export type { CogneeSearchType, CogneeSearchResult } from './types.js';
export { CogneeClient } from './client.js';
export {
  COGNEE_API_URL,
  REQUEST_TIMEOUT_MS,
  COGNIFY_TIMEOUT_MS,
  FINANCIAL_COGNIFY_PROMPT,
} from './config.js';

import { CogneeClient } from './client.js';
export const cogneeClient = new CogneeClient();
