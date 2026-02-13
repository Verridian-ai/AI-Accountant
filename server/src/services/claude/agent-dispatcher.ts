/**
 * Agent Dispatcher — Executes classified intents via the orchestrator
 *
 * Supports single-agent dispatch, intent-based routing (with secondary agents),
 * and sequential multi-agent pipelines with result chaining.
 */

import { events } from '../../events.js';
import type { AgentOrchestrator } from './orchestrator.js';
import type { AgentType } from './types.js';

// ---------------------------------------------------------------------------
// IntentClassification — defined inline so this module compiles independently
// of intent-router.ts (which may be built concurrently).
// ---------------------------------------------------------------------------
export interface IntentClassification {
  intent:
    | 'agent_invocation'
    | 'direct_question'
    | 'transaction_edit'
    | 'batch_operation'
    | 'multi_agent';
  primaryAgent: AgentType;
  secondaryAgents: AgentType[];
  confidence: number;
  reasoning: string;
  extractedParams: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Result interfaces
// ---------------------------------------------------------------------------
export interface AgentDispatchResult {
  success: boolean;
  agentType: AgentType;
  result: unknown;
  usage?: { inputTokens: number; outputTokens: number; toolCalls: number };
  duration: number; // ms
  error?: string;
}

export interface PipelineResult {
  results: AgentDispatchResult[];
  finalResult: unknown;
  totalDuration: number; // ms
}

// ---------------------------------------------------------------------------
// AgentDispatcher
// ---------------------------------------------------------------------------
export class AgentDispatcher {
  private orchestrator: AgentOrchestrator;

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  // -------------------------------------------------------------------------
  // Single agent dispatch
  // -------------------------------------------------------------------------
  async dispatchSingle(
    agentType: AgentType,
    input: Record<string, unknown>,
    options?: { timeout?: number; emitProgress?: boolean },
  ): Promise<AgentDispatchResult> {
    const emitProgress = options?.emitProgress ?? true;
    const startTime = Date.now();

    if (emitProgress) {
      this.emitDispatchEvent('agent:dispatch:start', { agentType });
    }

    try {
      // Build a timeout race if caller specified a timeout
      const invokePromise = this.orchestrator.invoke(
        agentType,
        input as never, // orchestrator.invoke() expects AgentInputMap[T]; cast to satisfy TS
      );

      let result: unknown;
      if (options?.timeout && options.timeout > 0) {
        result = await Promise.race([
          invokePromise,
          this.timeoutReject(options.timeout, agentType),
        ]);
      } else {
        result = await invokePromise;
      }

      const duration = Date.now() - startTime;

      // Extract usage from the agent result if available
      const usage = this.extractUsage(result);

      if (emitProgress) {
        this.emitDispatchEvent('agent:dispatch:complete', {
          agentType,
          duration,
          usage,
        });
      }

      return { success: true, agentType, result, usage, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (emitProgress) {
        this.emitDispatchEvent('agent:dispatch:complete', {
          agentType,
          duration,
          error: errorMessage,
        });
      }

      return {
        success: false,
        agentType,
        result: null,
        duration,
        error: errorMessage,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Intent-based dispatch (single or multi-agent)
  // -------------------------------------------------------------------------
  async dispatchIntent(
    classification: IntentClassification,
    userQuery: string,
    context?: Record<string, unknown>,
  ): Promise<PipelineResult> {
    // Build the base input from extracted params, user query, and context
    const baseInput: Record<string, unknown> = {
      ...classification.extractedParams,
      userQuery,
      ...context,
    };

    const hasSecondary =
      classification.secondaryAgents && classification.secondaryAgents.length > 0;

    if (!hasSecondary) {
      // Single-agent path
      const startTime = Date.now();
      const result = await this.dispatchSingle(classification.primaryAgent, baseInput);
      return {
        results: [result],
        finalResult: result.success ? result.result : result.error,
        totalDuration: Date.now() - startTime,
      };
    }

    // Multi-agent path: primary first, then each secondary sequentially
    const allAgents: AgentType[] = [classification.primaryAgent, ...classification.secondaryAgents];
    const results: AgentDispatchResult[] = [];
    let currentInput = { ...baseInput };
    const startTime = Date.now();

    for (let i = 0; i < allAgents.length; i++) {
      const agentType = allAgents[i];
      const isPrimary = i === 0;

      this.emitDispatchEvent('agent:dispatch:progress', {
        agentType,
        step: i + 1,
        totalSteps: allAgents.length,
      });

      const result = await this.dispatchSingle(agentType, currentInput);
      results.push(result);

      if (!result.success) {
        if (isPrimary) {
          // Primary agent failure — abort the pipeline
          return {
            results,
            finalResult: result.error,
            totalDuration: Date.now() - startTime,
          };
        }
        // Secondary agent failure — non-fatal, continue with existing input
        continue;
      }

      // Chain results for the next agent
      currentInput = { ...currentInput, previousResult: result.result };
    }

    return {
      results,
      finalResult: results[results.length - 1]?.result ?? null,
      totalDuration: Date.now() - startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Sequential pipeline (explicit agent list)
  // -------------------------------------------------------------------------
  async executePipeline(
    agents: AgentType[],
    initialInput: Record<string, unknown>,
  ): Promise<PipelineResult> {
    const results: AgentDispatchResult[] = [];
    let currentInput = { ...initialInput };
    const startTime = Date.now();

    for (const agentType of agents) {
      this.emitDispatchEvent('agent:dispatch:progress', {
        agentType,
        step: results.length + 1,
        totalSteps: agents.length,
      });

      const result = await this.dispatchSingle(agentType, currentInput);
      results.push(result);

      if (!result.success) {
        // Pipeline fails on first error
        return {
          results,
          finalResult: result.error,
          totalDuration: Date.now() - startTime,
        };
      }

      // Chain: pass previous agent's output as input to next
      currentInput = { ...currentInput, previousResult: result.result };
    }

    return {
      results,
      finalResult: results[results.length - 1]?.result ?? null,
      totalDuration: Date.now() - startTime,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private timeoutReject(ms: number, agentType: AgentType): Promise<never> {
    return new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Agent ${agentType} timed out after ${ms}ms`)), ms);
    });
  }

  private extractUsage(
    result: unknown,
  ): { inputTokens: number; outputTokens: number; toolCalls: number } | undefined {
    if (
      result &&
      typeof result === 'object' &&
      'usage' in result &&
      result.usage &&
      typeof result.usage === 'object'
    ) {
      const u = result.usage as Record<string, unknown>;
      return {
        inputTokens: (u.inputTokens as number) ?? 0,
        outputTokens: (u.outputTokens as number) ?? 0,
        toolCalls: (u.toolCalls as number) ?? 0,
      };
    }
    return undefined;
  }

  private emitDispatchEvent(eventType: string, data: Record<string, unknown>): void {
    events.emit('update', {
      type: 'agent_progress',
      status: eventType,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
