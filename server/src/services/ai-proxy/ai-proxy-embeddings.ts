/**
 * AI Proxy — Embedding implementations
 * Standalone functions that the AIProxy class delegates to.
 */

import type { EmbeddingRequest, EmbeddingResponse } from './types.js';
import { AI_CONFIG } from './config.js';
import { fetchWithTimeout, sanitizeErrorMessage } from './validation.js';

async function generateOpenAIEmbeddingsImpl(
  openaiKey: string,
  openaiBaseUrl: string,
  request: EmbeddingRequest,
): Promise<EmbeddingResponse> {
  const model = request.model || 'text-embedding-3-large';
  const inputs = Array.isArray(request.input) ? request.input : [request.input];
  if (inputs.length > 100) throw new Error('Too many inputs for embedding. Maximum: 100');
  for (const input of inputs) {
    if (input.length > AI_CONFIG.maxMessageLength)
      throw new Error(`Input exceeds maximum length of ${AI_CONFIG.maxMessageLength} characters`);
  }

  try {
    const response = await fetchWithTimeout(`${openaiBaseUrl}/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: inputs }),
    });
    if (!response.ok) {
      const statusMessage =
        response.status === 429
          ? 'Rate limit exceeded'
          : response.status === 401
            ? 'Authentication failed'
            : 'OpenAI embedding request failed';
      throw new Error(`${statusMessage} (${response.status})`);
    }
    const data = await response.json();
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      model: data.model,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, totalTokens: data.usage.total_tokens }
        : undefined,
    };
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

export async function generateEmbeddingsImpl(
  openrouterKey: string | undefined,
  openaiKey: string | undefined,
  baseUrl: string,
  openaiBaseUrl: string,
  request: EmbeddingRequest,
): Promise<EmbeddingResponse> {
  if (openaiKey) return generateOpenAIEmbeddingsImpl(openaiKey, openaiBaseUrl, request);
  if (!openrouterKey) throw new Error('AI service not configured');

  const model = request.model || 'openai/text-embedding-3-large';
  const inputs = Array.isArray(request.input) ? request.input : [request.input];
  if (inputs.length > 100) throw new Error('Too many inputs for embedding. Maximum: 100');
  for (const input of inputs) {
    if (input.length > AI_CONFIG.maxMessageLength)
      throw new Error(`Input exceeds maximum length of ${AI_CONFIG.maxMessageLength} characters`);
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input: inputs }),
    });
    if (!response.ok) {
      const statusMessage =
        response.status === 429
          ? 'Rate limit exceeded'
          : response.status === 401
            ? 'Authentication failed'
            : 'Embedding request failed';
      throw new Error(`${statusMessage} (${response.status})`);
    }
    const data = await response.json();
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      model: data.model,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, totalTokens: data.usage.total_tokens }
        : undefined,
    };
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}
