/**
 * Agent Orchestrator — Core Implementation
 *
 * AgentOrchestrator class with retry logic, caching, and tracing.
 * Delegates process spawning to agent-executor.ts and error construction
 * to orchestrator-types.ts.
 */

import crypto from 'crypto';
import {
  AgentType,
  AgentConfig,
  AgentRequest,
  AgentResponse,
  AgentError,
  AgentContext,
  ResponseStatus,
  ErrorCode,
  IAgentOrchestrator,
  CacheStats,
  AgentHealth,
} from './types.js';
import { agentRegistry } from './registry.js';
import { agentCache, generateCacheKey, hashContext } from './cache.js';
import { agentTracer } from './tracing.js';
import { AgentErrorImpl, AgentExecutionResult, createAgentError } from './orchestrator-types.js';
import { executeAgentProcess } from './agent-executor.js';

// ============================================================================
// ORCHESTRATOR IMPLEMENTATION
// ============================================================================

export class AgentOrchestrator implements IAgentOrchestrator {
  private activeRequests: Map<string, AbortController> = new Map();

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const config = agentRegistry.getConfig(request.agentType);

    if (!config) {
      throw createAgentError('AGENT_UNAVAILABLE', `Agent ${request.agentType} not found`);
    }

    const traceId = agentTracer.startTrace(request.requestId, request.agentType, request.query);

    try {
      if (!request.skipCache) {
        const contextHash = request.context
          ? hashContext(request.context as Record<string, unknown>)
          : undefined;
        const cacheKey = generateCacheKey(request.agentType, request.query, contextHash);
        const cached = agentCache.get(cacheKey);

        if (cached) {
          agentTracer.addEvent(traceId, 'cache_hit', { cacheKey });
          agentTracer.endTrace(traceId, 'ok');
          return {
            ...cached,
            requestId: request.requestId,
            metadata: {
              ...cached.metadata,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
      }

      const response = await this.executeWithRetry(request, config, traceId);

      if (response.status === 'success' && !request.skipCache) {
        const contextHash = request.context
          ? hashContext(request.context as Record<string, unknown>)
          : undefined;
        const cacheKey = generateCacheKey(request.agentType, request.query, contextHash);
        agentCache.set(cacheKey, response);
      }

      agentTracer.endTrace(traceId, 'ok');
      return response;
    } catch (error) {
      agentTracer.addEvent(traceId, 'error', {
        error: error instanceof Error ? error.message : String(error),
      });
      agentTracer.endTrace(traceId, 'error');
      throw error;
    }
  }

  async executeConcurrent(requests: AgentRequest[]): Promise<AgentResponse[]> {
    const promises = requests.map((request) => this.execute(request));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const request = requests[index];
      return {
        requestId: request.requestId,
        agentType: request.agentType,
        content: result.reason instanceof Error ? result.reason.message : String(result.reason),
        metadata: { executionTimeMs: 0, agentTimeMs: 0, retryCount: 0 },
        fromCache: false,
        status: 'error' as const,
      };
    });
  }

  async executeSequential(requests: AgentRequest[]): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];
    for (const request of requests) {
      results.push(await this.execute(request));
    }
    return results;
  }

  async getHealth(agentType?: AgentType): Promise<AgentHealth | AgentHealth[]> {
    if (agentType) {
      const health = agentRegistry.getHealth(agentType);
      if (!health) {
        throw createAgentError('AGENT_UNAVAILABLE', `Agent ${agentType} not found`);
      }
      return health;
    }
    return agentRegistry.getAllHealth();
  }

  async getCacheStats(): Promise<CacheStats> {
    return agentCache.getStats();
  }

  async clearCache(agentType?: AgentType): Promise<void> {
    if (agentType) {
      agentCache.clearByAgent(agentType);
    } else {
      agentCache.clear();
    }
  }

  async cancel(requestId: string): Promise<boolean> {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async executeWithRetry(
    request: AgentRequest,
    config: AgentConfig,
    traceId: string,
  ): Promise<AgentResponse> {
    let lastError: AgentError | null = null;
    const maxRetries = config.maxRetries;
    const timeoutMs = request.timeoutMs || config.timeoutMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      agentTracer.addEvent(traceId, 'attempt_start', { attempt, maxRetries });
      agentRegistry.incrementActiveRequests(request.agentType);

      const startTime = Date.now();

      try {
        const result = await this.executeAgent(request, config, timeoutMs);
        const executionTime = Date.now() - startTime;

        agentRegistry.recordSuccess(request.agentType, executionTime);

        return {
          requestId: request.requestId,
          agentType: request.agentType,
          content: result.content,
          data: result.data,
          toolCalls: result.toolCalls,
          metadata: {
            executionTimeMs: executionTime,
            agentTimeMs: result.agentTimeMs,
            retryCount: attempt,
            modelUsed: result.modelUsed,
            tokenUsage: result.tokenUsage,
            agentVersion: result.agentVersion,
          },
          fromCache: false,
          status: 'success',
        };
      } catch (error) {
        lastError =
          error instanceof AgentErrorImpl
            ? error
            : createAgentError('UNKNOWN_ERROR', String(error));

        agentRegistry.recordError(request.agentType, lastError.code, lastError.message);

        agentTracer.addEvent(traceId, 'attempt_failed', {
          attempt,
          error: lastError.code,
          message: lastError.message,
        });

        if (!lastError.retryable) break;

        if (attempt < maxRetries) {
          const delay = config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      } finally {
        agentRegistry.decrementActiveRequests(request.agentType);
      }
    }

    return {
      requestId: request.requestId,
      agentType: request.agentType,
      content: lastError?.message || 'Unknown error',
      metadata: { executionTimeMs: 0, agentTimeMs: 0, retryCount: maxRetries },
      fromCache: false,
      status: this.errorCodeToStatus(lastError?.code || 'UNKNOWN_ERROR'),
    };
  }

  private executeAgent(
    request: AgentRequest,
    config: AgentConfig,
    timeoutMs: number,
  ): Promise<AgentExecutionResult> {
    return executeAgentProcess(request, config, timeoutMs, this.activeRequests);
  }

  private errorCodeToStatus(code: ErrorCode): ResponseStatus {
    switch (code) {
      case 'TIMEOUT':
        return 'timeout';
      default:
        return 'error';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const agentOrchestrator = new AgentOrchestrator();

// ============================================================================
// ROUTE HELPER
// ============================================================================

export async function routeAndExecute(
  query: string,
  userId: string,
  context?: AgentContext,
): Promise<AgentResponse> {
  const agentType = agentRegistry.routeQuery(query);
  const requestId = crypto.randomUUID();

  return agentOrchestrator.execute({
    requestId,
    agentType,
    query,
    userId,
    context,
  });
}
