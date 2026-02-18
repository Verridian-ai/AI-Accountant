/**
 * Multi-Entity — Hierarchy and Entity Detail Queries
 */

import { db } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { entities, entityAccounts, entitySettings, accounts } from './tables.js';
import type { Entity, EntityAccount, EntitySetting } from './types.js';

export async function getEntityHierarchy(userId: string): Promise<{
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
  const allEntities = (await db
    .select()
    .from(entities)
    .where(eq(entities.userId, userId))
    .all()) as Entity[];
  const entityIds = allEntities.map((e) => e.id);
  const allEntityAccounts: EntityAccount[] = [];
  for (const eid of entityIds) {
    const accts = (await db
      .select()
      .from(entityAccounts)
      .where(eq(entityAccounts.entityId, eid))
      .all()) as EntityAccount[];
    allEntityAccounts.push(...accts);
  }
  const allSettings: EntitySetting[] = [];
  for (const eid of entityIds) {
    const setting = (await db
      .select()
      .from(entitySettings)
      .where(eq(entitySettings.entityId, eid))
      .get()) as EntitySetting | undefined;
    if (setting) allSettings.push(setting);
  }
  const entityMap = new Map(allEntities.map((e) => [e.id, e]));
  const accountsByEntity = new Map<string, EntityAccount[]>();
  for (const ea of allEntityAccounts) {
    const existing = accountsByEntity.get(ea.entityId) ?? [];
    existing.push(ea);
    accountsByEntity.set(ea.entityId, existing);
  }
  const settingsByEntity = new Map(allSettings.map((s) => [s.entityId, s]));
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
  return { entities: enrichedEntities, rootEntities, totalEntities: allEntities.length };
}

export async function getEntityWithAccounts(
  entityId: string,
  userId: string,
): Promise<{
  entity: Entity;
  settings: EntitySetting | null;
  accounts: Array<EntityAccount & { accountDetails: Record<string, unknown> | null }>;
  parent?: Entity;
  children: Entity[];
}> {
  const entity = (await db
    .select()
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
    .get()) as Entity | undefined;
  if (!entity) throw new Error('Entity not found');
  const settings = (await db
    .select()
    .from(entitySettings)
    .where(eq(entitySettings.entityId, entityId))
    .get()) as EntitySetting | undefined;
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
    enrichedAccounts.push({ ...ea, accountDetails: accountDetails ?? null });
  }
  let parent: Entity | undefined;
  if (entity.parentEntityId) {
    parent = (await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.parentEntityId))
      .get()) as Entity | undefined;
  }
  const children = (await db
    .select()
    .from(entities)
    .where(and(eq(entities.parentEntityId, entityId), eq(entities.userId, userId)))
    .all()) as Entity[];
  return { entity, settings: settings ?? null, accounts: enrichedAccounts, parent, children };
}
