/**
 * TypeScript wrapper for Pydantic AI agents.
 * Provides a clean interface to call Python agents from Node.js.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  PythonAgentType,
  AgentContext,
  AgentResponse,
  CodeExecutionResult,
  AgentInfo,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_PATH = path.resolve(__dirname, '../../venv/Scripts/python.exe');
// __dirname is now server/src/services/agents/ — runner.py is in the same directory
const RUNNER_PATH = path.resolve(__dirname, './runner.py');

class AgentService {
  private async runPython<T>(args: string[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const proc = spawn(PYTHON_PATH, [RUNNER_PATH, ...args]);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        if (code !== 0) {
          console.error('[AgentService] Python stderr:', stderr);
          reject(new Error(`Agent process exited with code ${code}. Error: ${stderr}`));
          return;
        }
        try {
          // Parse the last line of output (in case of debug prints)
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          resolve(JSON.parse(lastLine) as T);
        } catch {
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
      transactions: context.transactions ?? [],
      accounts: context.accounts ?? [],
      statements: context.statements ?? [],
    };

    return this.runPython<AgentResponse>(['run', agentType, JSON.stringify(data)]);
  }

  /**
   * Execute Python code in the sandboxed interpreter.
   */
  async executeCode(
    code: string,
    context: Record<string, unknown> = {},
  ): Promise<CodeExecutionResult> {
    const data = { code, context };
    return this.runPython<CodeExecutionResult>(['code', JSON.stringify(data)]);
  }

  /**
   * Get information about available agents.
   */
  async getAgentInfo(agentType?: PythonAgentType): Promise<AgentInfo> {
    const args = ['info'];
    if (agentType) {
      args.push(agentType);
    }
    return this.runPython<AgentInfo>(args);
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
