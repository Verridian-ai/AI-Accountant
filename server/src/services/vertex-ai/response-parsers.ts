/**
 * Vertex AI Provider-Specific Response Parsers
 */

import type { VertexAIResponse } from './types.js';

export function parseGeminiResponse(data: unknown, model: string): VertexAIResponse {
  const d = data as {
    candidates?: { content?: { parts?: { text: string }[] }; finishReason?: string }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const candidate = d.candidates?.[0];
  const content = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';

  return {
    content,
    model,
    usage: {
      promptTokens: d.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: d.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: d.usageMetadata?.totalTokenCount ?? 0,
    },
    finishReason: candidate?.finishReason ?? 'unknown',
  };
}

export function parseClaudeResponse(data: unknown, model: string): VertexAIResponse {
  const d = data as {
    content?: { text: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
  };
  const content = d.content?.map((c) => c.text).join('') ?? '';

  return {
    content,
    model,
    usage: {
      promptTokens: d.usage?.input_tokens ?? 0,
      completionTokens: d.usage?.output_tokens ?? 0,
      totalTokens: (d.usage?.input_tokens ?? 0) + (d.usage?.output_tokens ?? 0),
    },
    finishReason: d.stop_reason ?? 'unknown',
  };
}

export function parseGenericResponse(data: unknown, model: string): VertexAIResponse {
  const d = data as { predictions?: { content?: string }[] };
  const prediction = d.predictions?.[0];
  const content =
    typeof prediction === 'string'
      ? prediction
      : (prediction?.content ?? JSON.stringify(prediction));

  return {
    content,
    model,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    finishReason: 'stop',
  };
}
