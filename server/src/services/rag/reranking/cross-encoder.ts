/**
 * Cross-Encoder Reranking Module
 *
 * Provides semantic reranking using cross-encoder models.
 * Supports local MS-MARCO MiniLM model via Python inference
 * with Cohere API fallback for production reliability.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// TYPES
// ============================================================================

export interface CrossEncoderConfig {
  /** Local model to use for reranking */
  localModel: 'ms-marco-MiniLM-L-6-v2' | 'ms-marco-MiniLM-L-12-v2';
  /** Cohere API key for fallback */
  cohereApiKey?: string;
  /** Cohere model to use */
  cohereModel: 'rerank-english-v3.0' | 'rerank-multilingual-v3.0';
  /** Use local model as primary (vs Cohere) */
  preferLocal: boolean;
  /** Timeout for local model inference (ms) */
  localTimeoutMs: number;
  /** Maximum documents to rerank in a single batch */
  maxBatchSize: number;
  /** Minimum score threshold (0-1) to include in results */
  minScoreThreshold: number;
}

export interface RerankInput {
  /** Unique identifier for the document/chunk */
  id: string;
  /** Text content to compare against the query */
  content: string;
  /** Original retrieval score (for hybrid combining) */
  originalScore?: number;
  /** Additional metadata to preserve */
  metadata?: Record<string, unknown>;
}

export interface RerankOutput {
  /** Document identifier */
  id: string;
  /** Cross-encoder relevance score (0-1 normalized) */
  crossEncoderScore: number;
  /** Raw model score before normalization */
  rawScore: number;
  /** Original retrieval score */
  originalScore?: number;
  /** Combined score if hybrid reranking is used */
  combinedScore?: number;
  /** Preserved metadata */
  metadata?: Record<string, unknown>;
  /** Rank position (1-indexed) */
  rank: number;
}

export interface CrossEncoderResult {
  /** Reranked documents */
  results: RerankOutput[];
  /** Which model was used */
  modelUsed: 'local' | 'cohere';
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Whether fallback was triggered */
  usedFallback: boolean;
  /** Any warnings during processing */
  warnings: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_CROSS_ENCODER_CONFIG: CrossEncoderConfig = {
  localModel: 'ms-marco-MiniLM-L-6-v2',
  cohereModel: 'rerank-english-v3.0',
  preferLocal: true,
  localTimeoutMs: 30000,
  maxBatchSize: 100,
  minScoreThreshold: 0.0,
};

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

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Rerank documents based on relevance to query
   */
  async rerank(
    query: string,
    documents: RerankInput[],
    topK?: number
  ): Promise<CrossEncoderResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (documents.length === 0) {
      return {
        results: [],
        modelUsed: 'local',
        processingTimeMs: 0,
        usedFallback: false,
        warnings: [],
      };
    }

    // Truncate to max batch size
    const batchDocs = documents.slice(0, this.config.maxBatchSize);
    if (documents.length > this.config.maxBatchSize) {
      warnings.push(
        `Truncated input from ${documents.length} to ${this.config.maxBatchSize} documents`
      );
    }

    let result: CrossEncoderResult;

    // Try primary method
    if (this.config.preferLocal) {
      result = await this.tryLocalRerank(query, batchDocs, warnings);
      if (result.results.length === 0 && this.config.cohereApiKey) {
        // Fallback to Cohere
        result = await this.tryCohereRerank(query, batchDocs, warnings);
        result.usedFallback = true;
      }
    } else {
      // Cohere primary
      if (this.config.cohereApiKey) {
        result = await this.tryCohereRerank(query, batchDocs, warnings);
        if (result.results.length === 0) {
          result = await this.tryLocalRerank(query, batchDocs, warnings);
          result.usedFallback = true;
        }
      } else {
        result = await this.tryLocalRerank(query, batchDocs, warnings);
      }
    }

    // Apply minimum score threshold and top-k
    result.results = result.results.filter(
      (r) => r.crossEncoderScore >= this.config.minScoreThreshold
    );

    if (topK && topK > 0) {
      result.results = result.results.slice(0, topK);
    }

    // Reassign ranks after filtering
    result.results = result.results.map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

    result.processingTimeMs = Date.now() - startTime;
    result.warnings = warnings;

    return result;
  }

  /**
   * Check if local model is available
   */
  async checkLocalAvailability(): Promise<boolean> {
    if (this.isLocalAvailable !== null) {
      return this.isLocalAvailable;
    }

    try {
      const result = await this.runPythonCommand(['--check']);
      this.isLocalAvailable = result.available === true;
    } catch {
      this.isLocalAvailable = false;
    }

    return this.isLocalAvailable;
  }

  /**
   * Get current configuration
   */
  getConfig(): CrossEncoderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CrossEncoderConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // ========================================================================
  // PRIVATE METHODS - LOCAL INFERENCE
  // ========================================================================

  private async tryLocalRerank(
    query: string,
    documents: RerankInput[],
    warnings: string[]
  ): Promise<CrossEncoderResult> {
    try {
      const isAvailable = await this.checkLocalAvailability();
      if (!isAvailable) {
        warnings.push('Local cross-encoder model not available');
        return this.emptyResult('local');
      }

      const input = {
        query,
        documents: documents.map((d) => ({
          id: d.id,
          content: d.content,
        })),
        model: this.config.localModel,
      };

      const result = await this.runPythonCommand(['--rerank', JSON.stringify(input)]);

      if (!result.scores || !Array.isArray(result.scores)) {
        warnings.push('Invalid response from local cross-encoder');
        return this.emptyResult('local');
      }

      // Map scores back to documents
      const scoredDocs = this.mapScoresToDocuments(documents, result.scores);

      return {
        results: scoredDocs,
        modelUsed: 'local',
        processingTimeMs: 0,
        usedFallback: false,
        warnings: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`Local cross-encoder failed: ${msg}`);
      return this.emptyResult('local');
    }
  }

  private async runPythonCommand(args: string[]): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      // Validate args don't contain shell metacharacters
      // The args should be JSON strings, so we validate they're properly formatted
      for (const arg of args) {
        if (arg !== '--check' && arg !== '--rerank') {
          // For non-flag args, ensure it's valid JSON (input data)
          try {
            JSON.parse(arg);
          } catch {
            reject(new Error(`Invalid argument format: argument must be valid JSON`));
            return;
          }
        }
      }

      const proc = spawn(this.pythonPath, [this.scriptPath, ...args], {
        // Note: 'timeout' option in spawn is not supported, using manual timeout
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      // Manual timeout handling since spawn's timeout doesn't work as expected
      const timeoutHandle = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
        reject(new Error(`Python process timed out after ${this.config.localTimeoutMs}ms`));
      }, this.config.localTimeoutMs);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        if (killed) return; // Already rejected due to timeout

        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          resolve(JSON.parse(lastLine));
        } catch {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  // ========================================================================
  // PRIVATE METHODS - COHERE API
  // ========================================================================

  private async tryCohereRerank(
    query: string,
    documents: RerankInput[],
    warnings: string[]
  ): Promise<CrossEncoderResult> {
    if (!this.config.cohereApiKey) {
      warnings.push('Cohere API key not configured');
      return this.emptyResult('cohere');
    }

    try {
      const response = await fetch('https://api.cohere.ai/v1/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.cohereApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.cohereModel,
          query,
          documents: documents.map((d) => d.content),
          top_n: documents.length,
          return_documents: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as CohereRerankResponse;

      if (!data.results || !Array.isArray(data.results)) {
        warnings.push('Invalid response from Cohere API');
        return this.emptyResult('cohere');
      }

      // Map Cohere results back to our format
      const results: RerankOutput[] = data.results.map((r) => {
        const originalDoc = documents[r.index];
        return {
          id: originalDoc.id,
          crossEncoderScore: r.relevance_score,
          rawScore: r.relevance_score,
          originalScore: originalDoc.originalScore,
          metadata: originalDoc.metadata,
          rank: 0, // Will be set after sorting
        };
      });

      // Sort by score descending
      results.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);

      // Assign ranks
      results.forEach((r, idx) => {
        r.rank = idx + 1;
      });

      return {
        results,
        modelUsed: 'cohere',
        processingTimeMs: 0,
        usedFallback: false,
        warnings: [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`Cohere rerank failed: ${msg}`);
      return this.emptyResult('cohere');
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private mapScoresToDocuments(
    documents: RerankInput[],
    scores: Array<{ index: number; score: number }>
  ): RerankOutput[] {
    // Normalize scores to 0-1 range using sigmoid
    const normalizedScores = scores.map((s) => ({
      ...s,
      normalizedScore: this.sigmoid(s.score),
    }));

    // Map to output format
    const results: RerankOutput[] = normalizedScores.map((s) => {
      const doc = documents[s.index];
      return {
        id: doc.id,
        crossEncoderScore: s.normalizedScore,
        rawScore: s.score,
        originalScore: doc.originalScore,
        metadata: doc.metadata,
        rank: 0,
      };
    });

    // Sort by normalized score descending
    results.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);

    // Assign ranks
    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return results;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private emptyResult(modelUsed: 'local' | 'cohere'): CrossEncoderResult {
    return {
      results: [],
      modelUsed,
      processingTimeMs: 0,
      usedFallback: false,
      warnings: [],
    };
  }
}

// ============================================================================
// COHERE API TYPES
// ============================================================================

interface CohereRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
  meta?: {
    api_version?: {
      version: string;
    };
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const crossEncoderReranker = new CrossEncoderReranker({
  cohereApiKey: process.env.COHERE_API_KEY,
});
