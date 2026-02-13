/**
 * Extended Agent HTTP Routes
 *
 * Provides direct HTTP access to 7 high-priority agents + a health/status
 * endpoint. Must be mounted BEFORE the wildcard `/api/agents/:type/run`
 * route in index.ts so Hono matches these specific paths first.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { orchestrator } from '../services/claude/orchestrator.js';
import { isClaudeAgentsEnabled, isAgentEnabled, AGENT_MODELS } from '../services/claude/config.js';
import type { AgentType } from '../services/claude/types.js';

const agentRoutes = new Hono();

// ---------------------------------------------------------------------------
// Zod schemas for each route
// ---------------------------------------------------------------------------
const parseSchema = z.object({
  statementId: z.number().optional(),
  extractedText: z.string().optional(),
  fileName: z.string().optional(),
  bankName: z.string().optional(),
});

const categorizeSchema = z.object({
  transactionIds: z.array(z.number()).optional(),
  transactions: z.array(z.object({
    id: z.number(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    accountId: z.number().optional(),
    bankId: z.string().optional(),
  })).optional(),
  userId: z.string().optional(),
  limit: z.number().optional().default(50),
});

const merchantIntelSchema = z.object({
  merchantName: z.string(),
  transactionId: z.number().optional(),
  merchants: z.array(z.object({
    transactionId: z.number(),
    description: z.string(),
    amount: z.number(),
    category: z.string().optional(),
  })).optional(),
});

const payrollSchema = z.object({
  action: z.enum(['detect_wages', 'calculate_payg', 'analyze_payroll']),
  transactionIds: z.array(z.string()).optional(),
  transactions: z.array(z.object({
    id: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    category: z.string().optional(),
  })).optional(),
  userId: z.string().optional(),
  period: z.string().optional(),
  financialYear: z.string().optional(),
  quarter: z.number().optional(),
});

const taxStrategySchema = z.object({
  userId: z.string().optional(),
  taxYear: z.string().optional(),
  financialYear: z.string().optional(),
  entityType: z.enum(['sole_trader', 'personal', 'company', 'trust', 'smsf']).optional(),
  transactions: z.array(z.object({
    id: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    category: z.string().optional(),
    gstCategory: z.string().optional(),
  })).optional(),
});

const taxClaimsSchema = z.object({
  userId: z.string().optional(),
  taxYear: z.string().optional(),
  financialYear: z.string().optional(),
  claimTypes: z.array(z.string()).optional(),
  transactions: z.array(z.object({
    id: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    category: z.string().optional(),
  })).optional(),
  occupation: z.string().optional(),
  hasHomeOffice: z.boolean().optional(),
  motorVehicleKm: z.number().optional(),
});

const financialPlanSchema = z.object({
  userId: z.string().optional(),
  goal: z.string().optional(),
  timeframeMonths: z.number().optional(),
  financialYear: z.string().optional(),
  transactions: z.array(z.object({
    id: z.string(),
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    category: z.string().optional(),
  })).optional(),
  riskProfile: z.enum(['conservative', 'balanced', 'growth', 'aggressive']).optional(),
  goals: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureEnabled(agentType: AgentType): { ok: true } | { ok: false; status: number; body: { error: string } } {
  if (!isClaudeAgentsEnabled()) {
    return { ok: false, status: 503, body: { error: 'Claude agents are not enabled' } };
  }
  if (!isAgentEnabled(agentType)) {
    return { ok: false, status: 503, body: { error: `Agent ${agentType} is disabled` } };
  }
  return { ok: true };
}

function parseBody<T extends z.ZodType>(
  schema: T,
  data: unknown
): { ok: true; data: z.infer<T> } | { ok: false; status: number; body: { error: string; details?: unknown } } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    };
  }
  return { ok: true, data: result.data };
}

// ---------------------------------------------------------------------------
// 1. POST /agents/parse — Statement parser
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/parse', async (c) => {
  const check = ensureEnabled('statement_parser');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(parseSchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] statement_parser invoked');

  try {
    const result = await orchestrator.invoke('statement_parser', {
      statementId: body.data.statementId ?? 0,
      extractedText: body.data.extractedText ?? '',
      fileName: body.data.fileName ?? 'unknown',
    });
    return c.json({
      success: true,
      agentType: 'statement_parser',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] statement_parser error:', err);
    return c.json({
      success: false,
      agentType: 'statement_parser',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 2. POST /agents/categorize — Transaction categorizer
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/categorize', async (c) => {
  const check = ensureEnabled('transaction_categorizer');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(categorizeSchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] transaction_categorizer invoked');

  try {
    const txs = (body.data.transactions ?? []).map((tx) => ({
      ...tx,
      accountId: tx.accountId ?? 0,
      bankId: (tx.bankId ?? 'cba') as import('../services/parsers/types.js').BankId,
    }));
    const result = await orchestrator.invoke('transaction_categorizer', {
      transactions: txs,
      existingMerchantMemory: [],
    });
    return c.json({
      success: true,
      agentType: 'transaction_categorizer',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] transaction_categorizer error:', err);
    return c.json({
      success: false,
      agentType: 'transaction_categorizer',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 3. POST /agents/merchant-intel — Merchant intelligence
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/merchant-intel', async (c) => {
  const check = ensureEnabled('merchant_intelligence');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(merchantIntelSchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] merchant_intelligence invoked');

  try {
    const merchants = body.data.merchants ?? [
      {
        transactionId: body.data.transactionId ?? 0,
        description: body.data.merchantName,
        amount: 0,
      },
    ];
    const result = await orchestrator.invoke('merchant_intelligence', {
      merchants,
      existingMappings: [],
    });
    return c.json({
      success: true,
      agentType: 'merchant_intelligence',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] merchant_intelligence error:', err);
    return c.json({
      success: false,
      agentType: 'merchant_intelligence',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 4. POST /agents/payroll/calculate — Payroll agent
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/payroll/calculate', async (c) => {
  const check = ensureEnabled('payroll_agent');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(payrollSchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] payroll_agent invoked');

  try {
    const result = await orchestrator.invoke('payroll_agent', {
      transactions: body.data.transactions ?? [],
      userId: body.data.userId ?? 'anonymous',
      financialYear: body.data.financialYear,
      quarter: body.data.quarter,
    });
    return c.json({
      success: true,
      agentType: 'payroll_agent',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] payroll_agent error:', err);
    return c.json({
      success: false,
      agentType: 'payroll_agent',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 5. POST /agents/tax/strategy — Tax strategy
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/tax/strategy', async (c) => {
  const check = ensureEnabled('tax_strategy');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(taxStrategySchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] tax_strategy invoked');

  try {
    const result = await orchestrator.invoke('tax_strategy', {
      userId: body.data.userId ?? 'anonymous',
      financialYear: body.data.financialYear ?? body.data.taxYear ?? '2024-25',
      entityType: body.data.entityType ?? 'sole_trader',
      transactions: body.data.transactions ?? [],
    });
    return c.json({
      success: true,
      agentType: 'tax_strategy',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] tax_strategy error:', err);
    return c.json({
      success: false,
      agentType: 'tax_strategy',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 6. POST /agents/tax/claims — Personal tax claims
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/tax/claims', async (c) => {
  const check = ensureEnabled('personal_tax_claims');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(taxClaimsSchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] personal_tax_claims invoked');

  try {
    const result = await orchestrator.invoke('personal_tax_claims', {
      userId: body.data.userId ?? 'anonymous',
      financialYear: body.data.financialYear ?? body.data.taxYear ?? '2024-25',
      transactions: body.data.transactions ?? [],
      occupation: body.data.occupation,
      hasHomeOffice: body.data.hasHomeOffice,
      motorVehicleKm: body.data.motorVehicleKm,
    });
    return c.json({
      success: true,
      agentType: 'personal_tax_claims',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] personal_tax_claims error:', err);
    return c.json({
      success: false,
      agentType: 'personal_tax_claims',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 7. POST /agents/financial-plan — Financial planner
// ---------------------------------------------------------------------------
agentRoutes.post('/agents/financial-plan', async (c) => {
  const check = ensureEnabled('financial_planner');
  if (!check.ok) return c.json(check.body, check.status as 503);

  const body = parseBody(financialPlanSchema, await c.req.json());
  if (!body.ok) return c.json(body.body, body.status as 400);

  const startTime = Date.now();
  console.log('[Agent Route] financial_planner invoked');

  try {
    const result = await orchestrator.invoke('financial_planner', {
      userId: body.data.userId ?? 'anonymous',
      financialYear: body.data.financialYear ?? '2024-25',
      transactions: body.data.transactions ?? [],
      riskProfile: body.data.riskProfile,
      goals: body.data.goals ?? (body.data.goal ? [body.data.goal] : []),
    });
    return c.json({
      success: true,
      agentType: 'financial_planner',
      result,
      usage: result.usage,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[Agent Route] financial_planner error:', err);
    return c.json({
      success: false,
      agentType: 'financial_planner',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    }, 500);
  }
});

// ---------------------------------------------------------------------------
// 8. GET /agents/status — Health/status for all agents
// ---------------------------------------------------------------------------
const ALL_AGENT_TYPES: AgentType[] = [
  'statement_parser', 'transaction_categorizer', 'gst_calculator',
  'account_reconciler', 'budget_analyzer', 'cross_account_tracer',
  'merchant_intelligence', 'payroll_agent', 'tax_strategy',
  'personal_tax_claims', 'financial_planner', 'inventory_agent',
  'bank_reconciler_agent', 'ocr_processing', 'payment_matching',
  'asset_management', 'multi_entity', 'financial_reporting',
  'budgeting', 'forecasting', 'compliance_monitoring',
];

agentRoutes.get('/agents/status', async (c) => {
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

export default agentRoutes;
