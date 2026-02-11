/**
 * Claude Agent Framework — Cognee RAG Tools
 *
 * Wraps Cognee REST API for use as Claude agent tools.
 */

const COGNEE_API_URL =
  process.env.COGNEE_API_URL || 'http://localhost:8000';

export interface CogneeToolConfig {
  searchTopK: number;
  indexBatchSize: number;
  datasetPrefix: string;
}

const DEFAULT_CONFIG: CogneeToolConfig = {
  searchTopK: 5,
  indexBatchSize: 50,
  datasetPrefix: '',
};

export class CogneeTools {
  private config: CogneeToolConfig;

  constructor(config: Partial<CogneeToolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search Cognee knowledge graph for relevant context.
   */
  async search(query: string, dataset: string): Promise<string[]> {
    try {
      const res = await fetch(`${COGNEE_API_URL}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_text: query,
          query_type: 'INSIGHTS',
          datasets: [this.prefixDataset(dataset)],
          top_k: this.config.searchTopK,
        }),
      });

      if (!res.ok) {
        console.warn(`[CogneeTools] Search failed: ${res.status}`);
        return [];
      }

      const data = await res.json();
      // Cognee returns array of result objects; extract text content
      if (Array.isArray(data)) {
        return data.map((item: Record<string, unknown>) =>
          typeof item === 'string' ? item : JSON.stringify(item)
        );
      }
      return [];
    } catch (err) {
      console.warn('[CogneeTools] Search error:', err);
      return [];
    }
  }

  /**
   * Index data into a Cognee dataset.
   */
  async index(data: string[], dataset: string): Promise<void> {
    try {
      // Batch in chunks
      for (let i = 0; i < data.length; i += this.config.indexBatchSize) {
        const batch = data.slice(i, i + this.config.indexBatchSize);
        const res = await fetch(`${COGNEE_API_URL}/api/v1/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: batch,
            dataset_name: this.prefixDataset(dataset),
          }),
        });

        if (!res.ok) {
          console.warn(`[CogneeTools] Index failed: ${res.status}`);
        }
      }
    } catch (err) {
      console.warn('[CogneeTools] Index error:', err);
    }
  }

  /**
   * Build knowledge graph from indexed data.
   */
  async cognify(dataset: string): Promise<void> {
    try {
      const res = await fetch(`${COGNEE_API_URL}/api/v1/cognify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasets: [this.prefixDataset(dataset)],
        }),
      });

      if (!res.ok) {
        console.warn(`[CogneeTools] Cognify failed: ${res.status}`);
      }
    } catch (err) {
      console.warn('[CogneeTools] Cognify error:', err);
    }
  }

  private prefixDataset(dataset: string): string {
    return this.config.datasetPrefix
      ? `${this.config.datasetPrefix}_${dataset}`
      : dataset;
  }
}

export const cogneeTools = new CogneeTools();
