/**
 * Cognee REST API Client
 *
 * SINGLE SOURCE OF TRUTH for all Cognee HTTP calls.
 * Both rag.ts and cognee-tools.ts delegate to this client.
 *
 * Key protocol requirements:
 *  - /api/v1/add uses multipart FormData (not JSON)
 *  - /api/v1/search uses field `query` and `search_type`
 *  - /api/v1/cognify requires `datasets` (empty body = 400)
 *
 * Wave 3: Multi-user support — per-user token cache with LRU eviction.
 * Wave 23: Multi-tenant dataset isolation via prefix functions.
 *
 * This file is now a thin shell. All logic lives in sub-modules:
 *   client-context.ts  — CogneeClientContext interface
 *   tenant-utils.ts    — pure prefix/strip helpers
 *   http-primitives.ts — add, searchRich, search, parseSearchResult
 *   domain.ts          — financial domain convenience methods
 *   graph-ops.ts       — cognify, addAndCognify
 *   datasets.ts        — listDatasets, getDatasetStatus, getDatasetGraph, createDataset, isHealthy
 *   feedback.ts        — submitFeedback, triggerMemify
 *   cross-search.ts    — crossDatasetSearch, searchWithSession, searchAcrossTenants
 *   user-auth.ts       — createCogneeUser, getCogneeUserTokens, refreshCogneeToken, revokeUserToken
 *   datapoints.ts      — DataPoint, Ontology, NodeSet operations
 *   temporal.ts        — temporalSearch, temporalCognify
 */

import type { CogneeSearchType, CogneeSearchResult } from './types.js';
import { COGNEE_API_URL } from './config.js';
import type { CogneeClientContext } from './client-context.js';
import { getTenantDatasetName, applyTenantPrefix, stripTenantPrefix } from './tenant-utils.js';
import { add, search, searchRich } from './http-primitives.js';
import {
  addStatementData,
  addTransaction,
  searchSimilarTransactions,
  getCategoryPatterns,
  traceAccountFlows,
  getGSTRuling,
  addCorrection,
  storeMerchantMapping,
  lookupMerchant,
  updateMerchantFromCorrection,
  batchLookupMerchants,
} from './domain.js';
import { cognify, addAndCognify } from './graph-ops.js';
import {
  listDatasets,
  getDatasetStatus,
  getDatasetGraph,
  createDataset,
  isHealthy,
} from './datasets.js';
import { submitFeedback, triggerMemify } from './feedback.js';
import { crossDatasetSearch, searchWithSession, searchAcrossTenants } from './cross-search.js';
import {
  createCogneeUser,
  getCogneeUserTokens,
  refreshCogneeToken,
  revokeUserToken,
} from './user-auth.js';
import {
  createDataPoint,
  getDataPoints,
  deleteDataPoint,
  applyOntology,
  getOntology,
  getNodeSets,
  createNodeSet,
  deleteNodeSet,
} from './datapoints.js';
import { temporalSearch, temporalCognify } from './temporal.js';

export class CogneeClient implements CogneeClientContext {
  readonly baseUrl: string;

  // Wave 3: Per-user token cache for multi-user support
  private userTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
  private static readonly MAX_TOKEN_CACHE_SIZE = 1000;

  // Admin token cache (existing single-admin flow)
  private adminToken: string | null = null;
  private adminTokenExpiresAt: number = 0;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || COGNEE_API_URL;
    setInterval(() => this.sweepExpiredTokens(), 5 * 60 * 1000).unref();
  }

  // ============================================================================
  // CogneeClientContext implementation — token management (stateful)
  // ============================================================================

  async getAuthToken(userId?: string): Promise<string> {
    if (userId) {
      const cached = this.userTokenCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }
    }

    if (this.adminToken && this.adminTokenExpiresAt > Date.now()) {
      return this.adminToken;
    }

    try {
      const adminEmail = process.env.COGNEE_ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = process.env.COGNEE_ADMIN_PASSWORD || 'admin';
      const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminEmail, password: adminPassword }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        const token = String(data.access_token ?? data.token ?? '');
        this.adminToken = token;
        this.adminTokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
        return token;
      }
    } catch {
      // Auth failed — Cognee may have REQUIRE_AUTHENTICATION=false
    }

    return '';
  }

  async authHeaders(userId?: string): Promise<Record<string, string>> {
    const token = await this.getAuthToken(userId);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  private sweepExpiredTokens(): void {
    const now = Date.now();
    for (const [key, value] of this.userTokenCache) {
      if (value.expiresAt <= now) {
        this.userTokenCache.delete(key);
      }
    }
  }

  private evictIfNeeded(): void {
    if (this.userTokenCache.size > CogneeClient.MAX_TOKEN_CACHE_SIZE) {
      const excess = this.userTokenCache.size - CogneeClient.MAX_TOKEN_CACHE_SIZE;
      let deleted = 0;
      for (const key of this.userTokenCache.keys()) {
        if (deleted >= excess) break;
        this.userTokenCache.delete(key);
        deleted++;
      }
    }
  }

  // ============================================================================
  // Wave 3: Token cache management (class-only — mutates private state)
  // ============================================================================

  async setupUserAuth(userId: string, refreshToken: string): Promise<void> {
    const tokens = await refreshCogneeToken(this, refreshToken);
    const expiresIn = Math.min(tokens.expiresIn, 900); // Cap at 15 min
    this.userTokenCache.set(userId, {
      token: tokens.accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    this.evictIfNeeded();
  }

  clearUserToken(userId: string): void {
    this.userTokenCache.delete(userId);
  }

  // ============================================================================
  // Tenant utils delegates
  // ============================================================================

  getTenantDatasetName(tenantId: string, datasetName: string): string {
    return getTenantDatasetName(tenantId, datasetName);
  }

  /** @internal used by sub-modules via CogneeClientContext — kept for callers that rely on it */
  applyTenantPrefixPublic(datasetName: string, tenantId?: string): string {
    return applyTenantPrefix(datasetName, tenantId);
  }

  stripTenantPrefix(datasetName: string, tenantId: string): string {
    return stripTenantPrefix(datasetName, tenantId);
  }

  // ============================================================================
  // HTTP primitives delegates
  // ============================================================================

  async add(data: string[], dataset: string, userId?: string, tenantId?: string): Promise<void> {
    return add(this, data, dataset, userId, tenantId);
  }

  async search(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return search(this, query, dataset, topK, searchType, userId, tenantId);
  }

  async searchRich(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchRich(this, query, dataset, topK, searchType, userId, tenantId);
  }

  // ============================================================================
  // Domain delegates
  // ============================================================================

  async addStatementData(
    statement: {
      id: string;
      filename: string;
      bankName?: string;
      periodStart?: string;
      periodEnd?: string;
    },
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return addStatementData(this, statement, userId, tenantId);
  }

  async addTransaction(
    transaction: {
      date: string;
      description: string;
      amount: number;
      category?: string;
      gstApplicable?: boolean;
    },
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return addTransaction(this, transaction, userId, tenantId);
  }

  async searchSimilarTransactions(
    description: string,
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return searchSimilarTransactions(this, description, userId, tenantId);
  }

  async getCategoryPatterns(
    category: string,
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return getCategoryPatterns(this, category, userId, tenantId);
  }

  async traceAccountFlows(
    accountId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return traceAccountFlows(this, accountId, userId, tenantId);
  }

  async getGSTRuling(
    transactionType: string,
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return getGSTRuling(this, transactionType, userId, tenantId);
  }

  async addCorrection(
    transactionId: string,
    description: string,
    oldCategory: string,
    newCategory: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return addCorrection(
      this,
      transactionId,
      description,
      oldCategory,
      newCategory,
      userId,
      tenantId,
    );
  }

  async storeMerchantMapping(
    abbreviated: string,
    canonical: string,
    abn?: string,
    gstRegistered?: boolean,
    industry?: string,
    defaultCategory?: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return storeMerchantMapping(
      this,
      abbreviated,
      canonical,
      abn,
      gstRegistered,
      industry,
      defaultCategory,
      userId,
      tenantId,
    );
  }

  async lookupMerchant(
    abbreviated: string,
    userId?: string,
    tenantId?: string,
  ): Promise<{
    found: boolean;
    canonical?: string;
    abn?: string;
    gstRegistered?: boolean;
    industry?: string;
    defaultCategory?: string;
  }> {
    return lookupMerchant(this, abbreviated, userId, tenantId);
  }

  async updateMerchantFromCorrection(
    transactionId: string,
    description: string,
    correctedCategory: string,
    correctedMerchant?: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return updateMerchantFromCorrection(
      this,
      transactionId,
      description,
      correctedCategory,
      correctedMerchant,
      userId,
      tenantId,
    );
  }

  async batchLookupMerchants(
    descriptions: string[],
    userId?: string,
    tenantId?: string,
  ): Promise<
    Array<{
      description: string;
      found: boolean;
      canonical?: string;
      category?: string;
      gstRegistered?: boolean;
    }>
  > {
    return batchLookupMerchants(this, descriptions, userId, tenantId);
  }

  // ============================================================================
  // Knowledge graph delegates
  // ============================================================================

  async cognify(
    datasets?: string[],
    background: boolean = true,
    customPrompt?: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return cognify(this, datasets, background, customPrompt, userId, tenantId);
  }

  async addAndCognify(
    data: string[],
    dataset: string,
    background: boolean = true,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return addAndCognify(this, data, dataset, background, userId, tenantId);
  }

  // ============================================================================
  // Dataset management delegates
  // ============================================================================

  async listDatasets(
    userId?: string,
    tenantId?: string,
  ): Promise<Array<{ id: string; name: string }>> {
    return listDatasets(this, userId, tenantId);
  }

  async getDatasetStatus(userId?: string, tenantId?: string): Promise<Record<string, string>> {
    return getDatasetStatus(this, userId, tenantId);
  }

  async getDatasetGraph(
    datasetId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<{ nodes: unknown[]; edges: unknown[] }> {
    return getDatasetGraph(this, datasetId, userId, tenantId);
  }

  async createDataset(name: string, userId?: string, tenantId?: string): Promise<void> {
    return createDataset(this, name, userId, tenantId);
  }

  async isHealthy(): Promise<boolean> {
    return isHealthy(this);
  }

  // ============================================================================
  // Feedback delegates
  // ============================================================================

  async submitFeedback(
    data: {
      entity_id: string;
      feedback_type: string;
      original_value?: string;
      corrected_value?: string;
      context?: Record<string, string>;
    },
    userId?: string,
  ): Promise<void> {
    return submitFeedback(this, data, userId);
  }

  async triggerMemify(
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
    return triggerMemify(this, data, userId, tenantId);
  }

  // ============================================================================
  // Cross-dataset search delegates
  // ============================================================================

  async crossDatasetSearch(
    query: string,
    datasets: string[],
    options?: { searchType?: CogneeSearchType; topK?: number; mergeResults?: boolean },
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return crossDatasetSearch(this, query, datasets, options, userId, tenantId);
  }

  async searchWithSession(
    query: string,
    dataset: string,
    sessionId: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'CHUNKS',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchWithSession(this, query, dataset, sessionId, topK, searchType, userId, tenantId);
  }

  async searchAcrossTenants(
    query: string,
    datasets: string[],
    tenantIds: string[],
    options?: { searchType?: CogneeSearchType; topK?: number },
    userId?: string,
  ): Promise<CogneeSearchResult[]> {
    return searchAcrossTenants(this, query, datasets, tenantIds, options, userId);
  }

  // ============================================================================
  // User auth delegates
  // ============================================================================

  async createCogneeUser(
    email: string,
    password: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    return createCogneeUser(this, email, password);
  }

  async getCogneeUserTokens(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return getCogneeUserTokens(this, email, password);
  }

  async refreshCogneeToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return refreshCogneeToken(this, refreshToken);
  }

  async revokeUserToken(userId: string, refreshToken?: string): Promise<void> {
    this.userTokenCache.delete(userId);
    return revokeUserToken(this, userId, refreshToken);
  }

  // ============================================================================
  // DataPoint / Ontology / NodeSet delegates
  // ============================================================================

  async createDataPoint(
    datasetName: string,
    schema: Record<string, unknown>,
    userId?: string,
    tenantId?: string,
  ): Promise<unknown> {
    return createDataPoint(this, datasetName, schema, userId, tenantId);
  }

  async getDataPoints(datasetName: string, userId?: string, tenantId?: string): Promise<unknown[]> {
    return getDataPoints(this, datasetName, userId, tenantId);
  }

  async deleteDataPoint(
    datasetName: string,
    dpId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return deleteDataPoint(this, datasetName, dpId, userId, tenantId);
  }

  async applyOntology(
    datasetName: string,
    ontology: Record<string, unknown>,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return applyOntology(this, datasetName, ontology, userId, tenantId);
  }

  async getOntology(datasetName: string, userId?: string, tenantId?: string): Promise<unknown> {
    return getOntology(this, datasetName, userId, tenantId);
  }

  async getNodeSets(datasetName: string, userId?: string, tenantId?: string): Promise<unknown[]> {
    return getNodeSets(this, datasetName, userId, tenantId);
  }

  async createNodeSet(
    datasetName: string,
    nodeSet: Record<string, unknown>,
    userId?: string,
    tenantId?: string,
  ): Promise<unknown> {
    return createNodeSet(this, datasetName, nodeSet, userId, tenantId);
  }

  async deleteNodeSet(
    datasetName: string,
    nodeSetId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return deleteNodeSet(this, datasetName, nodeSetId, userId, tenantId);
  }

  // ============================================================================
  // Temporal delegates
  // ============================================================================

  async temporalSearch(
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
    return temporalSearch(this, query, options, userId, tenantId);
  }

  async temporalCognify(
    dataset: string,
    options?: { customPrompt?: string; background?: boolean },
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    return temporalCognify(this, dataset, options, userId, tenantId);
  }
}
