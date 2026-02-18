/**
 * Cognee Client — Barrel Export
 *
 * Re-exports all types and the CogneeClient class for backward-compatible imports.
 * Includes F1-F6 exports for Cognee maximalist integration.
 */

// Re-export all public types
export type { CogneeSearchType, CogneeSearchResult, TokenCacheEntry } from './types.js';
export { REQUEST_TIMEOUT_MS, COGNIFY_TIMEOUT_MS, FINANCIAL_COGNIFY_PROMPT } from './types.js';

export { CogneeClientBase } from './client-base.js';
export { CogneeClient } from './client.js';

// F2: Cognify with Ontology
export { cognifyWithOntology, MAXIMALIST_COGNIFY_PROMPT } from './cognify.js';

// F5: NodeSet utilities (3-dimensional tagging)
export {
  getBASQuarter,
  getFinancialYear,
  getTemporalNodeSets,
  getCategoricalNodeSets,
  getAccountNodeSet,
  generateTransactionNodeSets,
  generateBASNodeSets,
  generateMerchantNodeSets,
  generateDeductionNodeSets,
} from './nodeset-utils.js';

// F5: NodeSet data operations
export { addDataWithNodeSets } from './data-ops.js';
export { searchWithNodeSets } from './search.js';

// F6: Smart search type selection
export {
  selectSearchType,
  selectSearchTypeWithContext,
  getAgentPreferredSearchType,
  getDatasetPreferredSearchType,
  ALL_SEARCH_TYPES,
  type SearchTypeContext,
} from './search-type-selector.js';

import { CogneeClient } from './client.js';
export const cogneeClient = new CogneeClient();

// Dataset migration utility (Wave 23)
export { migrateLegacyDatasets } from './migration.js';
export type { MigrationResult } from './migration.js';
