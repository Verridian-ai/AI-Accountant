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

/** Maximum simultaneous agent dispatches per user. Prevents runaway AI costs. */
const MAX_CONCURRENT_AGENTS_PER_USER = 3;

export class AgentDispatcher {
  private orchestrator: AgentOrchestrator;
  /** In-memory concurrency counter: userId → number of active dispatches */
  private readonly activeAgentSlots = new Map<string, number>();

  constructor(orchestrator: AgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Returns the number of currently active agent dispatches for the given user.
   */
  getActiveAgentCount(userId: string): number {
    return this.activeAgentSlots.get(userId) ?? 0;
  }

  /**
   * Reserve a dispatch slot for the user, or throw if the limit is reached.
   * Must be paired with releaseSlot() in a finally block.
   */
  private acquireSlot(userId: string): void {
    const current = this.activeAgentSlots.get(userId) ?? 0;
    if (current >= MAX_CONCURRENT_AGENTS_PER_USER) {
      throw new Error(
        `Maximum concurrent agents (${MAX_CONCURRENT_AGENTS_PER_USER}) reached for user '${userId}'. Please wait for an agent to complete.`,
      );
    }
    this.activeAgentSlots.set(userId, current + 1);
  }

  /**
   * Release a dispatch slot for the user (always call in finally).
   */
  private releaseSlot(userId: string): void {
    const current = this.activeAgentSlots.get(userId) ?? 0;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      this.activeAgentSlots.delete(userId);
    } else {
      this.activeAgentSlots.set(userId, next);
    }
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
  /**
   * Dispatch an intent to one or more agents.
   *
   * @param userId - Optional user ID for per-user concurrency limiting.
   *   When provided, throws if the user already has MAX_CONCURRENT_AGENTS_PER_USER
   *   active dispatches. Pass `context.userId` here when available.
   */
  async dispatchIntent(
    classification: IntentClassification,
    userQuery: string,
    context?: Record<string, unknown>,
    userId?: string,
  ): Promise<PipelineResult> {
    if (userId) {
      this.acquireSlot(userId);
    }

    try {
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
      const allAgents: AgentType[] = [
        classification.primaryAgent,
        ...classification.secondaryAgents,
      ];
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
    } finally {
      if (userId) {
        this.releaseSlot(userId);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Sequential pipeline (explicit agent list)
  // -------------------------------------------------------------------------
  /**
   * Execute a sequential pipeline of agents with result chaining.
   *
   * @param userId - Optional user ID for per-user concurrency limiting.
   */
  async executePipeline(
    agents: AgentType[],
    initialInput: Record<string, unknown>,
    userId?: string,
  ): Promise<PipelineResult> {
    if (userId) {
      this.acquireSlot(userId);
    }

    try {
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
    } finally {
      if (userId) {
        this.releaseSlot(userId);
      }
    }
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
