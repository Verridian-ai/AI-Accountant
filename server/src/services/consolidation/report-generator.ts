/**
 * Report Generator
 *
 * Consolidated report generation: snapshot detail retrieval,
 * entity-level breakdowns, and consolidation history queries.
 */

import { db } from '../../schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  entities,
  consolidationSnapshots,
  consolidationSnapshotLines,
  type ConsolidationSnapshot,
  type ConsolidationSnapshotLine,
} from './types.js';

/**
 * Get consolidation history for a parent entity, optionally filtered by financial year.
 */
export async function getConsolidationHistory(
  parentEntityId: string,
  userId: string,
  financialYear?: string,
): Promise<{
  snapshots: Array<ConsolidationSnapshot & { lineCount: number }>;
}> {
  const conditions = [
    eq(consolidationSnapshots.parentEntityId, parentEntityId),
    eq(consolidationSnapshots.userId, userId),
  ];

  if (financialYear) {
    conditions.push(eq(consolidationSnapshots.financialYear, financialYear));
  }

  const snapshots = (await db
    .select()
    .from(consolidationSnapshots)
    .where(and(...conditions))
    .orderBy(desc(consolidationSnapshots.createdAt))
    .all()) as ConsolidationSnapshot[];

  // Get line counts for each snapshot
  const enriched = [];
  for (const snap of snapshots) {
    const countResult = (await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(consolidationSnapshotLines)
      .where(eq(consolidationSnapshotLines.snapshotId, snap.id))
      .get()) as any;

    enriched.push({
      ...snap,
      lineCount: countResult?.count ?? 0,
    });
  }

  return { snapshots: enriched };
}

/**
 * Get full detail of a consolidation snapshot including all lines,
 * entity-level breakdowns, and consolidated totals.
 */
export async function getSnapshotDetail(
  snapshotId: string,
  userId: string,
): Promise<{
  snapshot: ConsolidationSnapshot;
  lines: ConsolidationSnapshotLine[];
  byEntity: Record<
    string,
    {
      entityName: string;
      revenue: number;
      expenses: number;
      assets: number;
      liabilities: number;
      equity: number;
    }
  >;
  eliminations: ConsolidationSnapshotLine[];
  consolidatedTotals: {
    revenue: number;
    expenses: number;
    netProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
}> {
  const snapshot = (await db
    .select()
    .from(consolidationSnapshots)
    .where(
      and(eq(consolidationSnapshots.id, snapshotId), eq(consolidationSnapshots.userId, userId)),
    )
    .get()) as ConsolidationSnapshot | undefined;

  if (!snapshot) {
    throw new Error('Consolidation snapshot not found');
  }

  const lines = (await db
    .select()
    .from(consolidationSnapshotLines)
    .where(eq(consolidationSnapshotLines.snapshotId, snapshotId))
    .all()) as ConsolidationSnapshotLine[];

  // Separate elimination lines
  const eliminations = lines.filter((l) => l.isElimination);
  const regularLines = lines.filter((l) => !l.isElimination);

  // Build entity-level breakdown
  const byEntity: Record<
    string,
    {
      entityName: string;
      revenue: number;
      expenses: number;
      assets: number;
      liabilities: number;
      equity: number;
    }
  > = {};

  // Fetch entity names
  const entityIds = [...new Set(regularLines.map((l) => l.entityId))];
  const entityNameMap = new Map<string, string>();
  for (const eid of entityIds) {
    const entity = (await db.select().from(entities).where(eq(entities.id, eid)).get()) as any;
    if (entity) {
      entityNameMap.set(eid, entity.name);
    }
  }

  for (const line of regularLines) {
    if (!byEntity[line.entityId]) {
      byEntity[line.entityId] = {
        entityName: entityNameMap.get(line.entityId) ?? 'Unknown',
        revenue: 0,
        expenses: 0,
        assets: 0,
        liabilities: 0,
        equity: 0,
      };
    }

    const entry = byEntity[line.entityId];
    switch (line.lineType) {
      case 'revenue':
        entry.revenue += line.amount;
        break;
      case 'expense':
        entry.expenses += line.amount;
        break;
      case 'asset':
        entry.assets += line.amount;
        break;
      case 'liability':
        entry.liabilities += line.amount;
        break;
      case 'equity':
        entry.equity += line.amount;
        break;
    }
  }

  // Calculate consolidated totals (entity totals minus eliminations)
  const totals = calculateConsolidatedTotals(lines, eliminations);

  return {
    snapshot,
    lines,
    byEntity,
    eliminations,
    consolidatedTotals: totals,
  };
}

/**
 * Calculate consolidated totals from all lines including elimination adjustments.
 */
function calculateConsolidatedTotals(
  lines: ConsolidationSnapshotLine[],
  eliminations: ConsolidationSnapshotLine[],
): {
  revenue: number;
  expenses: number;
  netProfit: number;
  assets: number;
  liabilities: number;
  equity: number;
} {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const line of lines) {
    switch (line.lineType) {
      case 'revenue':
        totalRevenue += line.amount;
        break;
      case 'expense':
        totalExpenses += line.amount;
        break;
      case 'asset':
        totalAssets += line.amount;
        break;
      case 'liability':
        totalLiabilities += line.amount;
        break;
      case 'equity':
        totalEquity += line.amount;
        break;
      case 'elimination':
        // Elimination amounts are negative offsets -- already signed correctly
        break;
    }
  }

  // Include elimination amounts in totals
  for (const elim of eliminations) {
    // Elimination lines have signed amounts that offset the relevant totals
    if (elim.category.includes('Revenue')) totalRevenue += elim.amount;
    else if (elim.category.includes('Expense')) totalExpenses += elim.amount;
    else if (elim.category.includes('Receivable') || elim.category.includes('Asset'))
      totalAssets += elim.amount;
    else if (elim.category.includes('Payable') || elim.category.includes('Liability'))
      totalLiabilities += elim.amount;
    else if (elim.category.includes('Equity') || elim.category.includes('Dividend'))
      totalEquity += elim.amount;
  }

  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    netProfit: totalRevenue - Math.abs(totalExpenses),
    assets: totalAssets,
    liabilities: totalLiabilities,
    equity: totalEquity,
  };
}
