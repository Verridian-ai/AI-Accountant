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

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || COGNEE_API_URL;
  }

  /**
   * Add statement data to Cognee for knowledge graph building.
   */
  async addStatementData(statement: {
    id: string;
    filename: string;
    bankName?: string;
    periodStart?: string;
    periodEnd?: string;
  }): Promise<void> {
    const text = `Statement: ${statement.filename}, Bank: ${statement.bankName || 'Unknown'}, Period: ${statement.periodStart || 'N/A'} to ${statement.periodEnd || 'N/A'}`;
    await this.add([text], 'bank_formats');
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
  }): Promise<void> {
    const text = `Date: ${transaction.date}, Description: ${transaction.description}, Amount: ${transaction.amount / 100}, Category: ${transaction.category || 'Uncategorized'}, GST: ${transaction.gstApplicable ? 'Yes' : 'No'}`;
    await this.add([text], 'bank_transactions');
  }

  /**
   * Search for similar transactions by description.
   * Uses CHUNKS for fast vector similarity (no LLM call needed).
   */
  async searchSimilarTransactions(
    description: string
  ): Promise<string[]> {
    return this.search(description, 'bank_transactions', 5, 'CHUNKS');
  }

  /**
   * Get category patterns from knowledge graph.
   * Uses GRAPH_COMPLETION for reasoning about patterns.
   */
  async getCategoryPatterns(category: string): Promise<string[]> {
    return this.search(
      `category patterns for ${category}`,
      'bank_transactions',
      5,
      'GRAPH_COMPLETION'
    );
  }

  /**
   * Trace account flows via knowledge graph.
   * Uses GRAPH_COMPLETION_COT for chain-of-thought reasoning over flows.
   */
  async traceAccountFlows(accountId: string): Promise<string[]> {
    return this.search(
      `money flows for account ${accountId}`,
      'transfer_patterns',
      5,
      'GRAPH_COMPLETION_COT'
    );
  }

  /**
   * Search for GST ruling guidance.
   * Uses RAG_COMPLETION for retrieval-augmented generation.
   */
  async getGSTRuling(transactionType: string): Promise<string[]> {
    return this.search(
      `GST treatment for ${transactionType}`,
      'gst_rules',
      5,
      'RAG_COMPLETION'
    );
  }

  /**
   * Add a user correction for learning.
   */
  async addCorrection(
    transactionId: string,
    description: string,
    oldCategory: string,
    newCategory: string
  ): Promise<void> {
    const text = `Correction: "${description}" changed from "${oldCategory}" to "${newCategory}" (transaction ${transactionId})`;
    await this.add([text], 'bank_transactions');
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
    defaultCategory?: string
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
    await this.add([text, mappingData], 'merchant_mappings');
  }

  /**
   * Look up a previously mapped merchant.
   * Uses CHUNKS_LEXICAL for fast keyword-based matching (no embeddings).
   */
  async lookupMerchant(abbreviated: string): Promise<{
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
      'CHUNKS_LEXICAL'
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
    correctedMerchant?: string
  ): Promise<void> {
    const correctionText = `Merchant correction: "${description}" → Category: "${correctedCategory}"${correctedMerchant ? `, Merchant: "${correctedMerchant}"` : ''}`;
    await this.add([correctionText], 'merchant_mappings');

    // Also add to corrections dataset for pattern learning
    const correctionData = JSON.stringify({
      type: 'merchant_correction',
      transactionId,
      originalDescription: description,
      correctedCategory,
      correctedMerchant: correctedMerchant || null,
      timestamp: new Date().toISOString(),
    });
    await this.add([correctionData], 'merchant_corrections');
  }

  /**
   * Batch enrich uncategorized merchants through Cognee.
   * Returns mappings for known merchants.
   */
  async batchLookupMerchants(
    descriptions: string[]
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
      const lookup = await this.lookupMerchant(desc);
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

  // --- Knowledge Graph Operations ---

  /**
   * Build knowledge graph from indexed data.
   * Requires dataset names — sending an empty body returns 400.
   *
   * @param datasets - Dataset names to cognify. If omitted, fetches all datasets.
   * @param background - Run in background (non-blocking). Default: true.
   * @param customPrompt - Custom prompt for entity extraction. Uses financial domain prompt by default.
   */
  async cognify(
    datasets?: string[],
    background: boolean = true,
    customPrompt?: string
  ): Promise<void> {
    try {
      // If no datasets specified, fetch all available datasets
      let datasetNames = datasets;
      if (!datasetNames || datasetNames.length === 0) {
        const allDatasets = await this.listDatasets();
        datasetNames = allDatasets.map(d => d.name);
        if (datasetNames.length === 0) {
          console.warn('[CogneeClient] No datasets found to cognify');
          return;
        }
      }

      const res = await fetch(`${this.baseUrl}/api/v1/cognify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
   */
  async addAndCognify(
    data: string[],
    dataset: string,
    background: boolean = true
  ): Promise<void> {
    await this.add(data, dataset);
    await this.cognify([dataset], background);
  }

  // --- Dataset Management ---

  /**
   * List all datasets in Cognee.
   */
  async listDatasets(): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/datasets`, {
        method: 'GET',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] List datasets failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((d: any) => ({
          id: d.id || d.dataset_id || '',
          name: d.name || d.dataset_name || '',
        }));
      }
      return [];
    } catch (err) {
      console.warn('[CogneeClient] List datasets error:', err);
      return [];
    }
  }

  /**
   * Get processing status for datasets.
   */
  async getDatasetStatus(): Promise<Record<string, string>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Dataset status failed: ${res.status}`);
        return {};
      }
      return await res.json();
    } catch (err) {
      console.warn('[CogneeClient] Dataset status error:', err);
      return {};
    }
  }

  /**
   * Get the knowledge graph for a specific dataset.
   */
  async getDatasetGraph(datasetId: string): Promise<{ nodes: unknown[]; edges: unknown[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/datasets/${encodeURIComponent(datasetId)}/graph`, {
        method: 'GET',
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
   */
  async createDataset(name: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
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

  // --- Low-level helpers (public for delegation from rag.ts / cognee-tools.ts) ---

  async add(data: string[], dataset: string): Promise<void> {
    try {
      const content = data.join('\n\n');
      const formData = new FormData();
      formData.append('data', new Blob([content], { type: 'text/plain' }), `${dataset}.txt`);
      formData.append('datasetName', dataset);

      const res = await fetch(`${this.baseUrl}/api/v1/add`, {
        method: 'POST',
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
   */
  async search(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION'
  ): Promise<string[]> {
    const results = await this.searchRich(query, dataset, topK, searchType);
    return results.map(r => r.text);
  }

  /**
   * Search Cognee returning rich result objects with metadata.
   * Properly extracts text from Cognee's structured response objects.
   */
  async searchRich(
    query: string,
    dataset: string,
    topK: number = 5,
    searchType: CogneeSearchType = 'GRAPH_COMPLETION'
  ): Promise<CogneeSearchResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          search_type: searchType,
          datasets: [dataset],
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
