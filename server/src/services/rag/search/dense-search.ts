/**
 * Dense Search Module
 *
 * Implements vector similarity search using FastEmbed embeddings.
 * Uses BAAI/bge-small-en-v1.5 model (384 dimensions) for dense representations.
 *
 * Multi-tenant isolation is enforced by filtering chunks by userId.
 */

import { db, ragChunks } from '../../../schema.js';
import { eq, and, sql } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface DenseSearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;
  /** Filter by category */
  category?: string;
  /** Filter by date range (ISO format) */
  dateStart?: string;
  dateEnd?: string;
  /** Filter by account ID */
  accountId?: string;
  /** Filter by namespace ID (if not using default) */
  namespaceId?: string;
}

export interface DenseSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  rank: number;
  metadata: {
    chunkType: string;
    category: string | null;
    dateStart: string | null;
    dateEnd: string | null;
    accountId: string | null;
    totalAmount: number | null;
    transactionCount: number | null;
    merchantNormalized: string | null;
  };
}

// ============================================================================
// DENSE SEARCH ENGINE
// ============================================================================

export class DenseSearchEngine {
  private embeddingModel: string;
  private embeddingDimensions: number;

  constructor(
    embeddingModel: string = 'BAAI/bge-small-en-v1.5',
    embeddingDimensions: number = 384,
  ) {
    this.embeddingModel = embeddingModel;
    this.embeddingDimensions = embeddingDimensions;
  }

  /**
   * Generate embedding for query text using FastEmbed
   * In production, this would call the FastEmbed API or local model
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    // NOTE: This is a placeholder that should be replaced with actual FastEmbed call
    // For now, we'll generate a mock embedding for development
    // In production, this would use fastembed-py via Python bridge or WASM

    console.log(`[DenseSearch] Generating embedding for query: "${query.slice(0, 50)}..."`);

    // Check if we have a Python FastEmbed service available
    const embedding = await this.callFastEmbed(query);

    if (!embedding || embedding.length !== this.embeddingDimensions) {
      console.warn(`[DenseSearch] FastEmbed returned invalid embedding, using fallback`);
      return this.generateFallbackEmbedding(query);
    }

    return embedding;
  }

  /**
   * Call FastEmbed via Python subprocess
   */
  private async callFastEmbed(text: string): Promise<number[] | null> {
    try {
      // Dynamic import to avoid issues if child_process is not available
      const { spawn } = await import('child_process');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const pythonPath = path.resolve(__dirname, '../../../../venv/Scripts/python.exe');

      return new Promise((resolve) => {
        const pythonCode = `
import json
import sys
try:
    from fastembed import TextEmbedding
    model = TextEmbedding(model_name="${this.embeddingModel}")
    text = json.loads(sys.argv[1])
    embeddings = list(model.embed([text]))
    print(json.dumps(embeddings[0].tolist()))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

        const process = spawn(pythonPath, ['-c', pythonCode, JSON.stringify(text)]);
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (code) => {
          if (code !== 0) {
            console.warn(`[DenseSearch] FastEmbed failed: ${stderr}`);
            resolve(null);
            return;
          }
          try {
            const embedding = JSON.parse(stdout.trim());
            if (Array.isArray(embedding)) {
              resolve(embedding);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });

        process.on('error', () => {
          resolve(null);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          process.kill();
          resolve(null);
        }, 10000);
      });
    } catch {
      return null;
    }
  }

  /**
   * Generate a fallback embedding using simple hashing
   * This is only for development/testing when FastEmbed is not available
   */
  private generateFallbackEmbedding(text: string): number[] {
    console.warn('[DenseSearch] Using fallback embedding - NOT FOR PRODUCTION');

    const embedding = new Array(this.embeddingDimensions).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/);

    // Simple hash-based embedding for development
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % this.embeddingDimensions;
        embedding[idx] += 1 / Math.sqrt(words.length);
      }
    }

    // L2 normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Perform dense vector search for a user
   *
   * NOTE: This implementation fetches chunks in batches to prevent memory issues
   * with large datasets. For optimal performance with very large datasets,
   * consider using a dedicated vector database (e.g., pgvector, Pinecone).
   */
  async search(
    userId: string,
    queryEmbedding: number[],
    options: DenseSearchOptions = {},
  ): Promise<DenseSearchResult[]> {
    const {
      topK = 20,
      minSimilarity = 0.0,
      category,
      dateStart,
      dateEnd,
      accountId,
      namespaceId,
    } = options;

    console.log(`[DenseSearch] Searching for user ${userId}, topK=${topK}`);

    // Build filter conditions - multi-tenant isolation enforced
    const conditions = [eq(ragChunks.userId, userId)];

    if (namespaceId) {
      conditions.push(eq(ragChunks.namespaceId, namespaceId));
    }
    if (category) {
      conditions.push(eq(ragChunks.category, category));
    }
    if (accountId) {
      conditions.push(eq(ragChunks.accountId, accountId));
    }
    if (dateStart) {
      conditions.push(sql`${ragChunks.dateEnd} >= ${dateStart}`);
    }
    if (dateEnd) {
      conditions.push(sql`${ragChunks.dateStart} <= ${dateEnd}`);
    }

    // Batch processing to prevent memory issues with large datasets
    const BATCH_SIZE = 500;
    const MAX_CANDIDATES = 5000; // Safety limit to prevent OOM
    let offset = 0;
    const allResults: Array<DenseSearchResult & { rawSimilarity: number }> = [];

    while (offset < MAX_CANDIDATES) {
      // Fetch chunks with embeddings in batches
      const chunks = await db
        .select({
          id: ragChunks.id,
          documentId: ragChunks.documentId,
          content: ragChunks.content,
          embedding: ragChunks.embedding,
          chunkType: ragChunks.chunkType,
          category: ragChunks.category,
          dateStart: ragChunks.dateStart,
          dateEnd: ragChunks.dateEnd,
          accountId: ragChunks.accountId,
          totalAmount: ragChunks.totalAmount,
          transactionCount: ragChunks.transactionCount,
          merchantNormalized: ragChunks.merchantNormalized,
        })
        .from(ragChunks)
        .where(and(...conditions))
        .limit(BATCH_SIZE)
        .offset(offset);

      if (chunks.length === 0) {
        break; // No more chunks to process
      }

      // Calculate similarities for this batch
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;

        let chunkEmbedding: number[];
        try {
          const parsed = JSON.parse(chunk.embedding);
          // Validate that it's an array of numbers with correct dimensions
          if (!Array.isArray(parsed) || parsed.length !== this.embeddingDimensions) {
            console.warn(`[DenseSearch] Invalid embedding dimensions for chunk ${chunk.id}`);
            continue;
          }
          chunkEmbedding = parsed;
        } catch (error) {
          console.warn(`[DenseSearch] Failed to parse embedding for chunk ${chunk.id}:`, error);
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);

        if (similarity >= minSimilarity) {
          allResults.push({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            similarity,
            rawSimilarity: similarity,
            rank: 0, // Will be set after sorting
            metadata: {
              chunkType: chunk.chunkType,
              category: chunk.category,
              dateStart: chunk.dateStart,
              dateEnd: chunk.dateEnd,
              accountId: chunk.accountId,
              totalAmount: chunk.totalAmount,
              transactionCount: chunk.transactionCount,
              merchantNormalized: chunk.merchantNormalized,
            },
          });
        }
      }

      offset += BATCH_SIZE;

      // Early termination: if we have enough high-quality candidates, stop
      if (allResults.length >= topK * 10) {
        console.log(`[DenseSearch] Early termination: sufficient candidates found`);
        break;
      }
    }

    // Sort by similarity descending and take topK
    allResults.sort((a, b) => b.similarity - a.similarity);
    const topResults = allResults.slice(0, topK);

    // Assign ranks (1-indexed)
    topResults.forEach((result, index) => {
      result.rank = index + 1;
    });

    console.log(
      `[DenseSearch] Found ${topResults.length} results from ${allResults.length} candidates`,
    );
    return topResults;
  }

  /**
   * Batch search for multiple queries
   */
  async batchSearch(
    userId: string,
    queryEmbeddings: number[][],
    options: DenseSearchOptions = {},
  ): Promise<DenseSearchResult[][]> {
    const results = await Promise.all(
      queryEmbeddings.map((embedding) => this.search(userId, embedding, options)),
    );
    return results;
  }

  /**
   * Get the embedding model name
   */
  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  /**
   * Get the embedding dimensions
   */
  getEmbeddingDimensions(): number {
    return this.embeddingDimensions;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const denseSearchEngine = new DenseSearchEngine();
