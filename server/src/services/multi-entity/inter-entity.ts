/**
 * Multi-Entity — Inter-Entity Transactions
 */

import { db } from '../../schema.js';
import { eq, and, sql, or } from 'drizzle-orm';
import crypto from 'crypto';
import { entities, interEntityTransactions } from './tables.js';
import type { InterEntityTransaction, InterEntityTransactionType } from './types.js';

export async function recordInterEntityTransaction(params: {
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  fromTransactionId?: string;
  toTransactionId?: string;
  amount: number;
  description: string;
  transactionDate: string;
  transactionType: InterEntityTransactionType;
  notes?: string;
}): Promise<InterEntityTransaction> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (params.fromEntityId === params.toEntityId)
    throw new Error('From and To entities must be different');
  const fromEntity = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, params.fromEntityId), eq(entities.userId, params.userId)))
    .get();
  if (!fromEntity) throw new Error('Source entity not found or does not belong to this user');
  const toEntity = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, params.toEntityId), eq(entities.userId, params.userId)))
    .get();
  if (!toEntity) throw new Error('Destination entity not found or does not belong to this user');
  await db.insert(interEntityTransactions).values({
    id,
    userId: params.userId,
    fromEntityId: params.fromEntityId,
    toEntityId: params.toEntityId,
    fromTransactionId: params.fromTransactionId ?? null,
    toTransactionId: params.toTransactionId ?? null,
    amount: params.amount,
    description: params.description,
    transactionDate: params.transactionDate,
    transactionType: params.transactionType,
    status: 'pending',
    confirmedByFrom: false,
    confirmedByTo: false,
    notes: params.notes ?? null,
    createdAt: now,
  });
  return {
    id,
    userId: params.userId,
    fromEntityId: params.fromEntityId,
    toEntityId: params.toEntityId,
    fromTransactionId: params.fromTransactionId ?? null,
    toTransactionId: params.toTransactionId ?? null,
    amount: params.amount,
    description: params.description,
    transactionDate: params.transactionDate,
    transactionType: params.transactionType as InterEntityTransactionType,
    status: 'pending',
    confirmedByFrom: false,
    confirmedByTo: false,
    eliminationGroupId: null,
    notes: params.notes ?? null,
    createdAt: now,
  };
}

export async function confirmInterEntityTransaction(
  transactionId: string,
  entityId: string,
  confirmed: boolean,
): Promise<InterEntityTransaction> {
  const txn = (await db
    .select()
    .from(interEntityTransactions)
    .where(eq(interEntityTransactions.id, transactionId))
    .get()) as InterEntityTransaction | undefined;
  if (!txn) throw new Error('Inter-entity transaction not found');
  const update: Record<string, any> = {};
  if (entityId === txn.fromEntityId) update.confirmedByFrom = confirmed;
  else if (entityId === txn.toEntityId) update.confirmedByTo = confirmed;
  else throw new Error('Entity is not a party to this transaction');
  const newFromConfirmed = entityId === txn.fromEntityId ? confirmed : txn.confirmedByFrom;
  const newToConfirmed = entityId === txn.toEntityId ? confirmed : txn.confirmedByTo;
  if (!confirmed) update.status = 'disputed';
  else if (newFromConfirmed && newToConfirmed) update.status = 'confirmed';
  await db
    .update(interEntityTransactions)
    .set(update)
    .where(eq(interEntityTransactions.id, transactionId));
  return (await db
    .select()
    .from(interEntityTransactions)
    .where(eq(interEntityTransactions.id, transactionId))
    .get()) as InterEntityTransaction;
}

export async function getInterEntityTransactions(
  userId: string,
  filters?: {
    entityId?: string;
    status?: string;
    financialYear?: string;
    transactionType?: string;
  },
): Promise<InterEntityTransaction[]> {
  const conditions = [eq(interEntityTransactions.userId, userId)];
  if (filters?.entityId) {
    conditions.push(
      or(
        eq(interEntityTransactions.fromEntityId, filters.entityId),
        eq(interEntityTransactions.toEntityId, filters.entityId),
      )!,
    );
  }
  if (filters?.status) conditions.push(eq(interEntityTransactions.status, filters.status));
  if (filters?.transactionType)
    conditions.push(eq(interEntityTransactions.transactionType, filters.transactionType));
  if (filters?.financialYear) {
    const [startYear] = filters.financialYear.split('-').map(Number);
    const fyStart = `${startYear}-07-01`;
    const fyEnd = `${startYear + 1}-06-30`;
    conditions.push(sql`${interEntityTransactions.transactionDate} >= ${fyStart}`);
    conditions.push(sql`${interEntityTransactions.transactionDate} <= ${fyEnd}`);
  }
  return (await db
    .select()
    .from(interEntityTransactions)
    .where(and(...conditions))
    .all()) as InterEntityTransaction[];
}
