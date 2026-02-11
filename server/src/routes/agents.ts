/**
 * Agent Routes
 *
 * Hono routes for explicit Claude agent invocations.
 */

import { Hono } from 'hono';
import { orchestrator } from '../services/claude/orchestrator.js';
import { db, transactions } from '../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getQuarterDates } from '../services/bas.js';

const agents = new Hono();

/**
 * POST /api/agents/analyze
 * General analysis query using BudgetAnalyzer agent.
 */
agents.post('/analyze', async (c) => {
  try {
    const { query, accountIds, dateRange } = await c.req.json();

    if (!orchestrator.isEnabled()) {
      return c.json(
        { error: 'Claude agents are not enabled' },
        503
      );
    }

    const result = await orchestrator.analyze(query, {
      accountIds,
      dateRange,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] Analyze error:', err);
    return c.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      500
    );
  }
});

/**
 * POST /api/agents/bas/calculate
 * BAS calculation for a quarter using GSTCalculator agent.
 */
agents.post('/bas/calculate', async (c) => {
  try {
    const { quarter, accountId, userId } = await c.req.json();

    if (!orchestrator.isEnabled()) {
      return c.json(
        { error: 'Claude agents are not enabled' },
        503
      );
    }

    if (!quarter?.year || !quarter?.quarter) {
      return c.json({ error: 'quarter.year and quarter.quarter required' }, 400);
    }

    // Get transactions for the quarter
    const fy = `${quarter.year}-${(quarter.year + 1).toString().slice(2)}`;
    const dates = getQuarterDates(fy, quarter.quarter);

    const conditions = [
      gte(transactions.date, dates.startDate),
      lte(transactions.date, dates.endDate),
    ];
    if (userId) {
      conditions.push(eq(transactions.userId, userId));
    }
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
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
      quarter: { year: quarter.year, quarter: quarter.quarter },
      accountId: accountId || undefined,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] BAS calculate error:', err);
    return c.json(
      { error: err instanceof Error ? err.message : 'BAS calculation failed' },
      500
    );
  }
});

/**
 * POST /api/agents/reconcile
 * Account reconciliation using AccountReconciler agent.
 */
agents.post('/reconcile', async (c) => {
  try {
    const { accountId, statementIds } = await c.req.json();

    if (!orchestrator.isEnabled()) {
      return c.json(
        { error: 'Claude agents are not enabled' },
        503
      );
    }

    if (!accountId) {
      return c.json({ error: 'accountId required' }, 400);
    }

    const result = await orchestrator.invoke('account_reconciler', {
      accountId,
      statementIds: statementIds || [],
      includeTransferDetection: true,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] Reconcile error:', err);
    return c.json(
      { error: err instanceof Error ? err.message : 'Reconciliation failed' },
      500
    );
  }
});

/**
 * POST /api/agents/transfers/analyze
 * Cross-account transfer analysis using CrossAccountTracer agent.
 */
agents.post('/transfers/analyze', async (c) => {
  try {
    const { accountIds, dateRange } = await c.req.json();

    if (!orchestrator.isEnabled()) {
      return c.json(
        { error: 'Claude agents are not enabled' },
        503
      );
    }

    if (!accountIds || !Array.isArray(accountIds)) {
      return c.json({ error: 'accountIds array required' }, 400);
    }

    const result = await orchestrator.invoke('cross_account_tracer', {
      accountIds,
      dateRange,
      includeFlowDiagram: true,
    });

    return c.json(result);
  } catch (err) {
    console.error('[Agents] Transfer analysis error:', err);
    return c.json(
      { error: err instanceof Error ? err.message : 'Transfer analysis failed' },
      500
    );
  }
});

export default agents;
