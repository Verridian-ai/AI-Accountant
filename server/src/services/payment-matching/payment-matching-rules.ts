/**
 * Payment Matching — Rule management (create, list, update, delete)
 */

import { db, paymentMatchRules } from '../../schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { PaymentMatchRule, CreateRuleParams } from './types.js';

export async function createMatchRule(
  userId: string,
  params: CreateRuleParams,
): Promise<PaymentMatchRule> {
  const id = randomUUID();
  if (params.ruleType === 'exact_amount' && params.amountExact == null) {
    throw new Error('exact_amount rule requires amountExact');
  }
  if (
    params.ruleType === 'amount_range' &&
    (params.amountMin == null || params.amountMax == null)
  ) {
    throw new Error('amount_range rule requires amountMin and amountMax');
  }

  await db
    .insert(paymentMatchRules)
    .values({
      id,
      userId,
      name: params.name,
      ruleType: params.ruleType,
      vendorPattern: params.vendorPattern ?? null,
      amountExact: params.amountExact ?? null,
      amountMin: params.amountMin ?? null,
      amountMax: params.amountMax ?? null,
      amountTolerance: params.amountTolerance ?? 0.01,
      dateToleranceDays: params.dateToleranceDays ?? 7,
      categoryFilter: params.categoryFilter ?? null,
      priority: params.priority ?? 100,
      isActive: true,
      matchCount: 0,
    })
    .run();

  return db.select().from(paymentMatchRules).where(eq(paymentMatchRules.id, id)).get();
}

export async function listMatchRules(
  userId: string,
  isActive?: boolean,
): Promise<PaymentMatchRule[]> {
  let query = db.select().from(paymentMatchRules).where(eq(paymentMatchRules.userId, userId));
  if (isActive !== undefined) {
    query = db
      .select()
      .from(paymentMatchRules)
      .where(and(eq(paymentMatchRules.userId, userId), eq(paymentMatchRules.isActive, isActive)));
  }
  return query.orderBy(asc(paymentMatchRules.priority)).all();
}

export async function updateMatchRule(
  ruleId: string,
  updates: Record<string, unknown>,
): Promise<PaymentMatchRule> {
  const allowedFields: Partial<PaymentMatchRule> = {};
  const safeKeys = [
    'name',
    'ruleType',
    'vendorPattern',
    'amountExact',
    'amountMin',
    'amountMax',
    'amountTolerance',
    'dateToleranceDays',
    'categoryFilter',
    'priority',
    'isActive',
  ];
  for (const key of safeKeys) {
    if (key in updates) {
      (allowedFields as Record<string, unknown>)[key] = updates[key];
    }
  }
  if (Object.keys(allowedFields).length > 0) {
    await db
      .update(paymentMatchRules)
      .set(allowedFields)
      .where(eq(paymentMatchRules.id, ruleId))
      .run();
  }
  return db.select().from(paymentMatchRules).where(eq(paymentMatchRules.id, ruleId)).get();
}

export async function deleteMatchRule(ruleId: string): Promise<void> {
  await db.delete(paymentMatchRules).where(eq(paymentMatchRules.id, ruleId)).run();
}
