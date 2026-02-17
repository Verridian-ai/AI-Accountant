/**
 * Multi-Entity Service — Singleton class facade
 */

import type {
  Entity,
  EntityAccount,
  EntitySetting,
  EntityType,
  InterEntityTransaction,
} from './types.js';
import * as mgmt from './entity-management.js';
import * as hier from './hierarchy.js';
import * as inter from './inter-entity.js';

export class MultiEntityService {
  async createEntity(params: Parameters<typeof mgmt.createEntity>[0]): Promise<Entity> {
    return mgmt.createEntity(params);
  }
  async updateEntity(
    entityId: string,
    userId: string,
    updates: Parameters<typeof mgmt.updateEntity>[2],
  ): Promise<Entity> {
    return mgmt.updateEntity(entityId, userId, updates);
  }
  async linkAccount(params: Parameters<typeof mgmt.linkAccount>[0]): Promise<EntityAccount> {
    return mgmt.linkAccount(params);
  }
  async unlinkAccount(entityId: string, accountId: string): Promise<void> {
    return mgmt.unlinkAccount(entityId, accountId);
  }
  async updateEntitySettings(
    entityId: string,
    settings: Parameters<typeof mgmt.updateEntitySettings>[1],
  ): Promise<EntitySetting> {
    return mgmt.updateEntitySettings(entityId, settings);
  }
  async getEntityHierarchy(userId: string) {
    return hier.getEntityHierarchy(userId);
  }
  async getEntityWithAccounts(entityId: string, userId: string) {
    return hier.getEntityWithAccounts(entityId, userId);
  }
  async recordInterEntityTransaction(
    params: Parameters<typeof inter.recordInterEntityTransaction>[0],
  ): Promise<InterEntityTransaction> {
    return inter.recordInterEntityTransaction(params);
  }
  async confirmInterEntityTransaction(
    transactionId: string,
    entityId: string,
    confirmed: boolean,
  ): Promise<InterEntityTransaction> {
    return inter.confirmInterEntityTransaction(transactionId, entityId, confirmed);
  }
  async getInterEntityTransactions(
    userId: string,
    filters?: Parameters<typeof inter.getInterEntityTransactions>[1],
  ): Promise<InterEntityTransaction[]> {
    return inter.getInterEntityTransactions(userId, filters);
  }
  private getDefaultSettings(entityType: EntityType) {
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

export const multiEntityService = new MultiEntityService();
