/**
 * Agent Orchestrator
 *
 * Central orchestration layer for Python agent execution.
 * Handles timeouts, retries, caching, health tracking, and tracing.
 */

import { spawn, ChildProcess } from 'child_process';
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
  ERROR_CONFIG,
  IAgentOrchestrator,
  CacheStats,
  AgentHealth,
} from './types.js';
import { agentRegistry, AGENT_CONFIGS } from './registry.js';
import { agentCache, generateCacheKey, hashContext } from './cache.js';
import { agentTracer } from './tracing.js';

// ============================================================================
// ORCHESTRATOR IMPLEMENTATION
// ============================================================================

export class AgentOrchestrator implements IAgentOrchestrator {
  private activeRequests: Map<string, AbortController> = new Map();
  // Note: requestQueue reserved for future queue-based execution with concurrency limits
  // private requestQueue: Map<AgentType, AgentRequest[]> = new Map();

  constructor() {
    // Constructor intentionally empty - queuing not yet implemented
  }

  /**
   * Execute a single agent request
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const config = agentRegistry.getConfig(request.agentType);

    if (!config) {
      throw this.createError('AGENT_UNAVAILABLE', `Agent ${request.agentType} not found`);
    }

    // Start tracing
    const traceId = agentTracer.startTrace(request.requestId, request.agentType, request.query);

    try {
      // Check cache first
      if (!request.skipCache) {
        const contextHash = request.context ? hashContext(request.context as Record<string, unknown>) : undefined;
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

      // Execute with retries
      const response = await this.executeWithRetry(request, config, traceId);

      // Cache successful responses
      if (response.status === 'success' && !request.skipCache) {
        const contextHash = request.context ? hashContext(request.context as Record<string, unknown>) : undefined;
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

  /**
   * Execute multiple requests concurrently
   * Uses Promise.allSettled to prevent a single failure from canceling all requests
   */
  async executeConcurrent(requests: AgentRequest[]): Promise<AgentResponse[]> {
    const promises = requests.map(request => this.execute(request));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Return error response for failed requests
      const request = requests[index];
      return {
        requestId: request.requestId,
        agentType: request.agentType,
        content: result.reason instanceof Error ? result.reason.message : String(result.reason),
        metadata: {
          executionTimeMs: 0,
          agentTimeMs: 0,
          retryCount: 0,
        },
        fromCache: false,
        status: 'error' as const,
      };
    });
  }

  /**
   * Execute requests sequentially
   */
  async executeSequential(requests: AgentRequest[]): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];

    for (const request of requests) {
      const response = await this.execute(request);
      results.push(response);
    }

    return results;
  }

  /**
   * Get agent health status
   */
  async getHealth(agentType?: AgentType): Promise<AgentHealth | AgentHealth[]> {
    if (agentType) {
      const health = agentRegistry.getHealth(agentType);
      if (!health) {
        throw this.createError('AGENT_UNAVAILABLE', `Agent ${agentType} not found`);
      }
      return health;
    }
    return agentRegistry.getAllHealth();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    return agentCache.getStats();
  }

  /**
   * Clear cache
   */
  async clearCache(agentType?: AgentType): Promise<void> {
    if (agentType) {
      agentCache.clearByAgent(agentType);
    } else {
      agentCache.clear();
    }
  }

  /**
   * Cancel a running request
   */
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
    traceId: string
  ): Promise<AgentResponse> {
    let lastError: AgentError | null = null;
    const maxRetries = config.maxRetries;
    const timeoutMs = request.timeoutMs || config.timeoutMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      agentTracer.addEvent(traceId, 'attempt_start', { attempt, maxRetries });
      agentRegistry.incrementActiveRequests(request.agentType);

      const startTime = Date.now();
      let success = false;

      try {
        const result = await this.executeAgent(request, config, timeoutMs);
        const executionTime = Date.now() - startTime;

        success = true;
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
        lastError = error instanceof AgentErrorImpl
          ? error
          : this.createError('UNKNOWN_ERROR', String(error));

        agentRegistry.recordError(
          request.agentType,
          lastError.code,
          lastError.message
        );

        agentTracer.addEvent(traceId, 'attempt_failed', {
          attempt,
          error: lastError.code,
          message: lastError.message,
        });

        // Don't retry non-retryable errors
        if (!lastError.retryable) {
          break;
        }

        // Don't retry on last attempt
        if (attempt < maxRetries) {
          const delay = config.retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      } finally {
        // Always decrement active requests, regardless of success or failure
        agentRegistry.decrementActiveRequests(request.agentType);
      }
    }

    // All retries failed
    return {
      requestId: request.requestId,
      agentType: request.agentType,
      content: lastError?.message || 'Unknown error',
      metadata: {
        executionTimeMs: 0,
        agentTimeMs: 0,
        retryCount: maxRetries,
      },
      fromCache: false,
      status: this.errorCodeToStatus(lastError?.code || 'UNKNOWN_ERROR'),
    };
  }

  private async executeAgent(
    request: AgentRequest,
    config: AgentConfig,
    timeoutMs: number
  ): Promise<AgentExecutionResult> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      this.activeRequests.set(request.requestId, controller);
      let isSettled = false;
      let pythonProcess: ChildProcess | null = null;

      const cleanup = () => {
        this.activeRequests.delete(request.requestId);
      };

      const safeReject = (error: AgentError) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(error);
      };

      const safeResolve = (result: AgentExecutionResult) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve(result);
      };

      // Set up timeout with explicit process kill
      const timeoutId = setTimeout(() => {
        if (pythonProcess && !pythonProcess.killed) {
          pythonProcess.kill('SIGKILL');
        }
        controller.abort();
        safeReject(this.createError('TIMEOUT', `Agent execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Prepare input for Python agent
      const input = JSON.stringify({
        query: request.query,
        userId: request.userId,
        context: request.context,
        requestId: request.requestId,
      });

      // Spawn Python process
      pythonProcess = spawn('python', [config.scriptPath], {
        env: {
          ...process.env,
          AGENT_INPUT: input,
        },
        signal: controller.signal,
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (isSettled) return;

        if (code !== 0) {
          safeReject(this.createError(
            'PROCESS_CRASHED',
            `Agent process exited with code ${code}: ${stderr}`
          ));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          safeResolve({
            content: result.content || result.response || '',
            data: result.data,
            toolCalls: result.toolCalls,
            agentTimeMs: result.executionTimeMs || 0,
            modelUsed: result.modelUsed,
            tokenUsage: result.tokenUsage,
            agentVersion: result.version,
          });
        } catch (parseError) {
          safeReject(this.createError(
            'INVALID_RESPONSE',
            `Failed to parse agent response: ${parseError}`
          ));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          safeReject(this.createError('TIMEOUT', 'Agent execution was cancelled'));
        } else {
          safeReject(this.createError('PROCESS_CRASHED', error.message));
        }
      });

      // Send input via stdin
      pythonProcess.stdin?.write(input);
      pythonProcess.stdin?.end();
    });
  }

  private createError(code: ErrorCode, message: string): AgentError {
    const config = ERROR_CONFIG[code];
    return new AgentErrorImpl(
      code,
      message || config.defaultMessage,
      config.retryable
    );
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// ERROR CLASS
// ============================================================================

class AgentErrorImpl extends Error implements AgentError {
  code: ErrorCode;
  retryable: boolean;
  cause?: Error;
  context?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.retryable = retryable;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface AgentExecutionResult {
  content: string;
  data?: Record<string, unknown>;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    durationMs: number;
  }>;
  agentTimeMs: number;
  modelUsed?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  agentVersion?: string;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const agentOrchestrator = new AgentOrchestrator();

// ============================================================================
// ROUTE HELPER
// ============================================================================

/**
 * Route a user query to the appropriate agent and execute it
 */
export async function routeAndExecute(
  query: string,
  userId: string,
  context?: AgentContext
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
