/**
 * Agent Health Monitoring
 *
 * Provides health check endpoints and background monitoring
 * for Python agents with heartbeat, circuit breaker, and alerting.
 */

import { spawn } from 'child_process';
import { agentRegistry, AGENT_CONFIGS } from './registry.js';
import { AgentType, AgentHealth, HealthState, HEALTH_THRESHOLDS } from './types.js';

// ============================================================================
// HEALTH CHECK CONFIGURATION
// ============================================================================

export interface HealthCheckConfig {
  /** Interval between health checks (ms) */
  checkIntervalMs: number;
  /** Timeout for health check requests (ms) */
  checkTimeoutMs: number;
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold: number;
  /** Number of consecutive successes before marking healthy */
  recoveryThreshold: number;
  /** Enable/disable background health checks */
  enabled: boolean;
}

export const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  checkIntervalMs: 30000, // 30 seconds
  checkTimeoutMs: 10000, // 10 seconds
  failureThreshold: 3,
  recoveryThreshold: 2,
  enabled: true,
};

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
}

const CIRCUIT_OPEN_DURATION_MS = 30000; // 30 seconds

class CircuitBreaker {
  private states: Map<AgentType, CircuitBreakerState> = new Map();
  private config: HealthCheckConfig;

  constructor(config: HealthCheckConfig = DEFAULT_HEALTH_CONFIG) {
    this.config = config;

    // Initialize states for all agents
    for (const agentType of Object.keys(AGENT_CONFIGS) as AgentType[]) {
      this.states.set(agentType, {
        state: 'closed',
        failures: 0,
        successes: 0,
      });
    }
  }

  /**
   * Check if requests should be allowed for an agent
   */
  allowRequest(agentType: AgentType): boolean {
    const state = this.states.get(agentType);
    if (!state) return true;

    switch (state.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if we should transition to half-open
        if (state.nextRetryTime && Date.now() >= state.nextRetryTime) {
          state.state = 'half-open';
          return true;
        }
        return false;

      case 'half-open':
        // Allow limited requests in half-open state
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(agentType: AgentType): void {
    const state = this.states.get(agentType);
    if (!state) return;

    state.successes++;
    state.failures = 0;

    if (state.state === 'half-open') {
      if (state.successes >= this.config.recoveryThreshold) {
        state.state = 'closed';
        state.successes = 0;
      }
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(agentType: AgentType): void {
    const state = this.states.get(agentType);
    if (!state) return;

    state.failures++;
    state.successes = 0;
    state.lastFailureTime = Date.now();

    if (state.state === 'closed') {
      if (state.failures >= this.config.failureThreshold) {
        state.state = 'open';
        state.nextRetryTime = Date.now() + CIRCUIT_OPEN_DURATION_MS;
      }
    } else if (state.state === 'half-open') {
      // Any failure in half-open goes back to open
      state.state = 'open';
      state.nextRetryTime = Date.now() + CIRCUIT_OPEN_DURATION_MS;
    }
  }

  /**
   * Get circuit state for an agent
   */
  getState(agentType: AgentType): CircuitBreakerState | undefined {
    return this.states.get(agentType);
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Map<AgentType, CircuitBreakerState> {
    return new Map(this.states);
  }

  /**
   * Reset circuit for an agent
   */
  reset(agentType: AgentType): void {
    this.states.set(agentType, {
      state: 'closed',
      failures: 0,
      successes: 0,
    });
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const agentType of this.states.keys()) {
      this.reset(agentType);
    }
  }
}

// ============================================================================
// HEALTH MONITOR
// ============================================================================

export class HealthMonitor {
  private config: HealthCheckConfig;
  private circuitBreaker: CircuitBreaker;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: HealthChangeListener[] = [];

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
    this.circuitBreaker = new CircuitBreaker(this.config);
  }

  /**
   * Start background health monitoring
   */
  start(): void {
    if (this.checkInterval || !this.config.enabled) {
      return;
    }

    // Initial check
    this.runHealthChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop background health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Run health checks for all agents
   */
  async runHealthChecks(): Promise<void> {
    const agentTypes = Object.keys(AGENT_CONFIGS) as AgentType[];

    await Promise.all(agentTypes.map((agentType) => this.checkAgent(agentType)));
  }

  /**
   * Check health of a specific agent
   */
  async checkAgent(agentType: AgentType): Promise<AgentHealth | null> {
    const config = agentRegistry.getConfig(agentType);
    if (!config) return null;

    const previousHealth = agentRegistry.getHealth(agentType);
    const previousState = previousHealth?.state;

    try {
      // Run a simple health check by spawning the agent with a health check command
      const result = await this.runHealthCheck(config.scriptPath, agentType);

      if (result.healthy) {
        this.circuitBreaker.recordSuccess(agentType);
        agentRegistry.recordSuccess(agentType, result.responseTimeMs);
      } else {
        this.circuitBreaker.recordFailure(agentType);
        agentRegistry.recordError(
          agentType,
          'PROCESS_CRASHED',
          result.error || 'Health check failed',
        );
      }
    } catch (error) {
      this.circuitBreaker.recordFailure(agentType);
      agentRegistry.recordError(
        agentType,
        'PROCESS_CRASHED',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    const currentHealth = agentRegistry.getHealth(agentType);

    // Notify listeners if state changed
    if (currentHealth && previousState !== currentHealth.state) {
      this.notifyListeners(agentType, previousState || 'unknown', currentHealth.state);
    }

    return currentHealth || null;
  }

  /**
   * Run a health check against an agent
   */
  private async runHealthCheck(
    scriptPath: string,
    agentType: AgentType,
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      let isResolved = false;
      let healthCheckProcess: ReturnType<typeof spawn> | null = null;

      const safeResolve = (result: HealthCheckResult) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutHandle);
        resolve(result);
      };

      const timeoutHandle = setTimeout(() => {
        // Kill the process if it's still running
        if (healthCheckProcess && !healthCheckProcess.killed) {
          healthCheckProcess.kill('SIGKILL');
        }
        safeResolve({
          healthy: false,
          responseTimeMs: this.config.checkTimeoutMs,
          error: 'Health check timed out',
        });
      }, this.config.checkTimeoutMs);

      healthCheckProcess = spawn('python', [scriptPath, '--health-check']);

      let stdout = '';
      let stderr = '';

      healthCheckProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      healthCheckProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      healthCheckProcess.on('close', (code) => {
        const responseTimeMs = Date.now() - startTime;

        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            safeResolve({
              healthy: result.healthy !== false,
              responseTimeMs,
              version: result.version,
              details: result,
            });
          } catch {
            safeResolve({
              healthy: true, // Process ran successfully
              responseTimeMs,
            });
          }
        } else {
          safeResolve({
            healthy: false,
            responseTimeMs,
            error: stderr || `Process exited with code ${code}`,
          });
        }
      });

      healthCheckProcess.on('error', (error) => {
        safeResolve({
          healthy: false,
          responseTimeMs: Date.now() - startTime,
          error: error.message,
        });
      });
    });
  }

  /**
   * Check if requests should be allowed for an agent
   */
  allowRequest(agentType: AgentType): boolean {
    return this.circuitBreaker.allowRequest(agentType);
  }

  /**
   * Record a successful agent execution
   */
  recordSuccess(agentType: AgentType): void {
    this.circuitBreaker.recordSuccess(agentType);
  }

  /**
   * Record a failed agent execution
   */
  recordFailure(agentType: AgentType): void {
    this.circuitBreaker.recordFailure(agentType);
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(agentType: AgentType): CircuitBreakerState | undefined {
    return this.circuitBreaker.getState(agentType);
  }

  /**
   * Get all circuit states
   */
  getAllCircuitStates(): Map<AgentType, CircuitBreakerState> {
    return this.circuitBreaker.getAllStates();
  }

  /**
   * Register a health change listener
   */
  onHealthChange(listener: HealthChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get aggregate health summary
   */
  getAggregateSummary(): HealthSummary {
    const allHealth = agentRegistry.getAllHealth();

    const summary: HealthSummary = {
      totalAgents: allHealth.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      overallState: 'healthy',
      agents: {} as Record<
        AgentType,
        {
          state: HealthState;
          successRate: number;
          avgResponseTimeMs: number;
          activeRequests: number;
        }
      >,
    };

    for (const health of allHealth) {
      summary[health.state]++;
      summary.agents[health.agentType] = {
        state: health.state,
        successRate: health.metrics.successRate,
        avgResponseTimeMs: health.metrics.avgResponseTimeMs,
        activeRequests: health.metrics.activeRequests,
      };
    }

    // Determine overall state
    if (summary.unhealthy > 0) {
      summary.overallState = 'unhealthy';
    } else if (summary.degraded > 0) {
      summary.overallState = 'degraded';
    } else if (summary.unknown === summary.totalAgents) {
      summary.overallState = 'unknown';
    }

    return summary;
  }

  private notifyListeners(
    agentType: AgentType,
    previousState: HealthState,
    currentState: HealthState,
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(agentType, previousState, currentState);
      } catch (error) {
        console.error('Health change listener error:', error);
      }
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface HealthCheckResult {
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
  version?: string;
  details?: Record<string, unknown>;
}

export type HealthChangeListener = (
  agentType: AgentType,
  previousState: HealthState,
  currentState: HealthState,
) => void;

export interface HealthSummary {
  totalAgents: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  overallState: HealthState;
  agents: Record<
    AgentType,
    {
      state: HealthState;
      successRate: number;
      avgResponseTimeMs: number;
      activeRequests: number;
    }
  >;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const healthMonitor = new HealthMonitor();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  healthMonitor.start();
}
