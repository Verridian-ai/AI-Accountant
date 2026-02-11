/**
 * Claude Agent Framework — Configuration
 *
 * Token budgets, model selection, retry config, and feature flags.
 */

import type { AgentType, TokenBudget, RetryConfig } from './types.js';

// Token budgets per agent (from Section 6.4)
export const AGENT_TOKEN_BUDGETS: Record<AgentType, TokenBudget> = {
  statement_parser: {
    maxInputTokens: 100_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 10,
    warningThresholdPercent: 80,
  },
  transaction_categorizer: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 5,
    warningThresholdPercent: 80,
  },
  gst_calculator: {
    maxInputTokens: 30_000,
    maxOutputTokens: 4_000,
    maxToolCalls: 8,
    warningThresholdPercent: 80,
  },
  account_reconciler: {
    maxInputTokens: 50_000,
    maxOutputTokens: 4_000,
    maxToolCalls: 8,
    warningThresholdPercent: 80,
  },
  budget_analyzer: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 8,
    warningThresholdPercent: 80,
  },
  cross_account_tracer: {
    maxInputTokens: 30_000,
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    warningThresholdPercent: 80,
  },
  merchant_intelligence: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 15,
    warningThresholdPercent: 80,
  },
};

// Model selection per agent (Appendix A)
export const AGENT_MODELS: Record<AgentType, string> = {
  statement_parser: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  transaction_categorizer: 'claude-haiku-4-5-20251001',
  gst_calculator: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  account_reconciler: 'claude-haiku-4-5-20251001',
  budget_analyzer: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  cross_account_tracer: 'claude-haiku-4-5-20251001',
  merchant_intelligence: 'claude-haiku-4-5-20251001',
};

// Default retry configuration (Section 6.1)
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  retryableErrors: ['rate_limit_error', 'overloaded_error', 'api_error'],
};

// Feature flags
export function isClaudeAgentsEnabled(): boolean {
  return process.env.USE_CLAUDE_AGENTS === 'true';
}

export function isAgentEnabled(agentType: AgentType): boolean {
  if (!isClaudeAgentsEnabled()) return false;

  const envKey = `AGENT_${agentType.toUpperCase()}`;
  const envVal = process.env[envKey];

  // If no per-agent flag is set, default to enabled when master switch is on
  if (envVal === undefined) return true;
  return envVal === 'true';
}
