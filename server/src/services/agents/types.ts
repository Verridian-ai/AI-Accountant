/**
 * TypeScript types for the Python agent wrapper service.
 */

/** @deprecated Use AgentType from '../claude/types.js' for production agents */
export type PythonAgentType = 'financial_analyst' | 'bas' | 'tax' | 'reconciliation';

export interface AgentContext {
  transactions?: Record<string, unknown>[];
  accounts?: Record<string, unknown>[];
  statements?: Record<string, unknown>[];
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  reasoning?: string;
  code_executed?: string;
  code_result?: unknown;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}

export interface AgentInfo {
  available_agents?: string[];
  descriptions?: Record<string, string>;
  name?: string;
  model_type?: string;
  system_prompt?: string;
}
