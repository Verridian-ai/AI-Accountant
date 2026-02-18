/**
 * Agent Health Monitor — Core Implementation
 *
 * HealthMonitor class and singleton that coordinates circuit breaking,
 * health check execution, and listener notification.
 * Uses CircuitBreaker from circuit-breaker.ts and runHealthCheckProcess
 * from health-check-runner.ts.
 */

import { agentRegistry, AGENT_CONFIGS } from './registry.js';
import { AgentType, AgentHealth, HealthState } from './types.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { runHealthCheckProcess } from './health-check-runner.js';
import type { HealthCheckConfig, HealthChangeListener, HealthSummary } from './health-types.js';
import { DEFAULT_HEALTH_CONFIG } from './health-types.js';

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
      const result = await runHealthCheckProcess(config.scriptPath, this.config.checkTimeoutMs);

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
   * Get circuit breaker state for an agent
   */
  getCircuitState(agentType: AgentType): ReturnType<CircuitBreaker['getState']> {
    return this.circuitBreaker.getState(agentType);
  }

  /**
   * Get all circuit states
   */
  getAllCircuitStates(): ReturnType<CircuitBreaker['getAllStates']> {
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
// SINGLETON INSTANCE
// ============================================================================

export const healthMonitor = new HealthMonitor();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  healthMonitor.start();
}
