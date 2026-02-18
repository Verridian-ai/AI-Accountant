/**
 * Knowledge Graph Operations — cognify and addAndCognify.
 *
 * All functions take a CogneeClientContext as the first parameter.
 */

import { FINANCIAL_COGNIFY_PROMPT, REQUEST_TIMEOUT_MS, COGNIFY_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { applyTenantPrefixToAll } from './tenant-utils.js';
import { add } from './http-primitives.js';
import { listDatasets } from './datasets.js';

/**
 * Build knowledge graph from indexed data.
 * Requires dataset names — sending an empty body returns 400.
 *
 * @param datasets - Dataset names to cognify. If omitted, fetches all datasets.
 * @param background - Run in background (non-blocking). Default: true.
 * @param customPrompt - Custom prompt for entity extraction.
 */
export async function cognify(
  ctx: CogneeClientContext,
  datasets?: string[],
  background: boolean = true,
  customPrompt?: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    let datasetNames = datasets;
    if (!datasetNames || datasetNames.length === 0) {
      const allDatasets = await listDatasets(ctx, userId, tenantId);
      datasetNames = allDatasets.map((d) => d.name);
      if (datasetNames.length === 0) {
        console.warn('[CogneeClient] No datasets found to cognify');
        return;
      }
    } else {
      datasetNames = applyTenantPrefixToAll(datasetNames, tenantId);
    }

    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/cognify`, {
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
      console.warn(`[CogneeClient] Cognify failed: ${res.status} ${body}`);
    } else {
      console.log(
        `[CogneeClient] Cognify triggered for datasets: ${datasetNames.join(', ')} (background: ${background})`,
      );
    }
  } catch (err) {
    console.warn('[CogneeClient] Cognify error:', err);
  }
}

/**
 * Add data then trigger cognify for the dataset.
 * Convenience method for the common add-then-build pattern.
 */
export async function addAndCognify(
  ctx: CogneeClientContext,
  data: string[],
  dataset: string,
  background: boolean = true,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  await add(ctx, data, dataset, userId, tenantId);
  await cognify(ctx, [dataset], background, undefined, userId, tenantId);
}
