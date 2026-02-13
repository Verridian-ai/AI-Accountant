/**
 * Cognee REST API Client
 *
 * SINGLE SOURCE OF TRUTH for all Cognee HTTP calls.
 * Both rag.ts and cognee-tools.ts delegate to this client.
 *
 * Key protocol requirements:
 *  - /api/v1/add uses multipart FormData (not JSON)
 *  - /api/v1/search uses field `query` (not `query_text`) and `search_type` (not `query_type`)
 *  - /api/v1/cognify requires `datasets` or `dataset_ids` (empty body = 400)
 *
 * Wave 3: Multi-user support — per-user token cache with LRU eviction,
 * userId parameter on all public methods, user account management.
 * All existing calls without userId continue to use admin token (backward compatible).
 */

const COGNEE_API_URL =
  process.env.COGNEE_API_URL || 'http://localhost:8000';

const REQUEST_TIMEOUT_MS = 30000;
const COGNIFY_TIMEOUT_MS = 300000; // 5 minutes for cognify operations

/**
 * Cognee search types available in v0.5.2.
 * Use the appropriate type for each use case to balance speed vs intelligence.
 */
export type CogneeSearchType =
  | 'SUMMARIES'
  | 'CHUNKS'
  | 'RAG_COMPLETION'
  | 'TRIPLET_COMPLETION'
  | 'GRAPH_COMPLETION'
  | 'GRAPH_SUMMARY_COMPLETION'
  | 'CYPHER'
  | 'NATURAL_LANGUAGE'
  | 'GRAPH_COMPLETION_COT'
  | 'GRAPH_COMPLETION_CONTEXT_EXTENSION'
  | 'FEELING_LUCKY'
  | 'TEMPORAL'
  | 'CODING_RULES'
  | 'CHUNKS_LEXICAL';

/** Search result with extracted text and optional metadata */
export interface CogneeSearchResult {
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

/** Custom prompt for financial domain entity extraction during cognify */
const FINANCIAL_COGNIFY_PROMPT =
  'Extract financial entities: merchant names, transaction categories, ' +
  'ABN numbers, GST registration status, payment methods, account references, ' +
  'recurring transaction patterns, and financial relationships between entities. ' +
  'Identify temporal patterns like weekly/monthly/quarterly transactions.';

export class CogneeClient {
  private baseUrl: string;

  // Wave 3: Per-user token cache for multi-user support
  // LRU-bounded to MAX_TOKEN_CACHE_SIZE entries (D03 S5 fix)
  private userTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();
  private static readonly MAX_TOKEN_CACHE_SIZE = 1000;

  // Admin token cache (existing single-admin flow)
  private adminToken: string | null = null;
  private adminTokenExpiresAt: number = 0;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || COGNEE_API_URL;

    // Wave 3: Sweep expired tokens every 5 minutes
    setInterval(() => this.sweepExpiredTokens(), 5 * 60 * 1000).unref();
  }

  // ============================================================================
  // Wave 23: Tenant Dataset Isolation
  // ============================================================================

  /**
   * Prefix a dataset name with the tenant identifier for multi-tenant isolation.
   * When tenantId is provided, returns `tenant_${tenantId}_${datasetName}`.
   * When tenantId is absent or empty, returns the original name (backward compatible).
   */
  getTenantDatasetName(tenantId: string, datasetName: string): string {
    return `tenant_${tenantId}_${datasetName}`;
  }

  /**
   * Apply tenant prefix to a dataset name if tenantId is provided.
   * Returns the original name when tenantId is absent (backward compatible).
   */
  private applyTenantPrefix(datasetName: string, tenantId?: string): string {
    if (tenantId) {
      return this.getTenantDatasetName(tenantId, datasetName);
    }
    return datasetName;
  }

  /**
   * Apply tenant prefix to an array of dataset names.
   */
  private applyTenantPrefixToAll(datasets: string[], tenantId?: string): string[] {
    if (!tenantId) return datasets;
    return datasets.map(ds => this.getTenantDatasetName(tenantId, ds));
  }

  /**
   * Strip tenant prefix from a dataset name to recover the logical name.
   */
  private stripTenantPrefix(datasetName: string, tenantId: string): string {
    const prefix = `tenant_${tenantId}_`;
    return datasetName.startsWith(prefix) ? datasetName.slice(prefix.length) : datasetName;
  }

  /**
   * Search across multiple tenants' datasets (admin-only).
   * Combines datasets from all specified tenants and runs a single search.
   *
   * @param query - Search query
   * @param datasets - Logical dataset names (without tenant prefix)
   * @param tenantIds - Tenant IDs to search across
   * @param options - Search options (searchType, topK)
   * @param userId - Optional user ID for auth
   */
  async searchAcrossTenants(
    query: string,
    datasets: string[],
    tenantIds: string[],
    options?: {
      searchType?: CogneeSearchType;
      topK?: number;
    },
    userId?: string,
  ): Promise<CogneeSearchResult[]> {
    const allDatasets = tenantIds.flatMap(tid =>
      datasets.map(ds => this.getTenantDatasetName(tid, ds))
    );
    return this.crossDatasetSearch(query, allDatasets, {
      searchType: options?.searchType ?? 'CHUNKS',
      topK: options?.topK ?? 5,
    }, userId);
  }

  // ============================================================================
  // Wave 3: Token Management
  // ============================================================================

  /**
   * Get an auth token for Cognee API calls (Wave 3 multi-user).
   * If userId provided, checks per-user cache first, then falls back to admin token.
   * Without userId, returns admin token (backward compatible).
   */
  async getAuthToken(userId?: string): Promise<string> {
    // If userId provided, check per-user cache first
    if (userId) {
      const cached = this.userTokenCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }
      // Fall through to admin token if user not set up
    }

    // Admin token logic — check cache, then authenticate
    if (this.adminToken && this.adminTokenExpiresAt > Date.now()) {
      return this.adminToken;
    }

    // Try to authenticate as admin
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

    // Return empty string if no auth available (Cognee ignores when auth disabled)
    return '';
  }

  /**
   * Build auth headers for a request (Wave 3).
   * Returns empty object if no token available (backward compatible with auth-disabled Cognee).
   */
  private async authHeaders(userId?: string): Promise<Record<string, string>> {
    const token = await this.getAuthToken(userId);
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }

  /**
   * Sweep expired entries from the token cache (Wave 3).
   * Runs on a 5-minute interval via setInterval.
   */
  private sweepExpiredTokens(): void {
    const now = Date.now();
    for (const [key, value] of this.userTokenCache) {
      if (value.expiresAt <= now) {
        this.userTokenCache.delete(key);
      }
    }
  }

  /**
   * LRU eviction: if cache exceeds MAX_TOKEN_CACHE_SIZE, remove oldest entries (Wave 3).
   * Map insertion order = iteration order; oldest entries are first.
   */
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
  // Wave 3: User Account Management
  // ============================================================================

  /**
   * Create a Cognee user account (Wave 3 multi-user).
   * SECURITY: The password is used ONLY for initial account creation and immediate
   * token retrieval. It is NOT stored — only the resulting refresh token is kept.
   */
  async createCogneeUser(email: string, password: string): Promise<{ userId: string; refreshToken: string }> {
    const adminHeaders = await this.authHeaders();
    const response = await fetch(`${this.baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...adminHeaders,
      },
      body: JSON.stringify({ username: email, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Failed to create Cognee user: ${response.status}`);
    }
    const result = await response.json();

    // Immediately authenticate to get tokens — discard password after this
    const tokens = await this.getCogneeUserTokens(email, password);
    return { userId: result.userId ?? result.id, refreshToken: tokens.refreshToken };
  }

  /**
   * Get Cognee auth tokens for a specific user (Wave 3 multi-user).
   * Returns BOTH access_token (short-lived, < 15 min) and refresh_token.
   */
  async getCogneeUserTokens(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Cognee user auth failed: ${response.status}`);
    }
    const data = await response.json();
    return {
      accessToken: data.access_token ?? data.token,
      refreshToken: data.refresh_token ?? data.access_token ?? data.token,
      expiresIn: data.expires_in ?? 900,
    };
  }

  /**
   * Refresh a Cognee access token using a stored refresh token (Wave 3).
   * This replaces password-based re-auth per D02 CRIT-03.
   */
  async refreshCogneeToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Cognee token refresh failed: ${response.status}`);
    }
    const data = await response.json();
    return {
      accessToken: data.access_token ?? data.token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in ?? 900,
    };
  }

  /**
   * Set up per-user auth token cache entry using refresh token (Wave 3).
   * Token lifetime capped at 15 min per D02 CRIT-03.
   */
  async setupUserAuth(userId: string, refreshToken: string): Promise<void> {
    const tokens = await this.refreshCogneeToken(refreshToken);
    const expiresIn = Math.min(tokens.expiresIn, 900); // Cap at 15 min
    this.userTokenCache.set(userId, {
      token: tokens.accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    this.evictIfNeeded();
  }

  /**
   * Clear cached token for a user (Wave 3) — call on logout/session expiry.
   */
  clearUserToken(userId: string): void {
    this.userTokenCache.delete(userId);
  }

  /**
   * Revoke a Cognee user's tokens (Wave 3) — call on session expiry/logout.
   */
  async revokeUserToken(userId: string, refreshToken?: string): Promise<void> {
    this.userTokenCache.delete(userId);
    if (refreshToken) {
      try {
        await fetch(`${this.baseUrl}/api/v1/auth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (e) {
        console.warn(`[CogneeClient] Failed to revoke Cognee token for user ${userId}:`, e);
      }
    }
  }

  // ============================================================================
  // Domain Convenience Methods (with userId passthrough)
  // ============================================================================

  /**
   * Add statement data to Cognee for knowledge graph building.
   */
  async addStatementData(statement: {
    id: string;
    filename: string;
    bankName?: string;
    periodStart?: string;
    periodEnd?: string;
  }, userId?: string, tenantId?: string): Promise<void> {
    const text = `Statement: ${statement.filename}, Bank: ${statement.bankName || 'Unknown'}, Period: ${statement.periodStart || 'N/A'} to ${statement.periodEnd || 'N/A'}`;
    await this.add([text], 'bank_formats', userId, tenantId);
  }

  /**
   * Add a transaction to Cognee for merchant memory and pattern learning.
   */
  async addTransaction(transaction: {
    date: string;
    description: string;
    amount: number;
    category?: string;
    gstApplicable?: boolean;
  }, userId?: string, tenantId?: string): Promise<void> {
    const text = `Date: ${transaction.date}, Description: ${transaction.description}, Amount: ${transaction.amount / 100}, Category: ${transaction.category || 'Uncategorized'}, GST: ${transaction.gstApplicable ? 'Yes' : 'No'}`;
    await this.add([text], 'bank_transactions', userId, tenantId);
  }

  /**
   * Search for similar transactions by description.
   * Uses CHUNKS for fast vector similarity (no LLM call needed).
   */
  async searchSimilarTransactions(
    description: string,
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    return this.search(description, 'bank_transactions', 5, 'CHUNKS', userId, tenantId);
  }

  /**
   * Get category patterns from knowledge graph.
   * Uses GRAPH_COMPLETION for reasoning about patterns.
   */
  async getCategoryPatterns(category: string, userId?: string, tenantId?: string): Promise<string[]> {
    return this.search(
      `category patterns for ${category}`,
      'bank_transactions',
      5,
      'GRAPH_COMPLETION',
      userId,
      tenantId,
    );
  }

  /**
   * Trace account flows via knowledge graph.
   * Uses GRAPH_COMPLETION_COT for chain-of-thought reasoning over flows.
   */
  async traceAccountFlows(accountId: string, userId?: string, tenantId?: string): Promise<string[]> {
    return this.search(
      `money flows for account ${accountId}`,
      'transfer_patterns',
      5,
      'GRAPH_COMPLETION_COT',
      userId,
      tenantId,
    );
  }

  /**
   * Search for GST ruling guidance.
   * Uses RAG_COMPLETION for retrieval-augmented generation.
   */
  async getGSTRuling(transactionType: string, userId?: string, tenantId?: string): Promise<string[]> {
    return this.search(
      `GST treatment for ${transactionType}`,
      'gst_rules',
      5,
      'RAG_COMPLETION',
      userId,
      tenantId,
    );
  }

  /**
   * Add a user correction for learning.
   */
  async addCorrection(
    transactionId: string,
    description: string,
    oldCategory: string,
    newCategory: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    const text = `Correction: "${description}" changed from "${oldCategory}" to "${newCategory}" (transaction ${transactionId})`;
    await this.add([text], 'bank_transactions', userId, tenantId);
  }

  // --- Merchant Memory System ---

  /**
   * Store a merchant mapping in Cognee for future reference.
   */
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
    const mappingData = JSON.stringify({
      type: 'merchant_mapping',
      abbreviated,
      canonical,
      abn: abn || null,
      gstRegistered: gstRegistered ?? true,
      industry: industry || 'Unknown',
      defaultCategory: defaultCategory || 'General Expenses',
      lastVerified: new Date().toISOString(),
    });

    const text = `Merchant: "${abbreviated}" → "${canonical}", ABN: ${abn || 'N/A'}, GST: ${gstRegistered ? 'Yes' : 'No'}, Industry: ${industry || 'Unknown'}, Category: ${defaultCategory || 'General'}`;
    await this.add([text, mappingData], 'merchant_mappings', userId, tenantId);
  }

  /**
   * Look up a previously mapped merchant.
   * Uses CHUNKS_LEXICAL for fast keyword-based matching (no embeddings).
   */
  async lookupMerchant(abbreviated: string, userId?: string, tenantId?: string): Promise<{
    found: boolean;
    canonical?: string;
    abn?: string;
    gstRegistered?: boolean;
    industry?: string;
    defaultCategory?: string;
  }> {
    const results = await this.searchRich(
      `merchant mapping for "${abbreviated}"`,
      'merchant_mappings',
      5,
      'CHUNKS_LEXICAL',
      userId,
      tenantId,
    );

    if (results.length === 0) {
      return { found: false };
    }

    // Try to parse structured data from results
    for (const result of results) {
      try {
        const parsed = JSON.parse(result.text);
        if (parsed.type === 'merchant_mapping') {
          return {
            found: true,
            canonical: parsed.canonical,
            abn: parsed.abn,
            gstRegistered: parsed.gstRegistered,
            industry: parsed.industry,
            defaultCategory: parsed.defaultCategory,
          };
        }
      } catch {
        // If not JSON, extract from text format
        if (result.text.includes(abbreviated) || result.text.toLowerCase().includes(abbreviated.toLowerCase())) {
          return { found: true };
        }
      }
    }

    return { found: results.length > 0 };
  }

  /**
   * Update merchant mapping from a user correction.
   * Learns from user edits to improve future categorization.
   */
  async updateMerchantFromCorrection(
    transactionId: string,
    description: string,
    correctedCategory: string,
    correctedMerchant?: string,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    const correctionText = `Merchant correction: "${description}" → Category: "${correctedCategory}"${correctedMerchant ? `, Merchant: "${correctedMerchant}"` : ''}`;
    await this.add([correctionText], 'merchant_mappings', userId, tenantId);

    // Also add to corrections dataset for pattern learning
    const correctionData = JSON.stringify({
      type: 'merchant_correction',
      transactionId,
      originalDescription: description,
      correctedCategory,
      correctedMerchant: correctedMerchant || null,
      timestamp: new Date().toISOString(),
    });
    await this.add([correctionData], 'merchant_corrections', userId, tenantId);
  }

  /**
   * Batch enrich uncategorized merchants through Cognee.
   * Returns mappings for known merchants.
   */
  async batchLookupMerchants(
    descriptions: string[],
    userId?: string,
    tenantId?: string,
  ): Promise<Array<{
    description: string;
    found: boolean;
    canonical?: string;
    category?: string;
    gstRegistered?: boolean;
  }>> {
    const results: Array<{
      description: string;
      found: boolean;
      canonical?: string;
      category?: string;
      gstRegistered?: boolean;
    }> = [];

    for (const desc of descriptions) {
      const lookup = await this.lookupMerchant(desc, userId, tenantId);
      results.push({
        description: desc,
        found: lookup.found,
        canonical: lookup.canonical,
        category: lookup.defaultCategory,
        gstRegistered: lookup.gstRegistered,
      });
    }

    return results;
  }

  // ============================================================================
  // Knowledge Graph Operations
  // ============================================================================

  /**
   * Build knowledge graph from indexed data.
   * Requires dataset names — sending an empty body returns 400.
   *
   * @param datasets - Dataset names to cognify. If omitted, fetches all datasets.
   * @param background - Run in background (non-blocking). Default: true.
   * @param customPrompt - Custom prompt for entity extraction. Uses financial domain prompt by default.
   * @param userId - Optional user ID for per-user auth (Wave 3).
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async cognify(
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
        const allDatasets = await this.listDatasets(userId, tenantId);
        datasetNames = allDatasets.map(d => d.name);
        if (datasetNames.length === 0) {
          console.warn('[CogneeClient] No datasets found to cognify');
          return;
        }
      } else {
        // Apply tenant prefix to the provided dataset names
        datasetNames = this.applyTenantPrefixToAll(datasetNames, tenantId);
      }

      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/cognify`, {
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
        console.log(`[CogneeClient] Cognify triggered for datasets: ${datasetNames.join(', ')} (background: ${background})`);
      }
    } catch (err) {
      console.warn('[CogneeClient] Cognify error:', err);
    }
  }

  /**
   * Add data then trigger cognify for the dataset.
   * Convenience method for the common add-then-build pattern.
   *
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async addAndCognify(
    data: string[],
    dataset: string,
    background: boolean = true,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    await this.add(data, dataset, userId, tenantId);
    await this.cognify([dataset], background, undefined, userId, tenantId);
  }

  // ============================================================================
  // Dataset Management
  // ============================================================================

  /**
   * List datasets in Cognee.
   * If tenantId is provided, filters to only datasets matching `tenant_${tenantId}_*` prefix.
   * If no tenantId (admin), returns all datasets.
   *
   * @param tenantId - Optional tenant ID to filter datasets (Wave 23).
   */
  async listDatasets(userId?: string, tenantId?: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets`, {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] List datasets failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        let datasets = data.map((d: any) => ({
          id: d.id || d.dataset_id || '',
          name: d.name || d.dataset_name || '',
        }));

        // Wave 23: Filter by tenant prefix if tenantId provided
        if (tenantId) {
          const prefix = `tenant_${tenantId}_`;
          datasets = datasets.filter(d => d.name.startsWith(prefix));
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
   *
   * @param tenantId - Optional tenant ID to filter status (Wave 23).
   */
  async getDatasetStatus(userId?: string, tenantId?: string): Promise<Record<string, string>> {
    try {
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/status`, {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Dataset status failed: ${res.status}`);
        return {};
      }
      const statusMap = await res.json() as Record<string, string>;

      // Wave 23: Filter by tenant prefix if tenantId provided
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
   *
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async getDatasetGraph(datasetId: string, userId?: string, tenantId?: string): Promise<{ nodes: unknown[]; edges: unknown[] }> {
    try {
      const prefixedId = this.applyTenantPrefix(datasetId, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedId)}/graph`, {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
   *
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async createDataset(name: string, userId?: string, tenantId?: string): Promise<void> {
    try {
      const prefixedName = this.applyTenantPrefix(name, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets`, {
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
  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/settings`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Wave 3: Feedback & Memify (called by cognee-feedback.ts)
  // ============================================================================

  /**
   * Submit feedback to Cognee API for entity corrections.
   */
  async submitFeedback(data: {
    entity_id: string;
    feedback_type: string;
    original_value?: string;
    corrected_value?: string;
    context?: Record<string, string>;
  }, userId?: string): Promise<void> {
    try {
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/feedback`, {
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
  async triggerMemify(data: {
    datasets: string[];
    feedback_data?: Array<{
      entity_id: string;
      feedback_type: string;
      original_value?: string;
      corrected_value?: string;
    }>;
    run_in_background?: boolean;
  }, userId?: string, tenantId?: string): Promise<void> {
    try {
      const prefixedData = {
        ...data,
        datasets: this.applyTenantPrefixToAll(data.datasets, tenantId),
      };
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/memify`, {
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

  // ============================================================================
  // Wave 3: Cross-Dataset & Session-Aware Search
  // ============================================================================

  /**
   * Search across multiple datasets and merge results (Wave 3).
   * Used by market-cognee-indexer and cdr-cognee-indexer for cross-domain queries.
   *
   * Note: When called from searchAcrossTenants, datasets are already prefixed.
   * When called directly, tenantId can be passed to prefix all datasets.
   *
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async crossDatasetSearch(
    query: string,
    datasets: string[],
    options?: {
      searchType?: CogneeSearchType;
      topK?: number;
      mergeResults?: boolean;
    },
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    const searchType = options?.searchType ?? 'CHUNKS';
    const topK = options?.topK ?? 5;
    const prefixedDatasets = this.applyTenantPrefixToAll(datasets, tenantId);

    try {
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          query,
          search_type: searchType,
          datasets: prefixedDatasets,
          top_k: topK,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Cross-dataset search failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: unknown) => this.parseSearchResult(item));
      }
      return [];
    } catch (err) {
      console.warn('[CogneeClient] Cross-dataset search error:', err);
      return [];
    }
  }

  /**
   * Search with conversational session context (Wave 3).
   * Passes session_id to Cognee for memory-aware retrieval.
   */
  async searchWithSession(
    query: string,
    dataset: string,
    sessionId: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'CHUNKS',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    try {
      const prefixedDataset = this.applyTenantPrefix(dataset, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          query,
          search_type: searchType,
          datasets: [prefixedDataset],
          top_k: topK,
          session_id: sessionId,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Session search failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: unknown) => this.parseSearchResult(item));
      }
      return [];
    } catch (err) {
      console.warn('[CogneeClient] Session search error:', err);
      return [];
    }
  }

  // ============================================================================
  // Wave 3: DataPoint & Ontology Operations (called by wrapper services)
  // ============================================================================

  /**
   * Create a DataPoint extraction schema on a dataset.
   */
  async createDataPoint(datasetName: string, schema: Record<string, unknown>, userId?: string, tenantId?: string): Promise<unknown> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/datapoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(schema),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async getDataPoints(datasetName: string, userId?: string, tenantId?: string): Promise<unknown[]> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/datapoints`, {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async deleteDataPoint(datasetName: string, dpId: string, userId?: string, tenantId?: string): Promise<void> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/datapoints/${encodeURIComponent(dpId)}`, {
        method: 'DELETE',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async applyOntology(datasetName: string, ontology: Record<string, unknown>, userId?: string, tenantId?: string): Promise<void> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/ontology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(ontology),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async getOntology(datasetName: string, userId?: string, tenantId?: string): Promise<unknown> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/ontology`, {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async getNodeSets(datasetName: string, userId?: string, tenantId?: string): Promise<unknown[]> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/nodesets`, {
        method: 'GET',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async createNodeSet(datasetName: string, nodeSet: Record<string, unknown>, userId?: string, tenantId?: string): Promise<unknown> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/nodesets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(nodeSet),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
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
  async deleteNodeSet(datasetName: string, nodeSetId: string, userId?: string, tenantId?: string): Promise<void> {
    try {
      const prefixedName = this.applyTenantPrefix(datasetName, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(prefixedName)}/nodesets/${encodeURIComponent(nodeSetId)}`, {
        method: 'DELETE',
        headers: { ...auth },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Delete nodeset failed: ${res.status}`);
      }
    } catch (err) {
      console.warn('[CogneeClient] Delete nodeset error:', err);
    }
  }

  // ============================================================================
  // Wave 3: Temporal Operations (called by temporal-cognify.ts)
  // ============================================================================

  /**
   * Temporal-aware search with date range context.
   */
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
    const augmentedQuery = options.timeStart && options.timeEnd
      ? `${query} [period: ${options.timeStart} to ${options.timeEnd}]`
      : query;

    return this.searchRich(
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
   */
  async temporalCognify(
    dataset: string,
    options?: {
      customPrompt?: string;
      background?: boolean;
    },
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    const prompt = options?.customPrompt ??
      `${FINANCIAL_COGNIFY_PROMPT} Also extract temporal entities: dates, periods, financial years, BAS quarters.`;
    await this.cognify([dataset], options?.background ?? true, prompt, userId, tenantId);
  }

  // ============================================================================
  // Low-level helpers (public for delegation from rag.ts / cognee-tools.ts)
  // ============================================================================

  async add(data: string[], dataset: string, userId?: string, tenantId?: string): Promise<void> {
    try {
      const prefixedDataset = this.applyTenantPrefix(dataset, tenantId);
      const content = data.join('\n\n');
      const formData = new FormData();
      formData.append('data', new Blob([content], { type: 'text/plain' }), `${prefixedDataset}.txt`);
      formData.append('datasetName', prefixedDataset);

      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/add`, {
        method: 'POST',
        headers: { ...auth },
        body: formData,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Add failed: ${res.status}`);
      }
    } catch (err) {
      console.warn('[CogneeClient] Add error:', err);
    }
  }

  /**
   * Search Cognee with configurable search type.
   * Returns plain text strings for backward compatibility.
   *
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async search(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<string[]> {
    const results = await this.searchRich(query, dataset, topK, searchType, userId, tenantId);
    return results.map(r => r.text);
  }

  /**
   * Search Cognee returning rich result objects with metadata.
   * Properly extracts text from Cognee's structured response objects.
   *
   * @param tenantId - Optional tenant ID for dataset prefixing (Wave 23).
   */
  async searchRich(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION',
    userId?: string,
    tenantId?: string,
  ): Promise<CogneeSearchResult[]> {
    try {
      const prefixedDataset = this.applyTenantPrefix(dataset, tenantId);
      const auth = await this.authHeaders(userId);
      const res = await fetch(`${this.baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          query,
          search_type: searchType,
          datasets: [prefixedDataset],
          top_k: topK,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Search failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: unknown) => this.parseSearchResult(item));
      }
      return [];
    } catch (err) {
      console.warn('[CogneeClient] Search error:', err);
      return [];
    }
  }

  /**
   * Parse a single search result item from Cognee's response.
   * Cognee returns different shapes depending on search type:
   *  - string (GRAPH_COMPLETION completions)
   *  - { text, ... } (CHUNKS, SUMMARIES)
   *  - { content, ... } (some completion types)
   *  - { document_id, chunk_id, text, score, ... } (CHUNKS with metadata)
   */
  private parseSearchResult(item: unknown): CogneeSearchResult {
    if (typeof item === 'string') {
      return { text: item };
    }

    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;

      // Extract text from common Cognee response fields
      const text =
        (typeof obj.text === 'string' ? obj.text : null) ??
        (typeof obj.content === 'string' ? obj.content : null) ??
        (typeof obj.chunk_text === 'string' ? obj.chunk_text : null) ??
        (typeof obj.summary === 'string' ? obj.summary : null) ??
        (typeof obj.answer === 'string' ? obj.answer : null) ??
        JSON.stringify(item);

      const score = typeof obj.score === 'number' ? obj.score : undefined;

      // Collect metadata fields
      const metadata: Record<string, unknown> = {};
      for (const key of ['document_id', 'chunk_id', 'node_id', 'type', 'source']) {
        if (obj[key] !== undefined) {
          metadata[key] = obj[key];
        }
      }

      return {
        text,
        score,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    }

    return { text: String(item) };
  }
}

export const cogneeClient = new CogneeClient();
