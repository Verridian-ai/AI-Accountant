/**
 * Dense Search Embedding Generation
 *
 * Handles embedding generation via FastEmbed Python subprocess
 * with a simple hash-based fallback for development/testing.
 */

import { logger } from '../../../lib/logger.js';

// ============================================================================
// FASTEMBED PYTHON SUBPROCESS
// ============================================================================

/**
 * Call FastEmbed via Python subprocess to generate embeddings
 */
export async function callFastEmbed(
  text: string,
  embeddingModel: string,
  _embeddingDimensions: number,
): Promise<number[] | null> {
  try {
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
    model = TextEmbedding(model_name="${embeddingModel}")
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
          logger.warn(`[DenseSearch] FastEmbed failed: ${stderr}`);
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

// ============================================================================
// FALLBACK EMBEDDING
// ============================================================================

/**
 * Generate a fallback embedding using simple hashing.
 * This is only for development/testing when FastEmbed is not available.
 */
export function generateFallbackEmbedding(text: string, dimensions: number): number[] {
  logger.warn('[DenseSearch] Using fallback embedding - NOT FOR PRODUCTION');

  const embedding = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % dimensions;
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
