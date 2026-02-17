/**
 * Cross-Encoder Inference Methods
 *
 * Handles local Python model and Cohere API inference for cross-encoder reranking.
 */

import { spawn } from 'child_process';
import type {
  CrossEncoderConfig,
  RerankInput,
  RerankOutput,
  CrossEncoderResult,
  CohereRerankResponse,
} from './cross-encoder-types.js';

// ============================================================================
// LOCAL INFERENCE
// ============================================================================

/**
 * Try local cross-encoder reranking via Python
 */
export async function tryLocalRerank(
  query: string,
  documents: RerankInput[],
  warnings: string[],
  config: CrossEncoderConfig,
  pythonPath: string,
  scriptPath: string,
  checkAvailability: () => Promise<boolean>,
  mapScores: (
    docs: RerankInput[],
    scores: Array<{ index: number; score: number }>,
  ) => RerankOutput[],
): Promise<CrossEncoderResult> {
  try {
    const isAvailable = await checkAvailability();
    if (!isAvailable) {
      warnings.push('Local cross-encoder model not available');
      return emptyResult('local');
    }

    const input = {
      query,
      documents: documents.map((d) => ({ id: d.id, content: d.content })),
      model: config.localModel,
    };

    const result = await runPythonCommand(
      ['--rerank', JSON.stringify(input)],
      pythonPath,
      scriptPath,
      config.localTimeoutMs,
    );

    if (!result.scores || !Array.isArray(result.scores)) {
      warnings.push('Invalid response from local cross-encoder');
      return emptyResult('local');
    }

    return {
      results: mapScores(documents, result.scores),
      modelUsed: 'local',
      processingTimeMs: 0,
      usedFallback: false,
      warnings: [],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    warnings.push(`Local cross-encoder failed: ${msg}`);
    return emptyResult('local');
  }
}

/**
 * Run a Python command with timeout
 */
export async function runPythonCommand(
  args: string[],
  pythonPath: string,
  scriptPath: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    for (const arg of args) {
      if (arg !== '--check' && arg !== '--rerank') {
        try {
          JSON.parse(arg);
        } catch {
          reject(new Error(`Invalid argument format: argument must be valid JSON`));
          return;
        }
      }
    }

    const proc = spawn(pythonPath, [scriptPath, ...args], { windowsHide: true });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeoutHandle = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
      reject(new Error(`Python process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);
      if (killed) return;
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const lines = stdout.trim().split('\n');
        resolve(JSON.parse(lines[lines.length - 1]));
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

// ============================================================================
// COHERE API
// ============================================================================

/**
 * Try Cohere API reranking
 */
export async function tryCohereRerank(
  query: string,
  documents: RerankInput[],
  warnings: string[],
  config: CrossEncoderConfig,
): Promise<CrossEncoderResult> {
  if (!config.cohereApiKey) {
    warnings.push('Cohere API key not configured');
    return emptyResult('cohere');
  }

  try {
    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.cohereApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.cohereModel,
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

    const data = (await response.json()) as CohereRerankResponse;

    if (!data.results || !Array.isArray(data.results)) {
      warnings.push('Invalid response from Cohere API');
      return emptyResult('cohere');
    }

    const results: RerankOutput[] = data.results.map((r) => {
      const originalDoc = documents[r.index];
      return {
        id: originalDoc.id,
        crossEncoderScore: r.relevance_score,
        rawScore: r.relevance_score,
        originalScore: originalDoc.originalScore,
        metadata: originalDoc.metadata,
        rank: 0,
      };
    });

    results.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);
    results.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return { results, modelUsed: 'cohere', processingTimeMs: 0, usedFallback: false, warnings: [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    warnings.push(`Cohere rerank failed: ${msg}`);
    return emptyResult('cohere');
  }
}

// ============================================================================
// UTILITY
// ============================================================================

export function emptyResult(modelUsed: 'local' | 'cohere'): CrossEncoderResult {
  return { results: [], modelUsed, processingTimeMs: 0, usedFallback: false, warnings: [] };
}
