/**
 * Vertex AI Model Registry and Fintech Presets
 *
 * Available models (January 2026) and recommended configurations.
 */

import type { VertexModel } from './types.js';

export const VERTEX_AI_MODELS: VertexModel[] = [
  // ---- GEMINI 3 (Preview) ----
  {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    category: 'reasoning',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'preview',
    pricing: { input: 1.25, output: 5.0 },
    features: ['adaptive-thinking', 'grounding', 'multimodal', 'code', 'agentic'],
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'preview',
    pricing: { input: 0.15, output: 0.6 },
    features: ['multimodal', 'reasoning', 'code', 'agentic'],
  },

  // ---- GEMINI 2.5 (GA / Production) ----
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    category: 'reasoning',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'ga',
    pricing: { input: 1.25, output: 5.0 },
    features: ['adaptive-thinking', 'code', 'multimodal', 'grounding'],
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'ga',
    pricing: { input: 0.15, output: 0.6 },
    features: ['thinking-budgets', 'multimodal', 'code'],
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'ga',
    pricing: { input: 0.04, output: 0.15 },
    features: ['high-throughput', 'cost-effective'],
  },

  // ---- GEMINI 2.0 (Legacy - deprecated March 2026) ----
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 8_192,
    status: 'deprecated',
    pricing: { input: 0.1, output: 0.4 },
    features: ['multimodal', 'general-purpose'],
  },

  // ---- ANTHROPIC CLAUDE (via Model Garden) ----
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    category: 'reasoning',
    contextWindow: 200_000,
    maxOutput: 32_000,
    status: 'ga',
    pricing: { input: 15.0, output: 75.0 },
    features: ['deep-reasoning', 'code', 'analysis', 'long-context'],
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    category: 'reasoning',
    contextWindow: 200_000,
    maxOutput: 16_000,
    status: 'ga',
    pricing: { input: 3.0, output: 15.0 },
    features: ['balanced', 'code', 'analysis'],
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    category: 'fast',
    contextWindow: 200_000,
    maxOutput: 8_192,
    status: 'ga',
    pricing: { input: 0.8, output: 4.0 },
    features: ['fast', 'cost-effective', 'code'],
  },

  // ---- THIRD-PARTY (Model Garden) ----
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    category: 'reasoning',
    contextWindow: 128_000,
    maxOutput: 8_192,
    status: 'ga',
    pricing: { input: 0.27, output: 1.1 },
    features: ['reasoning', 'code', 'math'],
  },
  {
    id: 'mistral-codestral-2',
    name: 'Mistral Codestral 2',
    provider: 'mistral',
    category: 'code',
    contextWindow: 256_000,
    maxOutput: 16_384,
    status: 'ga',
    pricing: { input: 0.3, output: 0.9 },
    features: ['code-generation', 'fill-in-middle', '80+ languages'],
  },
];

// Recommended model configurations for fintech
export const FINTECH_MODEL_PRESETS = {
  // Best models for each task type
  reasoning: 'gemini-2.5-pro', // Complex financial analysis
  fast: 'gemini-2.5-flash', // Quick categorization
  vision: 'gemini-3.0-flash', // PDF/receipt OCR
  code: 'gemini-2.5-pro', // Code generation for agents
  categorization: 'gemini-2.5-flash-lite', // Bulk transaction categorization
  tax: 'gemini-2.5-pro', // Tax calculations (accuracy critical)
  chat: 'gemini-2.5-flash', // User chat interactions
  embedding: 'text-embedding-005', // Embeddings for RAG
} as const;
