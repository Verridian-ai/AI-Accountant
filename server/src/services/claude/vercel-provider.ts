/**
 * Vercel AI SDK — Provider Configuration
 *
 * Lazily creates Anthropic and OpenRouter providers so that missing
 * API keys don't crash at import time.  Every call goes through a
 * factory function that reads env vars on demand.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { AgentType } from './types.js';
import { AGENT_MODELS } from './config.js';

// ---------------------------------------------------------------------------
// Shared SDK settings
// ---------------------------------------------------------------------------

export const VERCEL_SDK_CONFIG = {
  /** Default temperature for deterministic agent output. */
  temperature: 0.1,
  /** Maximum retries the SDK should attempt on transient errors. */
  maxRetries: 3,
  /** Abort signal timeout (ms) for a single LLM call. */
  abortTimeoutMs: 120_000,
} as const;

// ---------------------------------------------------------------------------
// Provider factories — lazy, so env vars are read at call-time
// ---------------------------------------------------------------------------

let _anthropicProvider: ReturnType<typeof createAnthropic> | null = null;
let _openRouterProvider: ReturnType<typeof createOpenAI> | null = null;

/**
 * Return a cached Anthropic provider, creating it on first use.
 * Reads `ANTHROPIC_API_KEY` from the environment.
 */
export function getAnthropicProvider() {
  if (!_anthropicProvider) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set — cannot create Anthropic provider');
    }
    _anthropicProvider = createAnthropic({ apiKey });
  }
  return _anthropicProvider;
}

/**
 * Return a cached OpenRouter provider (OpenAI-compatible), creating it on
 * first use.  Reads `OPENROUTER_API_KEY` from the environment.
 */
export function getOpenRouterProvider() {
  if (!_openRouterProvider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set — cannot create OpenRouter provider');
    }
    _openRouterProvider = createOpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return _openRouterProvider;
}

/**
 * Resolve an agent type to a concrete `LanguageModel` instance.
 *
 * Strategy:
 *  1. If `ANTHROPIC_API_KEY` is available, use the Anthropic provider with
 *     the model string from `AGENT_MODELS`.
 *  2. Otherwise fall back to OpenRouter using the same model string (which
 *     OpenRouter also supports for Anthropic models).
 */
export function resolveModel(agentType: AgentType): LanguageModel {
  const modelId = AGENT_MODELS[agentType];

  // Prefer native Anthropic when available
  if (process.env.ANTHROPIC_API_KEY) {
    return getAnthropicProvider()(modelId);
  }

  // Fallback: route through OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    // OpenRouter uses "anthropic/" prefix for Anthropic models
    const openRouterModelId = modelId.startsWith('anthropic/') ? modelId : `anthropic/${modelId}`;
    return getOpenRouterProvider()(openRouterModelId);
  }

  throw new Error(
    `No AI provider available for agent "${agentType}". ` +
      'Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.',
  );
}
