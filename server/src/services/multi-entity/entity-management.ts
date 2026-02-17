/**
 * Multi-Entity — Entity and Account Management
 */

import { db } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { entities, entityAccounts, entitySettings, accounts } from './tables.js';
import type { Entity, EntityAccount, EntitySetting, EntityType, AccountRole } from './types.js';
import { validateABN, validateACN } from './types.js';

function getDefaultSettings(entityType: EntityType): {
  gstRegistered: boolean;
  taxRate: number;
  basFrequency: string;
} {
  switch (entityType) {
    case 'company':
      return { gstRegistered: true, taxRate: 0.25, basFrequency: 'quarterly' };
    case 'trust':
      return { gstRegistered: false, taxRate: 0, basFrequency: 'annually' };
    case 'sole_trader':
      return { gstRegistered: false, taxRate: 0, basFrequency: 'quarterly' };
    case 'partnership':
      return { gstRegistered: false, taxRate: 0, basFrequency: 'quarterly' };
    case 'smsf':
      return { gstRegistered: false, taxRate: 0.15, basFrequency: 'annually' };
    case 'individual':
      return { gstRegistered: false, taxRate: 0, basFrequency: 'annually' };
    default:
      return { gstRegistered: false, taxRate: 0, basFrequency: 'quarterly' };
  }
}

export async function createEntity(params: {
  userId: string;
  name: string;
  entityType: EntityType;
  abn?: string;
  acn?: string;
  tfn?: string;
  parentEntityId?: string;
  financialYearEnd?: string;
  address?: string;
  contactEmail?: string;
}): Promise<Entity> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  if (params.abn && !validateABN(params.abn))
    throw new Error('Invalid ABN format: must be 11 digits');
  if (params.acn && !validateACN(params.acn))
    throw new Error('Invalid ACN format: must be 9 digits');

  if (params.parentEntityId) {
    const parent = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, params.parentEntityId), eq(entities.userId, params.userId)))
      .get();
    if (!parent) throw new Error('Parent entity not found or does not belong to this user');
  }

  await db.insert(entities).values({
    id,
    userId: params.userId,
    name: params.name,
    entityType: params.entityType,
    abn: params.abn ?? null,
    acn: params.acn ?? null,
    tfn: params.tfn ?? null,
    parentEntityId: params.parentEntityId ?? null,
    isConsolidatedParent: false,
    financialYearEnd: params.financialYearEnd ?? '06-30',
    reportingCurrency: 'AUD',
    status: 'active',
    address: params.address ?? null,
    contactEmail: params.contactEmail ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const defaults = getDefaultSettings(params.entityType);
  await db.insert(entitySettings).values({
    id: crypto.randomUUID(),
    entityId: id,
    basReportingFrequency: defaults.basFrequency,
    gstRegistered: defaults.gstRegistered,
    gstMethod: 'cash',
    taxRate: defaults.taxRate,
    defaultDepreciationMethod: 'diminishing_value',
    instantWriteOffThreshold: 2000000,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    userId: params.userId,
    name: params.name,
    entityType: params.entityType,
    abn: params.abn ?? null,
    acn: params.acn ?? null,
    tfn: params.tfn ?? null,
    parentEntityId: params.parentEntityId ?? null,
    isConsolidatedParent: false,
    financialYearEnd: params.financialYearEnd ?? '06-30',
    reportingCurrency: 'AUD',
    status: 'active',
    address: params.address ?? null,
    contactEmail: params.contactEmail ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateEntity(
  entityId: string,
  userId: string,
  updates: Partial<{
    name: string;
    abn: string;
    acn: string;
    status: string;
    address: string;
    contactEmail: string;
    isConsolidatedParent: boolean;
  }>,
): Promise<Entity> {
  if (updates.abn && !validateABN(updates.abn))
    throw new Error('Invalid ABN format: must be 11 digits');
  if (updates.acn && !validateACN(updates.acn))
    throw new Error('Invalid ACN format: must be 9 digits');
  const now = new Date().toISOString();
  await db
    .update(entities)
    .set({ ...updates, updatedAt: now })
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)));
  const updated = await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
    .get();
  if (!updated) throw new Error('Entity not found');
  return updated as Entity;
}

export async function linkAccount(params: {
  entityId: string;
  accountId: string;
  role: AccountRole;
  ownershipPercentage?: number;
}): Promise<EntityAccount> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const entity = await db.select().from(entities).where(eq(entities.id, params.entityId)).get();
  if (!entity) throw new Error('Entity not found');
  const account = await db.select().from(accounts).where(eq(accounts.id, params.accountId)).get();
  if (!account) throw new Error('Account not found');
  const existing = await db
    .select()
    .from(entityAccounts)
    .where(
      and(
        eq(entityAccounts.entityId, params.entityId),
        eq(entityAccounts.accountId, params.accountId),
      ),
    )
    .get();
  if (existing) throw new Error('Account is already linked to this entity');
  await db
    .insert(entityAccounts)
    .values({
      id,
      entityId: params.entityId,
      accountId: params.accountId,
      role: params.role,
      ownershipPercentage: params.ownershipPercentage ?? 100.0,
      linkedAt: now,
    });
  return {
    id,
    entityId: params.entityId,
    accountId: params.accountId,
    role: params.role,
    ownershipPercentage: params.ownershipPercentage ?? 100.0,
    linkedAt: now,
  };
}

export async function unlinkAccount(entityId: string, accountId: string): Promise<void> {
  await db
    .delete(entityAccounts)
    .where(and(eq(entityAccounts.entityId, entityId), eq(entityAccounts.accountId, accountId)));
}

export async function updateEntitySettings(
  entityId: string,
  settings: Partial<{
    basReportingFrequency: 'monthly' | 'quarterly' | 'annually';
    gstRegistered: boolean;
    gstMethod: 'cash' | 'accrual';
    taxRate: number;
    defaultDepreciationMethod: string;
    instantWriteOffThreshold: number;
    chartOfAccountsTemplate: string;
  }>,
): Promise<EntitySetting> {
  if (settings.taxRate !== undefined && (settings.taxRate < 0 || settings.taxRate > 1))
    throw new Error('Tax rate must be between 0 and 1');
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(entitySettings)
    .where(eq(entitySettings.entityId, entityId))
    .get();
  if (existing) {
    await db
      .update(entitySettings)
      .set({ ...settings, updatedAt: now })
      .where(eq(entitySettings.entityId, entityId));
  } else {
    await db
      .insert(entitySettings)
      .values({ id: crypto.randomUUID(), entityId, ...settings, createdAt: now, updatedAt: now });
  }
  return (await db
    .select()
    .from(entitySettings)
    .where(eq(entitySettings.entityId, entityId))
    .get()) as EntitySetting;
}
