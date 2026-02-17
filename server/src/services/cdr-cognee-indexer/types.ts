/**
 * CDR Cognee Indexer Module — Type Definitions
 */

export interface CdrIndexResult {
  productsIndexed: number;
  ratesIndexed: number;
  knowledgeDocsIndexed: number;
  errors: string[];
  durationMs: number;
}
