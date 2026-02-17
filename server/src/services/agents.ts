/**
 * TypeScript wrapper for Pydantic AI agents.
 * Provides a clean interface to call Python agents from Node.js.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_PATH = path.resolve(__dirname, '../venv/Scripts/python.exe');
const RUNNER_PATH = path.resolve(__dirname, './services/agents/runner.py');

/** @deprecated Use AgentType from './claude/types.js' for production agents */
export type PythonAgentType = 'financial_analyst' | 'bas' | 'tax' | 'reconciliation';

// Re-export the canonical AgentType from the Claude agent system
export type { AgentType } from './claude/types.js';

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

class AgentService {
  private async runPython(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn(PYTHON_PATH, [RUNNER_PATH, ...args]);
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
          console.error('[AgentService] Python stderr:', stderr);
          reject(new Error(`Agent process exited with code ${code}. Error: ${stderr}`));
          return;
        }
        try {
          // Parse the last line of output (in case of debug prints)
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          resolve(JSON.parse(lastLine));
        } catch (_e) {
          reject(new Error(`Failed to parse agent output: ${stdout}`));
        }
      });
    });
  }

  /**
   * Run an AI agent with a query and context.
   */
  async runAgent(
    agentType: PythonAgentType,
    query: string,
    context: AgentContext = {},
  ): Promise<AgentResponse> {
    const data = {
      query,
      transactions: context.transactions || [],
      accounts: context.accounts || [],
      statements: context.statements || [],
    };

    return this.runPython(['run', agentType, JSON.stringify(data)]);
  }

  /**
   * Execute Python code in the sandboxed interpreter.
   */
  async executeCode(code: string, context: Record<string, any> = {}): Promise<CodeExecutionResult> {
    const data = { code, context };
    return this.runPython(['code', JSON.stringify(data)]);
  }

  /**
   * Get information about available agents.
   */
  async getAgentInfo(agentType?: PythonAgentType): Promise<AgentInfo> {
    const args = ['info'];
    if (agentType) {
      args.push(agentType);
    }
    return this.runPython(args);
  }

  /**
   * Run the Financial Analyst agent.
   */
  async analyzeFinances(query: string, context: AgentContext): Promise<AgentResponse> {
    return this.runAgent('financial_analyst', query, context);
  }

  /**
   * Run the BAS agent for GST calculations.
   */
  async calculateBAS(query: string, context: AgentContext): Promise<AgentResponse> {
    return this.runAgent('bas', query, context);
  }

  /**
   * Run the Tax agent for income tax calculations.
   */
  async calculateTax(query: string, context: AgentContext): Promise<AgentResponse> {
    return this.runAgent('tax', query, context);
  }

  /**
   * Run the Reconciliation agent.
   */
  async reconcileTransactions(query: string, context: AgentContext): Promise<AgentResponse> {
    return this.runAgent('reconciliation', query, context);
  }
}

export const agentService = new AgentService();
