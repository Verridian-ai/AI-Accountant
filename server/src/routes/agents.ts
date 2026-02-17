/**
 * Agent Routes
 *
 * Hono routes for explicit Claude agent invocations.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { orchestrator } from '../services/claude/orchestrator.js';
import { db, transactions } from '../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getQuarterDates } from '../services/bas.js';

const agents = new Hono();

const analyzeSchema = z.object({
  query: z.string().min(1),
  accountIds: z.array(z.unknown()).optional(),
  dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
});

const basCalculateSchema = z.object({
  quarter: z.object({ year: z.number().int(), quarter: z.number().int().min(1).max(4) }),
  accountId: z.unknown().optional(),
  userId: z.string().optional(),
});

const reconcileSchema = z.object({
  accountId: z.unknown(),
  statementIds: z.array(z.unknown()).optional(),
});

const transfersAnalyzeSchema = z.object({
  accountIds: z.array(z.unknown()),
  dateRange: z.object({ start: z.string(), end: z.string() }).optional(),
});

/**
 * POST /api/agents/analyze
 * General analysis query using BudgetAnalyzer agent.
 */
agents.post('/analyze', zValidator('json', analyzeSchema), async (c) => {
  try {
    const { query, accountIds, dateRange } = c.req.valid('json');

    if (!orchestrator.isEnabled()) {
      return c.json({ error: 'Claude agents are not enabled' }, 503);
    }

    const result = await orchestrator.analyze(query, {
      accountIds: accountIds as number[] | undefined,
      dateRange,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] Analyze error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, 500);
  }
});

/**
 * POST /api/agents/bas/calculate
 * BAS calculation for a quarter using GSTCalculator agent.
 */
agents.post('/bas/calculate', zValidator('json', basCalculateSchema), async (c) => {
  try {
    const { quarter, accountId, userId } = c.req.valid('json');

    if (!orchestrator.isEnabled()) {
      return c.json({ error: 'Claude agents are not enabled' }, 503);
    }

    if (!quarter?.year || !quarter?.quarter) {
      return c.json({ error: 'quarter.year and quarter.quarter required' }, 400);
    }

    // Get transactions for the quarter
    const fy = `${quarter.year}-${(quarter.year + 1).toString().slice(2)}`;
    const dates = getQuarterDates(fy, quarter.quarter as 1 | 2 | 3 | 4);

    const conditions = [
      gte(transactions.date, dates.startDate),
      lte(transactions.date, dates.endDate),
    ];
    if (userId) {
      conditions.push(eq(transactions.userId, userId));
    }
    if (accountId) {
      conditions.push(eq(transactions.accountId, String(accountId)));
    }

    const quarterTxs = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .all();

    const result = await orchestrator.invoke('gst_calculator', {
      transactions: quarterTxs.map((tx: any) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category || undefined,
        gstCategory: tx.gstCategory || undefined,
      })),
      quarter: { year: quarter.year, quarter: quarter.quarter as 1 | 2 | 3 | 4 },
      accountId: accountId ? (accountId as number) : undefined,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] BAS calculate error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'BAS calculation failed' }, 500);
  }
});

/**
 * POST /api/agents/reconcile
 * Account reconciliation using AccountReconciler agent.
 */
agents.post('/reconcile', zValidator('json', reconcileSchema), async (c) => {
  try {
    const { accountId, statementIds } = c.req.valid('json');

    if (!orchestrator.isEnabled()) {
      return c.json({ error: 'Claude agents are not enabled' }, 503);
    }

    if (!accountId) {
      return c.json({ error: 'accountId required' }, 400);
    }

    const result = await orchestrator.invoke('account_reconciler', {
      accountId: accountId as number,
      statementIds: (statementIds || []) as number[],
      includeTransferDetection: true,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] Reconcile error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Reconciliation failed' }, 500);
  }
});

/**
 * POST /api/agents/transfers/analyze
 * Cross-account transfer analysis using CrossAccountTracer agent.
 */
agents.post('/transfers/analyze', zValidator('json', transfersAnalyzeSchema), async (c) => {
  try {
    const { accountIds, dateRange } = c.req.valid('json');

    if (!orchestrator.isEnabled()) {
      return c.json({ error: 'Claude agents are not enabled' }, 503);
    }

    if (!accountIds || !Array.isArray(accountIds)) {
      return c.json({ error: 'accountIds array required' }, 400);
    }

    const result = await orchestrator.invoke('cross_account_tracer', {
      accountIds: accountIds as number[],
      dateRange,
      includeFlowDiagram: true,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] Transfer analysis error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Transfer analysis failed' }, 500);
  }
});

export default agents;
