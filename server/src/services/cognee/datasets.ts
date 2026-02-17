/**
 * Cognee Client — Dataset Operations
 *
 * Dataset management operations:
 * - listDatasets: get all datasets
 * - createDataset: create a new dataset
 * - deleteDataset: delete a dataset
 * - getDatasetStatus: check indexing status
 * - getDatasetGraph: retrieve graph data
 */

import { logger } from '../../lib/logger.js';
import { REQUEST_TIMEOUT_MS } from './types.js';
import type { AuthState } from './auth.js';
import { buildAuthHeaders } from './auth.js';
import { applyTenantPrefix } from './tenant.js';

/**
 * List all datasets in Cognee.
 */
export async function listDatasets(
  state: AuthState,
  userId?: string,
  tenantId?: string,
): Promise<Array<{ name: string; id?: string; status?: string }>> {
  try {
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/datasets`, {
      method: 'GET',
      headers: { ...auth },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] List datasets failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] List datasets error:');
    return [];
  }
}

/**
 * Create a new dataset.
 */
export async function createDataset(
  state: AuthState,
  name: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedName = applyTenantPrefix(name, tenantId);
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ name: prefixedName }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] Create dataset failed: ${res.status}`);
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Create dataset error:');
  }
}

/**
 * Delete a dataset.
 */
export async function deleteDataset(
  state: AuthState,
  name: string,
  userId?: string,
  tenantId?: string,
): Promise<void> {
  try {
    const prefixedName = applyTenantPrefix(name, tenantId);
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(`${state.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}`, {
      method: 'DELETE',
      headers: { ...auth },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`[CogneeClient] Delete dataset failed: ${res.status}`);
    }
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Delete dataset error:');
  }
}

/**
 * Get dataset indexing status.
 */
export async function getDatasetStatus(
  state: AuthState,
  name: string,
  userId?: string,
  tenantId?: string,
): Promise<{ status: string; documentCount?: number } | null> {
  try {
    const prefixedName = applyTenantPrefix(name, tenantId);
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(
      `${state.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/status`,
      {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      logger.warn(`[CogneeClient] Get dataset status failed: ${res.status}`);
      return null;
    }
    return res.json();
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Get dataset status error:');
    return null;
  }
}

/**
 * Get dataset graph data.
 */
export async function getDatasetGraph(
  state: AuthState,
  name: string,
  userId?: string,
  tenantId?: string,
): Promise<{ nodes: any[]; edges: any[] } | null> {
  try {
    const prefixedName = applyTenantPrefix(name, tenantId);
    const auth = await buildAuthHeaders(state, userId);
    const res = await fetch(
      `${state.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/graph`,
      {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      logger.warn(`[CogneeClient] Get dataset graph failed: ${res.status}`);
      return null;
    }
    return res.json();
  } catch (err) {
    logger.warn({ err: err }, '[CogneeClient] Get dataset graph error:');
    return null;
  }
}
