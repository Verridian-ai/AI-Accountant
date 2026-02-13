/**
 * Agent Registry
 *
 * Centralized registry for all Python agents with their configurations,
 * capabilities, and metadata. Provides agent lookup and routing functionality.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import {
  AgentType,
  AgentConfig,
  AgentHealth,
  HealthState,
  HealthMetrics,
  ErrorCode,
  ErrorSummary,
  HEALTH_THRESHOLDS,
} from './types.js';

// ============================================================================
// AGENT CONFIGURATIONS
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_DIR = path.resolve(__dirname, '../agents');

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  'financial-analyst': {
    id: 'financial-analyst',
    name: 'Financial Analyst',
    description: 'Analyzes spending patterns, cash flow, and provides financial projections',
    scriptPath: path.join(AGENTS_DIR, 'financial_analyst.py'),
    timeoutMs: 60000, // 60 seconds
    maxRetries: 3,
    retryDelayMs: 1000,
    capabilities: [
      'spending-analysis',
      'cash-flow',
      'projections',
      'budget-recommendations',
      'merchant-analysis',
      'category-insights',
    ],
    modelType: 'reasoning',
    priority: 100,
  },
  bas: {
    id: 'bas',
    name: 'BAS Agent',
    description: 'Handles GST categorization, BAS calculations, and ATO compliance',
    scriptPath: path.join(AGENTS_DIR, 'bas_agent.py'),
    timeoutMs: 45000, // 45 seconds
    maxRetries: 3,
    retryDelayMs: 1000,
    capabilities: [
      'gst-categorization',
      'bas-calculation',
      'tax-code-assignment',
      'gst-reporting',
      'ato-compliance',
    ],
    modelType: 'code',
    priority: 90,
  },
  tax: {
    id: 'tax',
    name: 'Tax Agent',
    description: 'Calculates income tax, deductions, CGT, depreciation, and tax planning',
    scriptPath: path.join(AGENTS_DIR, 'tax_agent.py'),
    timeoutMs: 60000, // 60 seconds
    maxRetries: 3,
    retryDelayMs: 1000,
    capabilities: [
      'income-tax',
      'deductions',
      'cgt-calculation',
      'depreciation',
      'tax-planning',
      'wfh-deductions',
      'motor-vehicle',
    ],
    modelType: 'code',
    priority: 85,
  },
  reconciliation: {
    id: 'reconciliation',
    name: 'Reconciliation Agent',
    description: 'Detects duplicates, verifies balances, and identifies discrepancies',
    scriptPath: path.join(AGENTS_DIR, 'reconciliation_agent.py'),
    timeoutMs: 30000, // 30 seconds
    maxRetries: 2,
    retryDelayMs: 500,
    capabilities: [
      'duplicate-detection',
      'balance-verification',
      'discrepancy-detection',
      'transfer-matching',
      'data-quality',
    ],
    modelType: 'fast',
    priority: 80,
  },
};

// ============================================================================
// CAPABILITY ROUTING
// ============================================================================

/**
 * Maps capabilities to their primary agent
 */
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
    // Initialize with default configs
    for (const [id, config] of Object.entries(AGENT_CONFIGS)) {
      this.register(config);
    }
  }

  /**
   * Register an agent configuration
   */
  register(config: AgentConfig): void {
    this.configs.set(config.id, config);
    this.initializeHealth(config.id);
    this.initializeMetricsWindow(config.id);
  }

  /**
   * Get agent configuration by type
   */
  getConfig(agentType: AgentType): AgentConfig | undefined {
    return this.configs.get(agentType);
  }

  /**
   * Get all registered agent configurations
   */
  getAllConfigs(): AgentConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Check if an agent type is registered
   */
  isRegistered(agentType: AgentType): boolean {
    return this.configs.has(agentType);
  }

  /**
   * Find agent by capability
   */
  findByCapability(capability: string): AgentType | undefined {
    return CAPABILITY_ROUTING[capability];
  }

  /**
   * Find all agents with a specific capability
   */
  findAllByCapability(capability: string): AgentConfig[] {
    return this.getAllConfigs().filter((config) => config.capabilities.includes(capability));
  }

  /**
   * Route a query to the best agent based on keywords
   */
  routeQuery(query: string): AgentType {
    const lowerQuery = query.toLowerCase();

    // Check for BAS/GST keywords
    if (
      lowerQuery.includes('gst') ||
      lowerQuery.includes('bas') ||
      lowerQuery.includes('tax code') ||
      lowerQuery.includes('ato')
    ) {
      return 'bas';
    }

    // Check for tax keywords
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

    // Check for reconciliation keywords
    if (
      lowerQuery.includes('duplicate') ||
      lowerQuery.includes('balance') ||
      lowerQuery.includes('reconcil') ||
      lowerQuery.includes('discrepanc') ||
      lowerQuery.includes('mismatch')
    ) {
      return 'reconciliation';
    }

    // Default to financial analyst for general queries
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

  /**
   * Get health status for an agent
   */
  getHealth(agentType: AgentType): AgentHealth | undefined {
    return this.healthState.get(agentType);
  }

  /**
   * Get health status for all agents
   */
  getAllHealth(): AgentHealth[] {
    return Array.from(this.healthState.values());
  }

  /**
   * Record a successful execution
   */
  recordSuccess(agentType: AgentType, responseTimeMs: number): void {
    const health = this.healthState.get(agentType);
    const metricsWindow = this.metricsWindow.get(agentType);

    if (!health || !metricsWindow) return;

    // Update metrics
    health.metrics.totalRequests++;
    health.metrics.successCount++;
    health.lastSuccessAt = new Date().toISOString();

    // Update response time tracking
    this.addResponseTime(agentType, responseTimeMs);

    // Recalculate health state
    this.recalculateHealth(agentType);
  }

  /**
   * Record a failed execution
   */
  recordError(
    agentType: AgentType,
    errorCode: string,
    errorMessage: string,
    responseTimeMs?: number,
  ): void {
    const health = this.healthState.get(agentType);
    if (!health) return;

    // Update metrics
    health.metrics.totalRequests++;
    health.metrics.errorCount++;

    if (errorCode === 'TIMEOUT') {
      health.metrics.timeoutCount++;
    }

    if (responseTimeMs) {
      this.addResponseTime(agentType, responseTimeMs);
    }

    // Update recent errors
    this.addRecentError(agentType, errorCode, errorMessage);

    // Recalculate health state
    this.recalculateHealth(agentType);
  }

  /**
   * Increment active request count
   */
  incrementActiveRequests(agentType: AgentType): void {
    const health = this.healthState.get(agentType);
    if (health) {
      health.metrics.activeRequests++;
    }
  }

  /**
   * Decrement active request count
   */
  decrementActiveRequests(agentType: AgentType): void {
    const health = this.healthState.get(agentType);
    if (health && health.metrics.activeRequests > 0) {
      health.metrics.activeRequests--;
    }
  }

  private addResponseTime(agentType: AgentType, responseTimeMs: number): void {
    const metricsWindow = this.metricsWindow.get(agentType);
    if (!metricsWindow) return;

    // Clean old entries
    const now = Date.now();
    if (now - metricsWindow.windowStartTime > metricsWindow.windowDurationMs) {
      metricsWindow.responseTimes = [];
      metricsWindow.windowStartTime = now;
    }

    metricsWindow.responseTimes.push(responseTimeMs);

    // Update health metrics
    const health = this.healthState.get(agentType);
    if (health) {
      const times = metricsWindow.responseTimes;
      if (times.length === 0) {
        health.metrics.avgResponseTimeMs = 0;
        health.metrics.p95ResponseTimeMs = 0;
        return;
      }

      health.metrics.avgResponseTimeMs = times.reduce((a, b) => a + b, 0) / times.length;

      // Calculate p95
      const sorted = [...times].sort((a, b) => a - b);
      const p95Index = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
      health.metrics.p95ResponseTimeMs = sorted[p95Index] ?? 0;
    }
  }

  private addRecentError(agentType: AgentType, errorCode: string, errorMessage: string): void {
    const health = this.healthState.get(agentType);
    if (!health) return;

    // Validate error code is a known ErrorCode, default to UNKNOWN_ERROR
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

    // Keep only last 10 error types
    if (health.recentErrors.length > 10) {
      health.recentErrors = health.recentErrors.slice(-10);
    }
  }

  private recalculateHealth(agentType: AgentType): void {
    const health = this.healthState.get(agentType);
    if (!health) return;

    const metrics = health.metrics;

    // Calculate success rate
    metrics.successRate =
      metrics.totalRequests > 0 ? metrics.successCount / metrics.totalRequests : 1;

    // Determine health state
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

  /**
   * Reset health metrics for an agent
   */
  resetHealth(agentType: AgentType): void {
    this.initializeHealth(agentType);
    this.initializeMetricsWindow(agentType);
  }

  /**
   * Reset all health metrics
   */
  resetAllHealth(): void {
    for (const agentType of this.configs.keys()) {
      this.resetHealth(agentType);
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface MetricsWindow {
  responseTimes: number[];
  windowStartTime: number;
  windowDurationMs: number;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const agentRegistry = new AgentRegistry();
