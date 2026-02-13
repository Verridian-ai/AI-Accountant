/**
 * Claude Agent Framework — Configuration
 *
 * Token budgets, model selection, retry config, and feature flags.
 */

import type { AgentType, TokenBudget, RetryConfig } from './types.js';

// Token budgets per agent (from Section 6.4)
const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  maxInputTokens: 50_000,
  maxOutputTokens: 8_000,
  maxToolCalls: 10,
  warningThresholdPercent: 80,
};

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
  tax_strategy: {
    maxInputTokens: 100_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 15,
    warningThresholdPercent: 80,
  },
  financial_planner: {
    maxInputTokens: 50_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 12,
    warningThresholdPercent: 80,
  },
  market_intelligence: {
    maxInputTokens: 100_000,
    maxOutputTokens: 10_000,
    maxToolCalls: 15,
    warningThresholdPercent: 80,
  },
  tenant_routing: {
    maxInputTokens: 30_000,
    maxOutputTokens: 4_000,
    maxToolCalls: 8,
    warningThresholdPercent: 80,
  },
  payroll_agent: { ...DEFAULT_TOKEN_BUDGET, maxToolCalls: 15 },
  personal_tax_claims: { ...DEFAULT_TOKEN_BUDGET },
  inventory_agent: { ...DEFAULT_TOKEN_BUDGET },
  bank_reconciler_agent: { ...DEFAULT_TOKEN_BUDGET },
  ocr_processing: { ...DEFAULT_TOKEN_BUDGET },
  payment_matching: { ...DEFAULT_TOKEN_BUDGET },
  asset_management: { ...DEFAULT_TOKEN_BUDGET },
  multi_entity: { ...DEFAULT_TOKEN_BUDGET },
  financial_reporting: { ...DEFAULT_TOKEN_BUDGET, maxInputTokens: 100_000 },
  budgeting: { ...DEFAULT_TOKEN_BUDGET },
  forecasting: { ...DEFAULT_TOKEN_BUDGET },
  compliance_monitoring: { ...DEFAULT_TOKEN_BUDGET },
  cdr_product: { ...DEFAULT_TOKEN_BUDGET },
  invoice_agent: { ...DEFAULT_TOKEN_BUDGET },
  accounts_payable_agent: { ...DEFAULT_TOKEN_BUDGET, maxToolCalls: 12 },
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
  tax_strategy: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  financial_planner: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  market_intelligence: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  tenant_routing: 'claude-haiku-4-5-20251001',
  payroll_agent: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  personal_tax_claims: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  inventory_agent: 'claude-haiku-4-5-20251001',
  bank_reconciler_agent: 'claude-haiku-4-5-20251001',
  ocr_processing: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  payment_matching: 'claude-haiku-4-5-20251001',
  asset_management: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  multi_entity: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  financial_reporting: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  budgeting: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  forecasting: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  compliance_monitoring: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  cdr_product: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  invoice_agent: 'claude-haiku-4-5-20251001',
  accounts_payable_agent: 'claude-haiku-4-5-20251001',
};

// Default retry configuration (Section 6.1)
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  retryableErrors: ['rate_limit_error', 'overloaded_error', 'api_error'],
};

// Vercel AI SDK migration flags — opt-in per agent via USE_VERCEL_SDK env var
export const VERCEL_MIGRATION_FLAGS: Partial<Record<AgentType, boolean>> = {
  budget_analyzer: process.env.USE_VERCEL_SDK === 'true',
  transaction_categorizer: process.env.USE_VERCEL_SDK === 'true',
  financial_planner: process.env.USE_VERCEL_SDK === 'true',
  tax_strategy: process.env.USE_VERCEL_SDK === 'true',
  merchant_intelligence: process.env.USE_VERCEL_SDK === 'true',
};

/**
 * Build default agent configuration records for seeding the agent_configurations table.
 */
export function getDefaultAgentConfigs(): Array<{
  agentType: AgentType;
  displayName: string;
  description: string;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
}> {
  return (Object.keys(AGENT_MODELS) as AgentType[]).map((agentType) => ({
    agentType,
    displayName: agentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Configuration for ${agentType} agent`,
    model: AGENT_MODELS[agentType],
    maxInputTokens: AGENT_TOKEN_BUDGETS[agentType].maxInputTokens,
    maxOutputTokens: AGENT_TOKEN_BUDGETS[agentType].maxOutputTokens,
    temperature: 0.1,
  }));
}

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
