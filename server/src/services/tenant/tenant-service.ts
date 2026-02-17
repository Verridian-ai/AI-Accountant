/**
 * Tenant Service — Singleton class facade
 */

import type {
  Tenant,
  TenantMember,
  TenantInvitation,
  TenantContext,
  TenantRole,
  CreateTenantOptions,
} from '../tenant-types.js';
import * as crud from './tenant-crud.js';
import * as inv from './invitations.js';

export class TenantService {
  async createTenant(
    name: string,
    slug: string,
    ownerId: string,
    options: CreateTenantOptions = {},
  ): Promise<Tenant> {
    return crud.createTenant(name, slug, ownerId, options);
  }
  async updateTenant(
    tenantId: string,
    updates: Parameters<typeof crud.updateTenant>[1],
  ): Promise<Tenant> {
    return crud.updateTenant(tenantId, updates);
  }
  async getTenant(tenantId: string): Promise<Tenant | null> {
    return crud.getTenant(tenantId);
  }
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return crud.getTenantBySlug(slug);
  }
  async deactivateTenant(tenantId: string): Promise<void> {
    return crud.deactivateTenant(tenantId);
  }
  async addMember(
    tenantId: string,
    userId: string,
    role: TenantRole,
    invitedBy?: string,
  ): Promise<TenantMember> {
    return crud.addMember(tenantId, userId, role, invitedBy);
  }
  async removeMember(tenantId: string, userId: string): Promise<void> {
    return crud.removeMember(tenantId, userId);
  }
  async updateMemberRole(
    tenantId: string,
    userId: string,
    newRole: TenantRole,
  ): Promise<TenantMember> {
    return crud.updateMemberRole(tenantId, userId, newRole);
  }
  async getMembers(tenantId: string): Promise<TenantMember[]> {
    return crud.getMembers(tenantId);
  }
  async getMemberTenants(userId: string) {
    return crud.getMemberTenants(userId);
  }
  async inviteMember(
    tenantId: string,
    email: string,
    role: TenantRole,
    invitedBy: string,
  ): Promise<TenantInvitation> {
    return inv.inviteMember(tenantId, email, role, invitedBy);
  }
  async acceptInvitation(token: string, userId: string) {
    return inv.acceptInvitation(token, userId);
  }
  async revokeInvitation(invitationId: string): Promise<void> {
    return inv.revokeInvitation(invitationId);
  }
  async getPendingInvitations(tenantId: string): Promise<TenantInvitation[]> {
    return inv.getPendingInvitations(tenantId);
  }
  async cleanupExpiredInvitations(): Promise<number> {
    return inv.cleanupExpiredInvitations();
  }
  async switchTenant(userId: string, tenantId: string): Promise<TenantContext> {
    return inv.switchTenant(userId, tenantId);
  }
  async getTenantContext(userId: string, tenantId: string): Promise<TenantContext> {
    return inv.getTenantContext(userId, tenantId);
  }
  async getDefaultTenant(userId: string): Promise<Tenant | null> {
    return inv.getDefaultTenant(userId);
  }
}

export const tenantService = new TenantService();
