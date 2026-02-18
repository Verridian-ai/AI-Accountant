import type { Hono } from 'hono';
import {
  isClaudeAgentsEnabled,
  isAgentEnabled,
  AGENT_MODELS,
} from '../../services/claude/config.js';
import type { AgentType } from '../../services/claude/types.js';

export const ALL_AGENT_TYPES: AgentType[] = [
  'statement_parser',
  'transaction_categorizer',
  'gst_calculator',
  'account_reconciler',
  'budget_analyzer',
  'cross_account_tracer',
  'merchant_intelligence',
  'payroll_agent',
  'tax_strategy',
  'personal_tax_claims',
  'financial_planner',
  'inventory_agent',
  'bank_reconciler_agent',
  'ocr_processing',
  'payment_matching',
  'asset_management',
  'multi_entity',
  'financial_reporting',
  'budgeting',
  'forecasting',
  'compliance_monitoring',
];

export function registerStatusRoute(app: Hono): void {
  app.get('/agents/status', async (c) => {
    const globalEnabled = isClaudeAgentsEnabled();

    const agents = ALL_AGENT_TYPES.map((agentType) => ({
      agentType,
      model: AGENT_MODELS[agentType],
      isEnabled: globalEnabled && isAgentEnabled(agentType),
      globalSwitch: globalEnabled,
    }));

    return c.json({
      success: true,
      globalEnabled,
      agentCount: agents.length,
      agents,
      timestamp: new Date().toISOString(),
    });
  });
}
