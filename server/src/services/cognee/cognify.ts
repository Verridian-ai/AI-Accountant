/**
 * Cognee Client — Cognify Operations
 *
 * Knowledge graph building and processing:
 * - cognify: trigger graph building from indexed data
 * - addAndCognify: convenience add-then-build pattern
 * - temporalCognify: cognify with temporal metadata enrichment
 * - Feedback & Memify operations
 */

import { logger } from '../../lib/logger.js';
import {
  REQUEST_TIMEOUT_MS,
  COGNIFY_TIMEOUT_MS,
  FINANCIAL_COGNIFY_PROMPT,
} from './types.js';
import type { AuthState } from './auth.js';
import { buildAuthHeaders } from './auth.js';
import { applyTenantPrefixToAll } from './tenant.js';
import { listDatasets } from './datasets.js';
import { addData } from './data-ops.js';

/**
 * Build knowledge graph from indexed data.
 * Requires dataset names -- sending an empty body returns 400.
 *
 * @param datasets - Dataset names to cognify. If omitted, fetches all datasets.
 * @param background - Run in background (non-blocking). Default: true.
 * @param customPrompt - Custom prompt for entity extraction. Uses financial domain prompt by default.
 * @param userId - Optional user ID for per-user auth (Wave 3).
 * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
 */
export async function cognify(
  state: AuthState,
  datasets?: string[],
  background: boolean = true,
  customPrompt?: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    // If no datasets specified, fetch all available datasets
    let datasetNames = datasets;
    if (!datasetNames || datasetNames.length === 0) {
      const allDatasets = await listDatasets(state, userId, tenantId);
      datasetNames = allDatasets.map((d) => d.name);
      if (datasetNames.length === 0) {
        logger.warn('[CogneeClient] No datasets found to cognify');
        return;
      }
    } else {
      // Apply tenant prefix to the provided dataset names
      datasetNames = applyTenantPrefixToAll(datasetNames, tenantId);
    }

    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/cognify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        datasets: datasetNames,
        run_in_background: background,
        custom_prompt: customPrompt ?? FINANCIAL_COGNIFY_PROMPT,
      }),
      signal: AbortSignal.timeout(background ? REQUEST_TIMEOUT_MS : COGNIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`[CogneeClient] Cognify failed: ${res.status} ${body}`);
    } else {
      logger.info(
        `[CogneeClient] Cognify triggered for datasets: ${datasetNames.join(', ')} (background: ${background})`,
      );
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Cognify error:');
  }
}

/**
 * Add data then trigger cognify for the dataset.
 * Convenience method for the common add-then-build pattern.
 */
export async function addAndCognify(
  state: AuthState,
  data: string[],
  dataset: string,
  background: boolean = true,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  await addData(state, data, dataset, userId, tenantId);
  await cognify(state, [dataset], background, undefined, userId, tenantId);
}

/**
 * Temporal cognify -- trigger cognify with temporal metadata enrichment.
 */
export async function temporalCognify(
  state: AuthState,
  dataset: string,
  options?: {
    customPrompt?: string;
    background?: boolean;
  },
  userId?: string,
  tenantId?: string,
): Promise<void> {
  const prompt =
    options?.customPrompt ??
    `${FINANCIAL_COGNIFY_PROMPT} Also extract temporal entities: dates, periods, financial years, BAS quarters.`;
  await cognify(state, [dataset], options?.background ?? true, prompt, userId, tenantId);
}

/**
 * F2: Cognify with Custom Ontology
 *
 * Enhanced cognify that passes OWL ontology file path to Cognee.
 * The ontology file defines domain-specific entity types, relationships, and individuals.
 *
 * @param datasets - Dataset names to cognify
 * @param ontologyPath - Path to OWL file (mounted in Docker container)
 * @param background - Run in background (default: true)
 * @param customPrompt - Custom extraction prompt (uses MAXIMALIST by default)
 * @param userId - Optional user ID for auth
 * @param tenantId - Optional tenant ID for dataset prefixing
 */
export async function cognifyWithOntology(
  state: AuthState,
  datasets: string[],
  ontologyPath: string = '/app/custom_models/ontologies/australian-finance.owl',
  background: boolean = true,
  customPrompt?: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const datasetNames = applyTenantPrefixToAll(datasets, tenantId);
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/cognify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        datasets: datasetNames,
        run_in_background: background,
        custom_prompt: customPrompt ?? MAXIMALIST_COGNIFY_PROMPT,
        ontology_file_path: ontologyPath,
      }),
      signal: AbortSignal.timeout(background ? REQUEST_TIMEOUT_MS : COGNIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`[CogneeClient] CognifyWithOntology failed: ${res.status} ${body}`);
    } else {
      logger.info(
        `[CogneeClient] CognifyWithOntology triggered for datasets: ${datasetNames.join(', ')} with ontology: ${ontologyPath}`,
      );
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] CognifyWithOntology error:');
  }
}

/**
 * MAXIMALIST_COGNIFY_PROMPT — Enhanced Financial Domain Extraction
 *
 * Comprehensive extraction prompt for Australian financial documents.
 * Instructs Cognee to extract ALL entity types defined in goldledger_datapoints.py
 * and australian-finance.owl.
 *
 * Based on docs/COGNEE_INTEGRATION_PLAN.md Appendix B.
 */
export const MAXIMALIST_COGNIFY_PROMPT =
  'You are analyzing Australian financial documents. Extract ALL of the following entities:\n\n' +
  'TRANSACTIONS: merchant name (canonical form), amount (in cents), date (ISO 8601), ' +
  'category, GST status (standard 10%, GST-free, input-taxed, export), ' +
  'debit/credit indicator, account reference.\n\n' +
  'MERCHANTS: canonical name, ABN (if visible), industry, GST registration status.\n\n' +
  'ACCOUNTS: account number (masked), BSB, bank name, account type.\n\n' +
  'GST RULES: rule type, rate, ATO reference number, applicable categories.\n\n' +
  'TAX DEDUCTIONS: D1-D15 ATO category, deduction type, substantiation method.\n\n' +
  'TEMPORAL PATTERNS: recurring frequencies (weekly, fortnightly, monthly, quarterly, annual), ' +
  'seasonal patterns, payment cycle dates.\n\n' +
  'BAS PERIODS: Quarter assignment (Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun), ' +
  'financial year (Australian: Jul 1 - Jun 30).\n\n' +
  'RELATIONSHIPS: Transaction->Merchant (paid_to), Transaction->Account (belongs_to), ' +
  'Transaction->Category (categorized_as), Merchant->Category (operates_in), ' +
  'Transaction->BASPeriod (in_period), Pattern->Account (observed_in).\n\n' +
  'Create edges between ALL related entities. Preserve monetary amounts in cents.';

// ============================================================================
// Feedback & Memify (called by cognee-feedback.ts)
// ============================================================================

/**
 * Submit feedback to Cognee API for entity corrections.
 */
export async function submitFeedback(
  state: AuthState,
  data: {
    entity_id: string;
    feedback_type: string;
    original_value?: string;
    corrected_value?: string;
    context?: Record<string, string>;
  },
  userId?: string,
): Promise<void> {
  try {
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] Submit feedback failed: ${res.status}`);
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Submit feedback error:');
  }
}

/**
 * Trigger memify (memory consolidation) in Cognee for feedback learning.
 */
export async function triggerMemify(
  state: AuthState,
  data: {
    datasets: string[];
    feedback_data?: Array<{
      entity_id: string;
      feedback_type: string;
      original_value?: string;
      corrected_value?: string;
    }>;
    run_in_background?: boolean;
  },
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedData = {
      ...data,
      datasets: applyTenantPrefixToAll(data.datasets, tenantId),
    };
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/memify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(prefixedData),
      signal: AbortSignal.timeout(COGNIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] Trigger memify failed: ${res.status}`);
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Trigger memify error:');
  }
}
