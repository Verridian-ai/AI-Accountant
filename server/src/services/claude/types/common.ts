/**
 * Claude Agent Framework — Common/Shared Types
 *
 * Core types used across the entire agent system:
 * AgentType union, token budgets, retry config, progress events.
 */

import type { BankId, AccountInfo, ParsedTransaction } from '../../parsers/types.js';

// Agent type union
export type AgentType =
  | 'statement_parser'
  | 'transaction_categorizer'
  | 'gst_calculator'
  | 'account_reconciler'
  | 'budget_analyzer'
  | 'cross_account_tracer'
  | 'merchant_intelligence'
  | 'tax_strategy'
  | 'financial_planner'
  | 'market_intelligence'
  | 'tenant_routing'
  | 'payroll_agent'
  | 'personal_tax_claims'
  | 'inventory_agent'
  | 'bank_reconciler_agent'
  | 'ocr_processing'
  | 'payment_matching'
  | 'asset_management'
  | 'multi_entity'
  | 'financial_reporting'
  | 'budgeting'
  | 'forecasting'
  | 'compliance_monitoring'
  | 'cdr_product'
  | 'invoice_agent'
  | 'accounts_payable_agent';

// Token budget per agent
export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxToolCalls: number;
  warningThresholdPercent: number;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Agent progress event for SSE
export interface AgentProgressEvent {
  type: 'agent_progress';
  agent: AgentType;
  status: 'started' | 'tool_call' | 'completed' | 'error';
  data?: Record<string, unknown>;
  timestamp: string;
}

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

// ---------------------------------------------------------------------------
// Streaming session types (Wave 21)
// ---------------------------------------------------------------------------

/** Represents a streaming session's public state. */
export interface StreamSession {
  id: string;
  agentType: AgentType;
  status: 'pending' | 'streaming' | 'completed' | 'errored' | 'cancelled';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Vercel AI SDK types
// ---------------------------------------------------------------------------

/** Wraps the output of a Vercel-based agent execution. */
export interface VercelAgentExecutionResult<T> {
  output: T;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  framework: 'vercel' | 'legacy';
}

// Re-export parser types used in agent I/O contracts
export type { BankId, AccountInfo, ParsedTransaction };
