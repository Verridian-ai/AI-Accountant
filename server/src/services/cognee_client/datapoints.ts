/**
 * DataPoint, Ontology & NodeSet Operations — Wave 3 knowledge graph extensions.
 *
 * Exposes: createDataPoint, getDataPoints, deleteDataPoint,
 * applyOntology, getOntology, getNodeSets, createNodeSet, deleteNodeSet.
 *
 * All functions take a CogneeClientContext as the first parameter.
 */

import { REQUEST_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { applyTenantPrefix } from './tenant-utils.js';

/**
 * Create a DataPoint extraction schema on a dataset.
 */
export async function createDataPoint(
  ctx: CogneeClientContext,
  datasetName: string,
  schema: Record<string, unknown>,
  userId?: string,
  tenantId?: string,
): Promise<unknown> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/datapoints`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(schema),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Create datapoint failed: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[CogneeClient] Create datapoint error:', err);
    return null;
  }
}

/**
 * Get DataPoint schemas for a dataset.
 */
export async function getDataPoints(
  ctx: CogneeClientContext,
  datasetName: string,
  userId?: string,
  tenantId?: string,
): Promise<unknown[]> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/datapoints`,
      {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Get datapoints failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[CogneeClient] Get datapoints error:', err);
    return [];
  }
}

/**
 * Delete a DataPoint schema from a dataset.
 */
export async function deleteDataPoint(
  ctx: CogneeClientContext,
  datasetName: string,
  dpId: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/datapoints/${encodeURIComponent(dpId)}`,
      {
        method: 'DELETE',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Delete datapoint failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Delete datapoint error:', err);
  }
}

/**
 * Apply an ontology to a dataset for typed graph building.
 */
export async function applyOntology(
  ctx: CogneeClientContext,
  datasetName: string,
  ontology: Record<string, unknown>,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/ontology`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(ontology),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Apply ontology failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Apply ontology error:', err);
  }
}

/**
 * Get the ontology for a dataset.
 */
export async function getOntology(
  ctx: CogneeClientContext,
  datasetName: string,
  userId?: string,
  tenantId?: string,
): Promise<unknown> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/ontology`,
      {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Get ontology failed: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[CogneeClient] Get ontology error:', err);
    return null;
  }
}

/**
 * Get NodeSets from a dataset's graph.
 */
export async function getNodeSets(
  ctx: CogneeClientContext,
  datasetName: string,
  userId?: string,
  tenantId?: string,
): Promise<unknown[]> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/nodesets`,
      {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Get nodesets failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[CogneeClient] Get nodesets error:', err);
    return [];
  }
}

/**
 * Create a NodeSet in a dataset's graph.
 */
export async function createNodeSet(
  ctx: CogneeClientContext,
  datasetName: string,
  nodeSet: Record<string, unknown>,
  userId?: string,
  tenantId?: string,
): Promise<unknown> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/nodesets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(nodeSet),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Create nodeset failed: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[CogneeClient] Create nodeset error:', err);
    return null;
  }
}

/**
 * Delete a NodeSet from a dataset's graph.
 */
export async function deleteNodeSet(
  ctx: CogneeClientContext,
  datasetName: string,
  nodeSetId: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedName = applyTenantPrefix(datasetName, tenantId);
    const auth = await ctx.authHeaders(userId);
    const res = await fetch(
      `${ctx.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/nodesets/${encodeURIComponent(nodeSetId)}`,
      {
        method: 'DELETE',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[CogneeClient] Delete nodeset failed: ${res.status}`);
    }
  } catch (err) {
    console.warn('[CogneeClient] Delete nodeset error:', err);
  }
}
