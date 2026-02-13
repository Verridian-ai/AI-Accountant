/**
 * Multi-Entity Service
 *
 * Manages entity hierarchy (companies, trusts, sole traders, etc.),
 * account linking, entity settings, and inter-entity transactions.
 * Supports Australian multi-entity group structures.
 */

import { db } from '../schema.js';
import { eq, and, sql, or } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import crypto from 'crypto';

// ============================================================================
// LOCAL TABLE DEFINITIONS
// (Mirrors schema.ts definitions added by Agent 1 — will be replaced with
//  imports once schema.ts is updated)
// ============================================================================

const entities = sqliteTable('entities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  entityType: text('entity_type').notNull(),
  abn: text('abn'),
  acn: text('acn'),
  tfn: text('tfn'),
  parentEntityId: text('parent_entity_id'),
  isConsolidatedParent: integer('is_consolidated_parent', { mode: 'boolean' }).default(false),
  financialYearEnd: text('financial_year_end').default('06-30'),
  reportingCurrency: text('reporting_currency').default('AUD'),
  status: text('status').default('active'),
  address: text('address'),
  contactEmail: text('contact_email'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

const entityAccounts = sqliteTable('entity_accounts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  accountId: text('account_id').notNull(),
  role: text('role').notNull().default('operating'),
  ownershipPercentage: real('ownership_percentage').default(100.0),
  linkedAt: text('linked_at').default('CURRENT_TIMESTAMP'),
});

const entitySettings = sqliteTable('entity_settings', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  basReportingFrequency: text('bas_reporting_frequency').default('quarterly'),
  gstRegistered: integer('gst_registered', { mode: 'boolean' }).default(false),
  gstMethod: text('gst_method').default('cash'),
  taxRate: real('tax_rate'),
  lodgementDueDates: text('lodgement_due_dates'),
  defaultDepreciationMethod: text('default_depreciation_method').default('diminishing_value'),
  instantWriteOffThreshold: integer('instant_write_off_threshold').default(2000000),
  chartOfAccountsTemplate: text('chart_of_accounts_template'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

const interEntityTransactions = sqliteTable('inter_entity_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromEntityId: text('from_entity_id').notNull(),
  toEntityId: text('to_entity_id').notNull(),
  fromTransactionId: text('from_transaction_id'),
  toTransactionId: text('to_transaction_id'),
  amount: integer('amount').notNull(),
  description: text('description'),
  transactionDate: text('transaction_date').notNull(),
  transactionType: text('transaction_type').notNull(),
  status: text('status').default('pending'),
  confirmedByFrom: integer('confirmed_by_from', { mode: 'boolean' }).default(false),
  confirmedByTo: integer('confirmed_by_to', { mode: 'boolean' }).default(false),
  eliminationGroupId: text('elimination_group_id'),
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  accountNumber: text('account_number').notNull(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(),
  bankName: text('bank_name'),
  currentBalance: integer('current_balance').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

// ============================================================================
// TYPES
// ============================================================================

export type EntityType =
  | 'sole_trader'
  | 'company'
  | 'trust'
  | 'partnership'
  | 'smsf'
  | 'individual';
export type AccountRole =
  | 'operating'
  | 'savings'
  | 'loan'
  | 'offset'
  | 'credit_card'
  | 'investment'
  | 'trust'
  | 'super';
export type InterEntityTransactionType =
  | 'loan'
  | 'management_fee'
  | 'dividend'
  | 'distribution'
  | 'rent'
  | 'service_fee'
  | 'asset_transfer'
  | 'capital_contribution';
export type InterEntityStatus = 'pending' | 'confirmed' | 'eliminated' | 'disputed';

export interface Entity {
  id: string;
  userId: string;
  name: string;
  entityType: EntityType;
  abn: string | null;
  acn: string | null;
  tfn: string | null;
  parentEntityId: string | null;
  isConsolidatedParent: boolean;
  financialYearEnd: string;
  reportingCurrency: string;
  status: string;
  address: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntityAccount {
  id: string;
  entityId: string;
  accountId: string;
  role: AccountRole;
  ownershipPercentage: number;
  linkedAt: string;
}

export interface EntitySetting {
  id: string;
  entityId: string;
  basReportingFrequency: string;
  gstRegistered: boolean;
  gstMethod: string;
  taxRate: number | null;
  lodgementDueDates: string | null;
  defaultDepreciationMethod: string;
  instantWriteOffThreshold: number;
  chartOfAccountsTemplate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterEntityTransaction {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  fromTransactionId: string | null;
  toTransactionId: string | null;
  amount: number;
  description: string | null;
  transactionDate: string;
  transactionType: InterEntityTransactionType;
  status: InterEntityStatus;
  confirmedByFrom: boolean;
  confirmedByTo: boolean;
  eliminationGroupId: string | null;
  notes: string | null;
  createdAt: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateABN(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, '');
  return /^\d{11}$/.test(cleaned);
}

function validateACN(acn: string): boolean {
  const cleaned = acn.replace(/\s/g, '');
  return /^\d{9}$/.test(cleaned);
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class MultiEntityService {
  /**
   * Create a new entity with default settings based on entity type.
   */
  async createEntity(params: {
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

    // Validate ABN format if provided
    if (params.abn && !validateABN(params.abn)) {
      throw new Error('Invalid ABN format: must be 11 digits');
    }

    // Validate ACN format if provided
    if (params.acn && !validateACN(params.acn)) {
      throw new Error('Invalid ACN format: must be 9 digits');
    }

    // Verify parent entity exists and belongs to same user
    if (params.parentEntityId) {
      const parent = await db
        .select()
        .from(entities)
        .where(and(eq(entities.id, params.parentEntityId), eq(entities.userId, params.userId)))
        .get();

      if (!parent) {
        throw new Error('Parent entity not found or does not belong to this user');
      }
    }

    // Insert entity
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

    // Create default entity settings based on entity type
    const settingsId = crypto.randomUUID();
    const defaults = this.getDefaultSettings(params.entityType);

    await db.insert(entitySettings).values({
      id: settingsId,
      entityId: id,
      basReportingFrequency: defaults.basFrequency,
      gstRegistered: defaults.gstRegistered,
      gstMethod: 'cash',
      taxRate: defaults.taxRate,
      defaultDepreciationMethod: 'diminishing_value',
      instantWriteOffThreshold: 2000000, // $20,000 in cents
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

  /**
   * Update mutable fields of an entity. Cannot change entityType.
   */
  async updateEntity(
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
    if (updates.abn && !validateABN(updates.abn)) {
      throw new Error('Invalid ABN format: must be 11 digits');
    }
    if (updates.acn && !validateACN(updates.acn)) {
      throw new Error('Invalid ACN format: must be 9 digits');
    }

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

    if (!updated) {
      throw new Error('Entity not found');
    }

    return updated as Entity;
  }

  /**
   * Link a bank account to an entity with a given role.
   */
  async linkAccount(params: {
    entityId: string;
    accountId: string;
    role: AccountRole;
    ownershipPercentage?: number;
  }): Promise<EntityAccount> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Verify entity exists
    const entity = await db.select().from(entities).where(eq(entities.id, params.entityId)).get();

    if (!entity) {
      throw new Error('Entity not found');
    }

    // Verify account exists
    const account = await db.select().from(accounts).where(eq(accounts.id, params.accountId)).get();

    if (!account) {
      throw new Error('Account not found');
    }

    // Check for duplicate link
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

    if (existing) {
      throw new Error('Account is already linked to this entity');
    }

    await db.insert(entityAccounts).values({
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

  /**
   * Unlink an account from an entity. Does not delete the account itself.
   */
  async unlinkAccount(entityId: string, accountId: string): Promise<void> {
    await db
      .delete(entityAccounts)
      .where(and(eq(entityAccounts.entityId, entityId), eq(entityAccounts.accountId, accountId)));
  }

  /**
   * Build the full entity hierarchy for a user, including accounts, settings, and parent-child relationships.
   */
  async getEntityHierarchy(userId: string): Promise<{
    entities: Array<
      Entity & {
        accounts: EntityAccount[];
        settings: EntitySetting | null;
        children: Entity[];
        parentName?: string;
      }
    >;
    rootEntities: Entity[];
    totalEntities: number;
  }> {
    // Fetch all entities for user
    const allEntities = (await db
      .select()
      .from(entities)
      .where(eq(entities.userId, userId))
      .all()) as Entity[];

    // Fetch all entity accounts for user's entities
    const entityIds = allEntities.map((e) => e.id);
    let allEntityAccounts: EntityAccount[] = [];
    if (entityIds.length > 0) {
      // Batch fetch accounts for all entities
      for (const eid of entityIds) {
        const accts = (await db
          .select()
          .from(entityAccounts)
          .where(eq(entityAccounts.entityId, eid))
          .all()) as EntityAccount[];
        allEntityAccounts.push(...accts);
      }
    }

    // Fetch all entity settings
    let allSettings: EntitySetting[] = [];
    for (const eid of entityIds) {
      const setting = (await db
        .select()
        .from(entitySettings)
        .where(eq(entitySettings.entityId, eid))
        .get()) as EntitySetting | undefined;
      if (setting) allSettings.push(setting);
    }

    // Build lookup maps
    const entityMap = new Map(allEntities.map((e) => [e.id, e]));
    const accountsByEntity = new Map<string, EntityAccount[]>();
    for (const ea of allEntityAccounts) {
      const existing = accountsByEntity.get(ea.entityId) ?? [];
      existing.push(ea);
      accountsByEntity.set(ea.entityId, existing);
    }
    const settingsByEntity = new Map(allSettings.map((s) => [s.entityId, s]));

    // Build hierarchy
    const childrenByParent = new Map<string, Entity[]>();
    for (const entity of allEntities) {
      if (entity.parentEntityId) {
        const children = childrenByParent.get(entity.parentEntityId) ?? [];
        children.push(entity);
        childrenByParent.set(entity.parentEntityId, children);
      }
    }

    const rootEntities = allEntities.filter((e) => !e.parentEntityId);

    const enrichedEntities = allEntities.map((entity) => ({
      ...entity,
      accounts: accountsByEntity.get(entity.id) ?? [],
      settings: settingsByEntity.get(entity.id) ?? null,
      children: childrenByParent.get(entity.id) ?? [],
      parentName: entity.parentEntityId ? entityMap.get(entity.parentEntityId)?.name : undefined,
    }));

    return {
      entities: enrichedEntities,
      rootEntities,
      totalEntities: allEntities.length,
    };
  }

  /**
   * Get a single entity with its accounts (including full account details), settings,
   * parent, and children.
   */
  async getEntityWithAccounts(
    entityId: string,
    userId: string,
  ): Promise<{
    entity: Entity;
    settings: EntitySetting | null;
    accounts: Array<EntityAccount & { accountDetails: any }>;
    parent?: Entity;
    children: Entity[];
  }> {
    const entity = (await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
      .get()) as Entity | undefined;

    if (!entity) {
      throw new Error('Entity not found');
    }

    // Get settings
    const settings = (await db
      .select()
      .from(entitySettings)
      .where(eq(entitySettings.entityId, entityId))
      .get()) as EntitySetting | undefined;

    // Get linked accounts with full account details
    const linkedAccounts = (await db
      .select()
      .from(entityAccounts)
      .where(eq(entityAccounts.entityId, entityId))
      .all()) as EntityAccount[];

    const enrichedAccounts = [];
    for (const ea of linkedAccounts) {
      const accountDetails = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, ea.accountId))
        .get();

      enrichedAccounts.push({
        ...ea,
        accountDetails: accountDetails ?? null,
      });
    }

    // Get parent
    let parent: Entity | undefined;
    if (entity.parentEntityId) {
      parent = (await db
        .select()
        .from(entities)
        .where(eq(entities.id, entity.parentEntityId))
        .get()) as Entity | undefined;
    }

    // Get children
    const children = (await db
      .select()
      .from(entities)
      .where(and(eq(entities.parentEntityId, entityId), eq(entities.userId, userId)))
      .all()) as Entity[];

    return {
      entity,
      settings: settings ?? null,
      accounts: enrichedAccounts,
      parent,
      children,
    };
  }

  /**
   * Upsert entity settings. Validates taxRate is between 0 and 1.
   */
  async updateEntitySettings(
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
    if (settings.taxRate !== undefined && (settings.taxRate < 0 || settings.taxRate > 1)) {
      throw new Error('Tax rate must be between 0 and 1');
    }

    const now = new Date().toISOString();

    // Check if settings already exist
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
      const id = crypto.randomUUID();
      await db.insert(entitySettings).values({
        id,
        entityId,
        ...settings,
        createdAt: now,
        updatedAt: now,
      });
    }

    const updated = (await db
      .select()
      .from(entitySettings)
      .where(eq(entitySettings.entityId, entityId))
      .get()) as EntitySetting;

    return updated;
  }

  /**
   * Record a new inter-entity transaction between two entities.
   * Both entities must exist and belong to the same user.
   */
  async recordInterEntityTransaction(params: {
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

    if (params.fromEntityId === params.toEntityId) {
      throw new Error('From and To entities must be different');
    }

    // Verify both entities exist and belong to same user
    const fromEntity = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, params.fromEntityId), eq(entities.userId, params.userId)))
      .get();

    if (!fromEntity) {
      throw new Error('Source entity not found or does not belong to this user');
    }

    const toEntity = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, params.toEntityId), eq(entities.userId, params.userId)))
      .get();

    if (!toEntity) {
      throw new Error('Destination entity not found or does not belong to this user');
    }

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

  /**
   * Confirm or dispute an inter-entity transaction from one side.
   * When both sides confirm, status becomes 'confirmed'.
   * If either side rejects, status becomes 'disputed'.
   */
  async confirmInterEntityTransaction(
    transactionId: string,
    entityId: string,
    confirmed: boolean,
  ): Promise<InterEntityTransaction> {
    const txn = (await db
      .select()
      .from(interEntityTransactions)
      .where(eq(interEntityTransactions.id, transactionId))
      .get()) as InterEntityTransaction | undefined;

    if (!txn) {
      throw new Error('Inter-entity transaction not found');
    }

    let update: Record<string, any> = {};

    if (entityId === txn.fromEntityId) {
      update.confirmedByFrom = confirmed;
    } else if (entityId === txn.toEntityId) {
      update.confirmedByTo = confirmed;
    } else {
      throw new Error('Entity is not a party to this transaction');
    }

    // Determine new status
    const newFromConfirmed = entityId === txn.fromEntityId ? confirmed : txn.confirmedByFrom;
    const newToConfirmed = entityId === txn.toEntityId ? confirmed : txn.confirmedByTo;

    if (!confirmed) {
      update.status = 'disputed';
    } else if (newFromConfirmed && newToConfirmed) {
      update.status = 'confirmed';
    }

    await db
      .update(interEntityTransactions)
      .set(update)
      .where(eq(interEntityTransactions.id, transactionId));

    const updated = (await db
      .select()
      .from(interEntityTransactions)
      .where(eq(interEntityTransactions.id, transactionId))
      .get()) as InterEntityTransaction;

    return updated;
  }

  /**
   * Get inter-entity transactions for a user with optional filters.
   */
  async getInterEntityTransactions(
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

    if (filters?.status) {
      conditions.push(eq(interEntityTransactions.status, filters.status));
    }

    if (filters?.transactionType) {
      conditions.push(eq(interEntityTransactions.transactionType, filters.transactionType));
    }

    // Financial year filter: Australian FY runs Jul 1 to Jun 30
    if (filters?.financialYear) {
      const [startYear] = filters.financialYear.split('-').map(Number);
      const fyStart = `${startYear}-07-01`;
      const fyEnd = `${startYear + 1}-06-30`;
      conditions.push(sql`${interEntityTransactions.transactionDate} >= ${fyStart}`);
      conditions.push(sql`${interEntityTransactions.transactionDate} <= ${fyEnd}`);
    }

    const results = (await db
      .select()
      .from(interEntityTransactions)
      .where(and(...conditions))
      .all()) as InterEntityTransaction[];

    return results;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getDefaultSettings(entityType: EntityType): {
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
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const multiEntityService = new MultiEntityService();
