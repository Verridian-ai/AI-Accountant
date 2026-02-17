/**
 * Agent Configurations
 *
 * Centralized configuration for all Python agents including
 * capabilities, timeouts, and routing.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { AgentType, AgentConfig } from './types.js';

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
export const CAPABILITY_ROUTING: Record<string, AgentType> = {
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
