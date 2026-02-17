/**
 * Rule Management
 *
 * CRUD operations for consolidation rules and snapshot finalization.
 */

import { db } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import {
  consolidationRules,
  consolidationSnapshots,
  type ConsolidationRule,
  type ConsolidationSnapshot,
  type RuleCriteria,
  type RuleAction,
} from './types.js';

/**
 * Create a new consolidation rule.
 */
export async function createConsolidationRule(params: {
  userId: string;
  parentEntityId: string;
  ruleName: string;
  ruleType: 'elimination' | 'adjustment' | 'reclassification' | 'minority_interest';
  description?: string;
  criteria: RuleCriteria;
  action: RuleAction;
  priority?: number;
}): Promise<ConsolidationRule> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const rule: ConsolidationRule = {
    id,
    userId: params.userId,
    parentEntityId: params.parentEntityId,
    ruleName: params.ruleName,
    ruleType: params.ruleType,
    description: params.description ?? null,
    criteriaJson: JSON.stringify(params.criteria),
    actionJson: JSON.stringify(params.action),
    isActive: true,
    priority: params.priority ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(consolidationRules).values({
    id: rule.id,
    userId: rule.userId,
    parentEntityId: rule.parentEntityId,
    ruleName: rule.ruleName,
    ruleType: rule.ruleType,
    description: rule.description,
    criteriaJson: rule.criteriaJson,
    actionJson: rule.actionJson,
    isActive: true,
    priority: rule.priority,
    createdAt: now,
    updatedAt: now,
  });

  return rule;
}

/**
 * Partial update of a consolidation rule. Re-serializes JSON fields if changed.
 */
export async function updateConsolidationRule(
  ruleId: string,
  userId: string,
  updates: Partial<{
    ruleName: string;
    description: string;
    criteria: RuleCriteria;
    action: RuleAction;
    priority: number;
    isActive: boolean;
  }>,
): Promise<ConsolidationRule> {
  const now = new Date().toISOString();
  const setValues: Record<string, any> = { updatedAt: now };

  if (updates.ruleName !== undefined) setValues.ruleName = updates.ruleName;
  if (updates.description !== undefined) setValues.description = updates.description;
  if (updates.criteria !== undefined) setValues.criteriaJson = JSON.stringify(updates.criteria);
  if (updates.action !== undefined) setValues.actionJson = JSON.stringify(updates.action);
  if (updates.priority !== undefined) setValues.priority = updates.priority;
  if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

  await db
    .update(consolidationRules)
    .set(setValues)
    .where(and(eq(consolidationRules.id, ruleId), eq(consolidationRules.userId, userId)));

  const updated = (await db
    .select()
    .from(consolidationRules)
    .where(eq(consolidationRules.id, ruleId))
    .get()) as ConsolidationRule;

  if (!updated) {
    throw new Error('Consolidation rule not found');
  }

  return updated;
}

/**
 * Soft-delete a consolidation rule by setting isActive=false.
 */
export async function deleteConsolidationRule(ruleId: string, userId: string): Promise<void> {
  await db
    .update(consolidationRules)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(and(eq(consolidationRules.id, ruleId), eq(consolidationRules.userId, userId)));
}

/**
 * Finalize a consolidation snapshot. Prevents further modifications.
 */
export async function finalizeSnapshot(
  snapshotId: string,
  userId: string,
): Promise<ConsolidationSnapshot> {
  const existing = (await db
    .select()
    .from(consolidationSnapshots)
    .where(
      and(eq(consolidationSnapshots.id, snapshotId), eq(consolidationSnapshots.userId, userId)),
    )
    .get()) as ConsolidationSnapshot | undefined;

  if (!existing) {
    throw new Error('Consolidation snapshot not found');
  }

  if (existing.status === 'finalized') {
    throw new Error('Snapshot is already finalized');
  }

  await db
    .update(consolidationSnapshots)
    .set({ status: 'finalized' })
    .where(eq(consolidationSnapshots.id, snapshotId));

  return { ...existing, status: 'finalized' };
}
