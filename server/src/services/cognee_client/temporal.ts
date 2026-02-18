/**
 * Temporal Operations — Wave 3 time-aware search and cognify.
 *
 * All functions take a CogneeClientContext as the first parameter.
 */

import type { CogneeSearchType, CogneeSearchResult } from './types.js';
import { FINANCIAL_COGNIFY_PROMPT } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { searchRich } from './http-primitives.js';
import { cognify } from './graph-ops.js';

/**
 * Temporal-aware search with date range context.
 * Augments the query with period markers for time-scoped retrieval.
 */
export async function temporalSearch(
  ctx: CogneeClientContext,
  query: string,
  options: {
    dataset: string;
    timeStart?: string;
    timeEnd?: string;
    searchType?: CogneeSearchType;
    topK?: number;
  },
  userId?: string,
  tenantId?: string,
): Promise<CogneeSearchResult[]> {
  const augmentedQuery =
    options.timeStart && options.timeEnd
      ? `${query} [period: ${options.timeStart} to ${options.timeEnd}]`
      : query;

  return searchRich(
    ctx,
    augmentedQuery,
    options.dataset,
    options.topK ?? 5,
    options.searchType ?? 'CHUNKS',
    userId,
    tenantId,
  );
}

/**
 * Temporal cognify — trigger cognify with temporal metadata enrichment.
 * Adds date/period/BAS quarter entity extraction to the base financial prompt.
 */
export async function temporalCognify(
  ctx: CogneeClientContext,
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
  await cognify(ctx, [dataset], options?.background ?? true, prompt, userId, tenantId);
}
