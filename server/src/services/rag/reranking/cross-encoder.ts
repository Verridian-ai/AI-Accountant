/**
 * Cross-Encoder Reranking Module
 *
 * Provides semantic reranking using cross-encoder models.
 * Supports local MS-MARCO MiniLM model via Python inference
 * with Cohere API fallback for production reliability.
 * Types from cross-encoder-types.ts, inference from cross-encoder-inference.ts.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import type {
  CrossEncoderConfig,
  RerankInput,
  RerankOutput,
  CrossEncoderResult,
} from './cross-encoder-types.js';
import { DEFAULT_CROSS_ENCODER_CONFIG } from './cross-encoder-types.js';
import {
  tryLocalRerank,
  tryCohereRerank,
  runPythonCommand,
  emptyResult,
} from './cross-encoder-inference.js';

export type { CrossEncoderConfig, RerankInput, RerankOutput, CrossEncoderResult };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CROSS-ENCODER RERANKER CLASS
// ============================================================================

export class CrossEncoderReranker {
  private config: CrossEncoderConfig;
  private pythonPath: string;
  private scriptPath: string;
  private isLocalAvailable: boolean | null = null;

  constructor(config?: Partial<CrossEncoderConfig>) {
    this.config = { ...DEFAULT_CROSS_ENCODER_CONFIG, ...config };
    this.pythonPath = path.resolve(__dirname, '../../../../venv/Scripts/python.exe');
    this.scriptPath = path.resolve(__dirname, './cross_encoder_inference.py');
  }

  /**
   * Rerank documents based on relevance to query
   */
  async rerank(
    query: string,
    documents: RerankInput[],
    topK?: number,
  ): Promise<CrossEncoderResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (documents.length === 0) {
      return emptyResult('local');
    }

    const batchDocs = documents.slice(0, this.config.maxBatchSize);
    if (documents.length > this.config.maxBatchSize) {
      warnings.push(
        `Truncated input from ${documents.length} to ${this.config.maxBatchSize} documents`,
      );
    }

    const result = await this.runPrimaryStrategy(query, batchDocs, warnings);

    // Apply minimum score threshold and top-k
    result.results = result.results.filter(
      (r) => r.crossEncoderScore >= this.config.minScoreThreshold,
    );
    if (topK && topK > 0) {
      result.results = result.results.slice(0, topK);
    }

    result.results = result.results.map((r, idx) => ({ ...r, rank: idx + 1 }));
    result.processingTimeMs = Date.now() - startTime;
    result.warnings = warnings;

    return result;
  }

  async checkLocalAvailability(): Promise<boolean> {
    if (this.isLocalAvailable !== null) return this.isLocalAvailable;

    try {
      const result = await runPythonCommand(
        ['--check'],
        this.pythonPath,
        this.scriptPath,
        this.config.localTimeoutMs,
      );
      this.isLocalAvailable = result.available === true;
    } catch {
      this.isLocalAvailable = false;
    }

    return this.isLocalAvailable;
  }

  getConfig(): CrossEncoderConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<CrossEncoderConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ========================================================================
  // PRIVATE — Strategy delegation
  // ========================================================================

  private async runPrimaryStrategy(
    query: string,
    docs: RerankInput[],
    warnings: string[],
  ): Promise<CrossEncoderResult> {
    const localFn = () =>
      tryLocalRerank(
        query,
        docs,
        warnings,
        this.config,
        this.pythonPath,
        this.scriptPath,
        () => this.checkLocalAvailability(),
        (d, s) => this.mapScoresToDocuments(d, s),
      );
    const cohereFn = () => tryCohereRerank(query, docs, warnings, this.config);

    if (this.config.preferLocal) {
      const result = await localFn();
      if (result.results.length === 0 && this.config.cohereApiKey) {
        const fallback = await cohereFn();
        fallback.usedFallback = true;
        return fallback;
      }
      return result;
    }

    if (this.config.cohereApiKey) {
      const result = await cohereFn();
      if (result.results.length === 0) {
        const fallback = await localFn();
        fallback.usedFallback = true;
        return fallback;
      }
      return result;
    }

    return localFn();
  }

  private mapScoresToDocuments(
    documents: RerankInput[],
    scores: Array<{ index: number; score: number }>,
  ): RerankOutput[] {
    const results: RerankOutput[] = scores.map((s) => {
      const doc = documents[s.index];
      return {
        id: doc.id,
        crossEncoderScore: 1 / (1 + Math.exp(-s.score)), // sigmoid normalization
        rawScore: s.score,
        originalScore: doc.originalScore,
        metadata: doc.metadata,
        rank: 0,
      };
    });

    results.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);
    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });
    return results;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const crossEncoderReranker = new CrossEncoderReranker({
  cohereApiKey: process.env.COHERE_API_KEY,
});
