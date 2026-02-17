/**
 * Consolidation Steps
 *
 * Core consolidation step implementations: transaction aggregation,
 * entity resolution, and snapshot generation.
 */

import { db } from '../../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import {
  entities,
  entityAccounts,
  transactions,
  consolidationSnapshots,
  consolidationSnapshotLines,
  type ConsolidationSnapshot,
  type ConsolidationSnapshotLine,
  getLineTypeForCategory,
} from './types.js';
import { applyEliminations } from './elimination-rules.js';

/**
 * Recursively fetch all descendant entities of a parent.
 */
export async function getDescendantEntities(parentId: string, userId: string): Promise<any[]> {
  const children = (await db
    .select()
    .from(entities)
    .where(and(eq(entities.parentEntityId, parentId), eq(entities.userId, userId)))
    .all()) as any[];

  const descendants = [...children];
  for (const child of children) {
    const grandchildren = await getDescendantEntities(child.id, userId);
    descendants.push(...grandchildren);
  }

  return descendants;
}

/**
 * Generate a consolidation snapshot for a parent entity and its children.
 * Aggregates transactions by category, applies elimination rules, and
 * creates a point-in-time snapshot.
 */
export async function generateConsolidation(params: {
  userId: string;
  parentEntityId: string;
  financialYear: string;
}): Promise<{
  snapshot: ConsolidationSnapshot;
  lines: ConsolidationSnapshotLine[];
  eliminations: Array<{
    ruleId: string;
    ruleName: string;
    amount: number;
    description: string;
  }>;
}> {
  // Verify parent entity is a consolidated parent
  const parentEntity = (await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, params.parentEntityId), eq(entities.userId, params.userId)))
    .get()) as any;

  if (!parentEntity) {
    throw new Error('Parent entity not found');
  }

  if (!parentEntity.isConsolidatedParent) {
    throw new Error('Entity is not marked as a consolidated parent');
  }

  // Recursively find all child entities
  const childEntities = await getDescendantEntities(params.parentEntityId, params.userId);
  const allEntityIds = [params.parentEntityId, ...childEntities.map((e) => e.id)];

  // Calculate FY date range
  const [startYear] = params.financialYear.split('-').map(Number);
  const fyStart = `${startYear}-07-01`;
  const fyEnd = `${startYear + 1}-06-30`;

  // Aggregate transactions by entity and category
  const lines: ConsolidationSnapshotLine[] = [];
  const snapshotId = crypto.randomUUID();

  for (const eid of allEntityIds) {
    await aggregateEntityTransactions(eid, params.userId, fyStart, fyEnd, snapshotId, lines);
  }

  // Apply elimination rules
  const {
    eliminatedLines,
    totalEliminationsAmount: _totalEliminationsAmount,
    eliminationDetails,
  } = await applyEliminations(
    params.parentEntityId,
    snapshotId,
    lines,
    params.userId,
    fyStart,
    fyEnd,
  );

  const allLines = [...lines, ...eliminatedLines];

  // Calculate totals
  const totals = calculateLineTotals(allLines);
  const now = new Date().toISOString();

  // Create snapshot record
  const snapshot: ConsolidationSnapshot = {
    id: snapshotId,
    userId: params.userId,
    parentEntityId: params.parentEntityId,
    financialYear: params.financialYear,
    snapshotDate: now,
    status: 'draft',
    totalRevenue: totals.totalRevenue,
    totalExpenses: totals.totalExpenses,
    totalAssets: totals.totalAssets,
    totalLiabilities: totals.totalLiabilities,
    totalEquity: totals.totalEquity,
    eliminationsApplied: eliminatedLines.length,
    adjustmentsJson: null,
    notes: null,
    createdBy: params.userId,
    createdAt: now,
  };

  await persistSnapshot(snapshot, allLines);

  return {
    snapshot,
    lines: allLines,
    eliminations: eliminationDetails,
  };
}

/**
 * Aggregate transactions for a single entity's linked accounts within the FY.
 */
async function aggregateEntityTransactions(
  entityId: string,
  userId: string,
  fyStart: string,
  fyEnd: string,
  snapshotId: string,
  lines: ConsolidationSnapshotLine[],
): Promise<void> {
  const linkedAccounts = (await db
    .select()
    .from(entityAccounts)
    .where(eq(entityAccounts.entityId, entityId))
    .all()) as any[];

  const accountIds = linkedAccounts.map((a: any) => a.accountId);
  if (accountIds.length === 0) return;

  for (const accountId of accountIds) {
    const txnAggregates = (await db
      .select({
        category: transactions.category,
        totalAmount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.userId, userId),
          sql`${transactions.date} >= ${fyStart}`,
          sql`${transactions.date} <= ${fyEnd}`,
        ),
      )
      .groupBy(transactions.category)
      .all()) as any[];

    for (const agg of txnAggregates) {
      if (!agg.category || agg.totalAmount === 0) continue;

      const lineType = getLineTypeForCategory(agg.category);
      const lineId = crypto.randomUUID();

      lines.push({
        id: lineId,
        snapshotId,
        entityId,
        lineType,
        category: agg.category,
        description: `${agg.category} for entity`,
        amount: agg.totalAmount,
        isElimination: false,
        sourceRuleId: null,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

/**
 * Calculate totals from snapshot lines by line type.
 */
function calculateLineTotals(allLines: ConsolidationSnapshotLine[]): {
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
} {
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const line of allLines) {
    const amt = line.amount;
    switch (line.lineType) {
      case 'revenue':
        totalRevenue += amt;
        break;
      case 'expense':
        totalExpenses += amt;
        break;
      case 'asset':
        totalAssets += amt;
        break;
      case 'liability':
        totalLiabilities += amt;
        break;
      case 'equity':
        totalEquity += amt;
        break;
      case 'elimination':
        // Eliminations reduce the relevant totals -- tracked via amount sign
        break;
      case 'adjustment':
        break;
    }
  }

  return { totalRevenue, totalExpenses, totalAssets, totalLiabilities, totalEquity };
}

/**
 * Persist snapshot and all its lines to the database.
 */
async function persistSnapshot(
  snapshot: ConsolidationSnapshot,
  allLines: ConsolidationSnapshotLine[],
): Promise<void> {
  await db.insert(consolidationSnapshots).values({
    id: snapshot.id,
    userId: snapshot.userId,
    parentEntityId: snapshot.parentEntityId,
    financialYear: snapshot.financialYear,
    snapshotDate: snapshot.snapshotDate,
    status: 'draft',
    totalRevenue: snapshot.totalRevenue,
    totalExpenses: snapshot.totalExpenses,
    totalAssets: snapshot.totalAssets,
    totalLiabilities: snapshot.totalLiabilities,
    totalEquity: snapshot.totalEquity,
    eliminationsApplied: snapshot.eliminationsApplied,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
  });

  for (const line of allLines) {
    await db.insert(consolidationSnapshotLines).values({
      id: line.id,
      snapshotId: line.snapshotId,
      entityId: line.entityId,
      lineType: line.lineType,
      category: line.category,
      description: line.description,
      amount: line.amount,
      isElimination: line.isElimination,
      sourceRuleId: line.sourceRuleId,
      createdAt: line.createdAt,
    });
  }
}
