/**
 * F4: Memify Enrichment Rules — TypeScript Wrapper
 *
 * Triggers Cognee memify with custom financial intelligence rules
 * after cognify processes raw transaction data.
 *
 * The 5 enrichment rules (Python) derive:
 * 1. Spending patterns by category/month
 * 2. BAS quarter summaries for GST reporting
 * 3. Merchant intelligence and categorization patterns
 * 4. Inter-account transfer patterns
 * 5. Recurring payment schedules
 */

import { cogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';

/**
 * Trigger memify enrichment with custom financial rules.
 *
 * This runs AFTER cognify has built the initial knowledge graph from transactions.
 * Memify analyzes the graph and creates derived nodes (PatternNode, BASPeriodNode, etc.)
 * that provide actionable intelligence for AI agents.
 *
 * @param datasets - Array of dataset names to enrich (e.g., ['bank_transactions', 'merchant_data'])
 * @param userId - Optional user ID for per-user dataset isolation
 * @param tenantId - Optional tenant ID for multi-tenant isolation
 */
export async function triggerMemifyEnrichment(
  datasets: string[],
  userId?: string,
  tenantId?: string,
): Promise<void> {
  logger.info(`[Memify] Triggering enrichment for datasets: ${datasets.join(', ')}`);

  try {
    await cogneeClient.triggerMemify(
      {
        datasets,
        run_in_background: true,
        // Note: Custom enrichment rules are configured in Docker via mounted Python files
        // at server/cognee-models/tasks/memify_enrichment.py
      },
      userId,
      tenantId,
    );

    logger.info('[Memify] Enrichment triggered successfully (background job)');
  } catch (err) {
    logger.error({ err }, '[Memify] Failed to trigger enrichment');
    throw err;
  }
}

/**
 * Trigger full cognify + memify pipeline for newly processed statements.
 *
 * Use this after parsing and categorizing transactions to:
 * 1. Build knowledge graph from raw data (cognify)
 * 2. Derive intelligence patterns (memify)
 *
 * @param datasets - Datasets to process
 * @param userId - User ID for isolation
 * @param tenantId - Tenant ID for isolation
 */
export async function cognifyAndEnrich(
  datasets: string[],
  userId?: string,
  tenantId?: string,
): Promise<void> {
  logger.info(`[Cognify+Memify] Starting full pipeline for: ${datasets.join(', ')}`);

  // Step 1: Cognify (build graph from raw data)
  await cogneeClient.cognify(datasets, true, userId, tenantId);
  logger.info('[Cognify+Memify] Cognify complete, starting memify...');

  // Step 2: Memify (derive intelligence)
  await triggerMemifyEnrichment(datasets, userId, tenantId);
  logger.info('[Cognify+Memify] Full pipeline complete');
}
