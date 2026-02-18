/**
 * Feedback & Memify — entity corrections and memory consolidation.
 *
 * All functions take a CogneeClientContext as the first parameter.
 */

import { REQUEST_TIMEOUT_MS, COGNIFY_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { applyTenantPrefixToAll } from './tenant-utils.js';

/**
 * Submit feedback to Cognee API for entity corrections.
 */
export async function submitFeedback(
  ctx: CogneeClientContext,
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
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Submit feedback failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Submit feedback error:', err);
  }
}

/**
 * Trigger memify (memory consolidation) in Cognee for feedback learning.
 */
export async function triggerMemify(
  ctx: CogneeClientContext,
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
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/memify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(prefixedData),
      signal: AbortSignal.timeout(COGNIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Trigger memify failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Trigger memify error:', err);
  }
}
