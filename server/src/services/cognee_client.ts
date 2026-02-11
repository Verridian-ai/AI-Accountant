/**
 * Cognee REST API Client
 *
 * TypeScript HTTP client for Cognee knowledge graph operations.
 * Replaces Python subprocess calls with direct REST API interaction.
 */

const COGNEE_API_URL =
  process.env.COGNEE_API_URL || 'http://localhost:8000';

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
   */
  async searchSimilarTransactions(
    description: string
  ): Promise<string[]> {
    return this.search(description, 'bank_transactions');
  }

  /**
   * Get category patterns from knowledge graph.
   */
  async getCategoryPatterns(category: string): Promise<string[]> {
    return this.search(
      `category patterns for ${category}`,
      'bank_transactions'
    );
  }

  /**
   * Trace account flows via knowledge graph.
   */
  async traceAccountFlows(accountId: string): Promise<string[]> {
    return this.search(
      `money flows for account ${accountId}`,
      'transfer_patterns'
    );
  }

  /**
   * Search for GST ruling guidance.
   */
  async getGSTRuling(transactionType: string): Promise<string[]> {
    return this.search(
      `GST treatment for ${transactionType}`,
      'gst_rulings'
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
   */
  async lookupMerchant(abbreviated: string): Promise<{
    found: boolean;
    canonical?: string;
    abn?: string;
    gstRegistered?: boolean;
    industry?: string;
    defaultCategory?: string;
  }> {
    const results = await this.search(
      `merchant mapping for "${abbreviated}"`,
      'merchant_mappings'
    );

    if (results.length === 0) {
      return { found: false };
    }

    // Try to parse structured data from results
    for (const result of results) {
      try {
        const parsed = JSON.parse(result);
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
        if (result.includes(abbreviated) || result.toLowerCase().includes(abbreviated.toLowerCase())) {
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

  /**
   * Build knowledge graph from all indexed data.
   */
  async cognify(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/cognify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Cognify failed: ${res.status}`);
      }
    } catch (err) {
      console.warn('[CogneeClient] Cognify error:', err);
    }
  }

  // --- Internal helpers ---

  private async add(data: string[], dataset: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, dataset_name: dataset }),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Add failed: ${res.status}`);
      }
    } catch (err) {
      console.warn('[CogneeClient] Add error:', err);
    }
  }

  private async search(
    query: string,
    dataset: string
  ): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_text: query,
          query_type: 'INSIGHTS',
          datasets: [dataset],
          top_k: 5,
        }),
      });
      if (!res.ok) {
        console.warn(`[CogneeClient] Search failed: ${res.status}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: unknown) =>
          typeof item === 'string' ? item : JSON.stringify(item)
        );
      }
      return [];
    } catch (err) {
      console.warn('[CogneeClient] Search error:', err);
      return [];
    }
  }
}

export const cogneeClient = new CogneeClient();
