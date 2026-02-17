/**
 * Merchant enrichment pipeline — runs merchant intelligence for a batch of transactions.
 *
 * Called by enrichment-service.ts as:
 *   runMerchantPipeline(merchantAgent, abnLookup, placesLookup, uncachedTxs, existingMappings, userId)
 *
 * Returns per-transaction results array that is accessed with `.find(m => m.transactionId === ...)`.
 */

export interface MerchantPipelineResult {
  transactionId: number;
  canonicalName: string;
  defaultCategory: string;
  gstRegistered: boolean;
  abn: string | null;
  address: string | null;
}

/**
 * Run the merchant intelligence pipeline for a batch of transactions.
 */
export async function runMerchantPipeline(
  _merchantAgent: unknown,
  _abnLookup: unknown,
  _placesLookup: unknown,
  _transactions: Array<Record<string, unknown>>,
  _existingMappings: Array<Record<string, unknown>>,
  _userId: string,
): Promise<MerchantPipelineResult[]> {
  // The real pipeline logic uses MerchantIntelligenceAgent, ABNLookupService,
  // and PlacesLookupService. This stub returns empty results; the full
  // enrichment is orchestrated by the parent EnrichmentService.
  return [];
}
