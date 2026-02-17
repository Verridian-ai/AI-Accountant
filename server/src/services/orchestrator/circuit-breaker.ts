/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern for agent health management.
 * Prevents cascading failures by tracking success/failure and
 * temporarily blocking requests to unhealthy agents.
 */

import { AgentType } from './types.js';
import { AGENT_CONFIGS } from './registry.js';
import { HealthCheckConfig, DEFAULT_HEALTH_CONFIG } from './health-types.js';

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

export class CircuitBreaker {
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
