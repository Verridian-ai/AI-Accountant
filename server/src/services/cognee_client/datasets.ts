/**
 * Dataset Management — Cognee dataset CRUD and health check.
 *
 * Exposes: listDatasets, getDatasetStatus, getDatasetGraph, createDataset, isHealthy.
 * All functions take a CogneeClientContext as the first parameter.
 */

import { REQUEST_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { applyTenantPrefix } from './tenant-utils.js';

/**
 * List datasets in Cognee.
 * If tenantId is provided, filters to only datasets matching `tenant_${tenantId}_*` prefix.
 * If no tenantId (admin), returns all datasets.
 */
export async function listDatasets(
  ctx: CogneeClientContext,
  userId?: string,
  tenantId?: string,
): Promise<Array<{ id: string; name: string }>> {
  try {
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/datasets`, {
      method: 'GET',
      headers: { ...auth },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] List datasets failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      id?: string;
      dataset_id?: string;
      name?: string;
      dataset_name?: string;
    }[];
    if (Array.isArray(data)) {
      let datasets = data.map((d) => ({
        id: d.id || d.dataset_id || '',
        name: d.name || d.dataset_name || '',
      }));

      if (tenantId) {
        const prefix = `tenant_${tenantId}_`;
        datasets = datasets.filter((d) => d.name.startsWith(prefix));
      }

      return datasets;
    }
    return [];
  } catch (err) {
    console.warn('[CogneeClient] List datasets error:', err);
    return [];
  }
}

/**
 * Get processing status for datasets.
 * If tenantId provided, filters status to tenant-prefixed datasets only.
 */
export async function getDatasetStatus(
  ctx: CogneeClientContext,
  userId?: string,
  tenantId?: string,
): Promise<Record<string, string>> {
  try {
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/datasets/status`, {
      method: 'GET',
      headers: { ...auth },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Dataset status failed: ${res.status}`);
      return {};
    }
    const statusMap = (await res.json()) as Record<string, string>;

    if (tenantId) {
      const prefix = `tenant_${tenantId}_`;
      const filtered: Record<string, string> = {};
      for (const [key, value] of Object.entries(statusMap)) {
        if (key.startsWith(prefix)) {
          filtered[key] = value;
        }
      }
      return filtered;
    }

    return statusMap;
  } catch (err) {
    console.warn('[CogneeClient] Dataset status error:', err);
    return {};
  }
}

/**
 * Get the knowledge graph for a specific dataset.
 */
export async function getDatasetGraph(
  ctx: CogneeClientContext,
  datasetId: string,
  userId?: string,
  tenantId?: string,
): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  try {
    const prefixedId = applyTenantPrefix(datasetId, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedId)}/graph`,
      {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Dataset graph failed: ${res.status}`);
      return { nodes: [], edges: [] };
    }
    const data = await res.json();
    return {
      nodes: data.nodes || data.vertices || [],
      edges: data.edges || data.links || [],
    };
  } catch (err) {
    console.warn('[CogneeClient] Dataset graph error:', err);
    return { nodes: [], edges: [] };
  }
}

/**
 * Create a dataset explicitly.
 */
export async function createDataset(
  ctx: CogneeClientContext,
  name: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedName = applyTenantPrefix(name, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(`${ctx.baseUrl}/api/v1/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ name: prefixedName }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CogneeClient] Create dataset failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Create dataset error:', err);
  }
}

/**
 * Check if Cognee service is reachable.
 */
export async function isHealthy(ctx: CogneeClientContext): Promise<boolean> {
  try {
    const res = await fetch(`${ctx.baseUrl}/api/v1/settings`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
