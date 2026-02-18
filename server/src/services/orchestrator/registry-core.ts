/**
 * Agent Registry — Core Implementation
 *
 * AgentRegistry class and singleton for managing Python agent
 * configurations, health state, and routing.
 * Uses AGENT_CONFIGS from agent-configs.ts and MetricsWindow from registry-health.ts.
 */

import {
  AgentType,
  AgentConfig,
  AgentHealth,
  HealthState,
  ErrorCode,
  HEALTH_THRESHOLDS,
} from './types.js';
import { AGENT_CONFIGS } from './agent-configs.js';
import type { MetricsWindow } from './registry-health.js';

// ============================================================================
// CAPABILITY ROUTING
// ============================================================================

const CAPABILITY_ROUTING: Record<string, AgentType> = {
  // Financial Analyst capabilities
  'spending-analysis': 'financial-analyst',
  'cash-flow': 'financial-analyst',
  projections: 'financial-analyst',
  'budget-recommendations': 'financial-analyst',
  'merchant-analysis': 'financial-analyst',
  'category-insights': 'financial-analyst',

  // BAS Agent capabilities
  'gst-categorization': 'bas',
  'bas-calculation': 'bas',
  'tax-code-assignment': 'bas',
  'gst-reporting': 'bas',
  'ato-compliance': 'bas',

  // Tax Agent capabilities
  'income-tax': 'tax',
  deductions: 'tax',
  'cgt-calculation': 'tax',
  depreciation: 'tax',
  'tax-planning': 'tax',
  'wfh-deductions': 'tax',
  'motor-vehicle': 'tax',

  // Reconciliation Agent capabilities
  'duplicate-detection': 'reconciliation',
  'balance-verification': 'reconciliation',
  'discrepancy-detection': 'reconciliation',
  'transfer-matching': 'reconciliation',
  'data-quality': 'reconciliation',
};

// ============================================================================
// AGENT REGISTRY CLASS
// ============================================================================

export class AgentRegistry {
  private configs: Map<AgentType, AgentConfig> = new Map();
  private healthState: Map<AgentType, AgentHealth> = new Map();
  private metricsWindow: Map<AgentType, MetricsWindow> = new Map();

  constructor() {
    for (const config of Object.values(AGENT_CONFIGS)) {
      this.register(config);
    }
  }

  register(config: AgentConfig): void {
    this.configs.set(config.id, config);
    this.initializeHealth(config.id);
    this.initializeMetricsWindow(config.id);
  }

  getConfig(agentType: AgentType): AgentConfig | undefined {
    return this.configs.get(agentType);
  }

  getAllConfigs(): AgentConfig[] {
    return Array.from(this.configs.values());
  }

  isRegistered(agentType: AgentType): boolean {
    return this.configs.has(agentType);
  }

  findByCapability(capability: string): AgentType | undefined {
    return CAPABILITY_ROUTING[capability];
  }

  findAllByCapability(capability: string): AgentConfig[] {
    return this.getAllConfigs().filter((config) => config.capabilities.includes(capability));
  }

  routeQuery(query: string): AgentType {
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes('gst') ||
      lowerQuery.includes('bas') ||
      lowerQuery.includes('tax code') ||
      lowerQuery.includes('ato')
    ) {
      return 'bas';
    }

    if (
      lowerQuery.includes('tax') ||
      lowerQuery.includes('deduction') ||
      lowerQuery.includes('depreciation') ||
      lowerQuery.includes('capital gain') ||
      lowerQuery.includes('cgt') ||
      lowerQuery.includes('work from home') ||
      lowerQuery.includes('wfh')
    ) {
      return 'tax';
    }

    if (
      lowerQuery.includes('duplicate') ||
      lowerQuery.includes('balance') ||
      lowerQuery.includes('reconcil') ||
      lowerQuery.includes('discrepanc') ||
      lowerQuery.includes('mismatch')
    ) {
      return 'reconciliation';
    }

    return 'financial-analyst';
  }

  // ============================================================================
  // HEALTH MANAGEMENT
  // ============================================================================

  private initializeHealth(agentType: AgentType): void {
    this.healthState.set(agentType, {
      agentType,
      state: 'unknown',
      lastCheckAt: new Date().toISOString(),
      metrics: {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        timeoutCount: 0,
        successRate: 1,
        avgResponseTimeMs: 0,
        p95ResponseTimeMs: 0,
        activeRequests: 0,
        queueDepth: 0,
      },
      recentErrors: [],
    });
  }

  private initializeMetricsWindow(agentType: AgentType): void {
    this.metricsWindow.set(agentType, {
      responseTimes: [],
      windowStartTime: Date.now(),
      windowDurationMs: 5 * 60 * 1000, // 5 minutes
    });
  }

  getHealth(agentType: AgentType): AgentHealth | undefined {
    return this.healthState.get(agentType);
  }

  getAllHealth(): AgentHealth[] {
    return Array.from(this.healthState.values());
  }

  recordSuccess(agentType: AgentType, responseTimeMs: number): void {
    const health = this.healthState.get(agentType);
    const metricsWindow = this.metricsWindow.get(agentType);
    if (!health || !metricsWindow) return;

    health.metrics.totalRequests++;
    health.metrics.successCount++;
    health.lastSuccessAt = new Date().toISOString();
    this.addResponseTime(agentType, responseTimeMs);
    this.recalculateHealth(agentType);
  }

  recordError(
    agentType: AgentType,
    errorCode: string,
    errorMessage: string,
    responseTimeMs?: number,
  ): void {
    const health = this.healthState.get(agentType);
    if (!health) return;

    health.metrics.totalRequests++;
    health.metrics.errorCount++;

    if (errorCode === 'TIMEOUT') {
      health.metrics.timeoutCount++;
    }

    if (responseTimeMs) {
      this.addResponseTime(agentType, responseTimeMs);
    }

    this.addRecentError(agentType, errorCode, errorMessage);
    this.recalculateHealth(agentType);
  }

  incrementActiveRequests(agentType: AgentType): void {
    const health = this.healthState.get(agentType);
    if (health) health.metrics.activeRequests++;
  }

  decrementActiveRequests(agentType: AgentType): void {
    const health = this.healthState.get(agentType);
    if (health && health.metrics.activeRequests > 0) health.metrics.activeRequests--;
  }

  private addResponseTime(agentType: AgentType, responseTimeMs: number): void {
    const metricsWindow = this.metricsWindow.get(agentType);
    if (!metricsWindow) return;

    const now = Date.now();
    if (now - metricsWindow.windowStartTime > metricsWindow.windowDurationMs) {
      metricsWindow.responseTimes = [];
      metricsWindow.windowStartTime = now;
    }

    metricsWindow.responseTimes.push(responseTimeMs);

    const health = this.healthState.get(agentType);
    if (health) {
      const times = metricsWindow.responseTimes;
      if (times.length === 0) {
        health.metrics.avgResponseTimeMs = 0;
        health.metrics.p95ResponseTimeMs = 0;
        return;
      }
      health.metrics.avgResponseTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
      const sorted = [...times].sort((a, b) => a - b);
      const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
      health.metrics.p95ResponseTimeMs = sorted[p95Index] ?? 0;
    }
  }

  private addRecentError(agentType: AgentType, errorCode: string, errorMessage: string): void {
    const health = this.healthState.get(agentType);
    if (!health) return;

    const validErrorCodes: ErrorCode[] = [
      'TIMEOUT',
      'PROCESS_CRASHED',
      'INVALID_RESPONSE',
      'MODEL_ERROR',
      'VALIDATION_ERROR',
      'RATE_LIMITED',
      'AGENT_UNAVAILABLE',
      'CONTEXT_TOO_LARGE',
      'UNKNOWN_ERROR',
    ];
    const validatedCode: ErrorCode = validErrorCodes.includes(errorCode as ErrorCode)
      ? (errorCode as ErrorCode)
      : 'UNKNOWN_ERROR';

    const existing = health.recentErrors.find((e) => e.code === validatedCode);
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date().toISOString();
      existing.sampleMessage = errorMessage;
    } else {
      health.recentErrors.push({
        code: validatedCode,
        count: 1,
        lastOccurrence: new Date().toISOString(),
        sampleMessage: errorMessage,
      });
    }

    if (health.recentErrors.length > 10) {
      health.recentErrors = health.recentErrors.slice(-10);
    }
  }

  private recalculateHealth(agentType: AgentType): void {
    const health = this.healthState.get(agentType);
    if (!health) return;

    const metrics = health.metrics;
    metrics.successRate =
      metrics.totalRequests > 0 ? metrics.successCount / metrics.totalRequests : 1;

    let state: HealthState = 'unknown';

    if (metrics.totalRequests === 0) {
      state = 'unknown';
    } else if (
      metrics.successRate >= HEALTH_THRESHOLDS.healthySuccessRate &&
      metrics.p95ResponseTimeMs <= HEALTH_THRESHOLDS.healthyP95Ms &&
      metrics.errorCount <= HEALTH_THRESHOLDS.maxErrorsBeforeDegraded
    ) {
      state = 'healthy';
    } else if (
      metrics.successRate >= HEALTH_THRESHOLDS.degradedSuccessRate &&
      metrics.p95ResponseTimeMs <= HEALTH_THRESHOLDS.degradedP95Ms &&
      metrics.errorCount <= HEALTH_THRESHOLDS.maxErrorsBeforeUnhealthy
    ) {
      state = 'degraded';
    } else {
      state = 'unhealthy';
    }

    health.state = state;
    health.lastCheckAt = new Date().toISOString();
  }

  resetHealth(agentType: AgentType): void {
    this.initializeHealth(agentType);
    this.initializeMetricsWindow(agentType);
  }

  resetAllHealth(): void {
    for (const agentType of this.configs.keys()) {
      this.resetHealth(agentType);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const agentRegistry = new AgentRegistry();
