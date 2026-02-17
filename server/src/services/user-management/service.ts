/**
 * User Management Service — Core Service Class
 * Thin orchestrator delegating to activity-log and feature-flags.
 */

import crypto from 'crypto';
import { db } from '../../schema.js';
import { adminUsers, type AdminUser, type FeatureFlag } from '../../db/admin-schema.js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { AdminAuthService, adminAuthService } from '../admin-auth.js';
import type {
  CreateAdminInput,
  UpdateAdminInput,
  AdminListFilters,
  PaginatedResult,
  ActivityLogInput,
  ActivityLogFilters,
  ActivitySummary,
  RoleDefinition,
  PermissionDefinition,
  CreateFeatureFlagInput,
  FeatureFlagUpdate,
} from './types.js';
import { ROLES, PERMISSIONS, VALID_PERMISSIONS } from './constants.js';
import {
  logActivity,
  getActivityLog,
  getActivitySummary,
  cleanupActivityLog,
} from './activity-log.js';
import {
  getFeatureFlags,
  getFeatureFlag,
  isFeatureEnabled,
  updateFeatureFlag,
  createFeatureFlag,
} from './feature-flags.js';

export class UserManagementService {
  private adminAuth: AdminAuthService;
  private featureFlagCache: Map<string, { value: boolean; expiresAt: number }> = new Map();

  constructor(adminAuth: AdminAuthService) {
    this.adminAuth = adminAuth;
  }

  private sanitizeAdmin(admin: AdminUser): Omit<AdminUser, 'passwordHash' | 'mfaSecret'> {
    const { passwordHash: _passwordHash, mfaSecret: _mfaSecret, ...rest } = admin;
    return rest;
  }

  private getDefaultPermissions(role: string): string[] {
    const roleDef = ROLES.find((r) => r.role === role);
    return roleDef ? roleDef.defaultPermissions : [];
  }

  // --- Admin CRUD ---

  async createAdmin(
    data: CreateAdminInput,
    createdBy: string,
  ): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>> {
    const validation = this.adminAuth.validatePassword(data.password);
    if (!validation.valid) throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
    const existingUsername = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, data.username))
      .get();
    if (existingUsername) throw new Error('Username already exists');
    const existingEmail = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, data.email))
      .get();
    if (existingEmail) throw new Error('Email already exists');
    const passwordHash = await this.adminAuth.hashPassword(data.password);
    const permissions = data.permissions ?? this.getDefaultPermissions(data.role);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .insert(adminUsers)
      .values({
        id,
        username: data.username,
        email: data.email,
        passwordHash,
        displayName: data.displayName ?? null,
        role: data.role,
        permissions: JSON.stringify(permissions),
        isActive: true,
        loginCount: 0,
        failedLoginCount: 0,
        mfaEnabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    this.logActivity({
      userId: createdBy,
      action: 'admin.create',
      resourceType: 'admin_user',
      resourceId: id,
      details: { username: data.username, role: data.role },
      status: 'success',
    }).catch(() => {});
    const created = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
    return this.sanitizeAdmin(created!);
  }

  async getAdmin(id: string): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'> | null> {
    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
    return admin ? this.sanitizeAdmin(admin) : null;
  }

  async updateAdmin(
    id: string,
    data: UpdateAdminInput,
    updatedBy: string,
  ): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>> {
    const existing = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
    if (!existing) throw new Error('Admin not found');
    if (id === updatedBy && data.role !== undefined && data.role !== existing.role)
      throw new Error('Cannot change your own role');
    if (id === updatedBy && data.isActive === false)
      throw new Error('Cannot deactivate your own account');
    if (data.email && data.email !== existing.email) {
      const existingEmail = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, data.email))
        .get();
      if (existingEmail) throw new Error('Email already exists');
    }
    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.email !== undefined) updateData.email = data.email;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) updateData.permissions = JSON.stringify(data.permissions);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, id)).run();
    this.logActivity({
      userId: updatedBy,
      action: 'admin.update',
      resourceType: 'admin_user',
      resourceId: id,
      details: { changes: Object.keys(data).filter((k) => (data as any)[k] !== undefined) },
      status: 'success',
    }).catch(() => {});
    const updated = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
    return this.sanitizeAdmin(updated!);
  }

  async deleteAdmin(id: string, deletedBy: string): Promise<void> {
    if (id === deletedBy) throw new Error('Cannot delete your own account');
    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
    if (!admin) throw new Error('Admin not found');
    if (admin.role === 'super_admin') {
      const superAdmins = await db
        .select()
        .from(adminUsers)
        .where(and(eq(adminUsers.role, 'super_admin'), eq(adminUsers.isActive, true)))
        .all();
      if (superAdmins.length <= 1) throw new Error('Cannot delete the last super admin');
    }
    await db
      .update(adminUsers)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id))
      .run();
    this.logActivity({
      userId: deletedBy,
      action: 'admin.delete',
      resourceType: 'admin_user',
      resourceId: id,
      details: { username: admin.username },
      status: 'success',
    }).catch(() => {});
  }

  async listAdmins(
    filters?: AdminListFilters,
  ): Promise<PaginatedResult<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>>> {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    const conditions: any[] = [];
    if (filters?.role) conditions.push(eq(adminUsers.role, filters.role));
    if (filters?.isActive !== undefined) conditions.push(eq(adminUsers.isActive, filters.isActive));
    if (filters?.search) {
      conditions.push(
        sql`(${adminUsers.username} LIKE ${'%' + filters.search + '%'} OR ${adminUsers.email} LIKE ${'%' + filters.search + '%'} OR ${adminUsers.displayName} LIKE ${'%' + filters.search + '%'})`,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;
    const sortCol =
      filters?.sortBy === 'last_login_at'
        ? adminUsers.lastLoginAt
        : filters?.sortBy === 'created_at'
          ? adminUsers.createdAt
          : adminUsers.username;
    const sortFn = filters?.sortOrder === 'desc' ? desc : asc;
    const rows = await db
      .select()
      .from(adminUsers)
      .where(whereClause)
      .orderBy(sortFn(sortCol))
      .limit(limit)
      .offset(offset)
      .all();
    return { data: rows.map((r: AdminUser) => this.sanitizeAdmin(r)), total, limit, offset };
  }

  // --- Role & Permission Management ---

  async assignRole(adminId: string, role: string, assignedBy: string): Promise<void> {
    const validRoles = ROLES.map((r) => r.role);
    if (!validRoles.includes(role))
      throw new Error(`Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}`);
    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).get();
    if (!admin) throw new Error('Admin not found');
    const defaultPerms = this.getDefaultPermissions(role);
    await db
      .update(adminUsers)
      .set({ role, permissions: JSON.stringify(defaultPerms), updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, adminId))
      .run();
    this.logActivity({
      userId: assignedBy,
      action: 'admin.assign_role',
      resourceType: 'admin_user',
      resourceId: adminId,
      details: { role, permissions: defaultPerms },
      status: 'success',
    }).catch(() => {});
  }

  async updatePermissions(
    adminId: string,
    permissions: string[],
    updatedBy: string,
  ): Promise<void> {
    const invalid = permissions.filter((p) => !VALID_PERMISSIONS.has(p));
    if (invalid.length > 0) throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).get();
    if (!admin) throw new Error('Admin not found');
    await db
      .update(adminUsers)
      .set({ permissions: JSON.stringify(permissions), updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, adminId))
      .run();
    this.logActivity({
      userId: updatedBy,
      action: 'admin.update_permissions',
      resourceType: 'admin_user',
      resourceId: adminId,
      details: { permissions },
      status: 'success',
    }).catch(() => {});
  }

  getAvailableRoles(): RoleDefinition[] {
    return ROLES;
  }
  getAvailablePermissions(): PermissionDefinition[] {
    return PERMISSIONS;
  }

  // --- Delegated: Activity Logging ---
  async logActivity(input: ActivityLogInput): Promise<void> {
    return logActivity(input);
  }
  async getActivityLog(filters: ActivityLogFilters): Promise<PaginatedResult<any>> {
    return getActivityLog(filters);
  }
  async getActivitySummary(userId?: string, days?: number): Promise<ActivitySummary> {
    return getActivitySummary(userId, days);
  }
  async cleanupActivityLog(olderThanDays?: number): Promise<number> {
    return cleanupActivityLog(olderThanDays);
  }

  // --- Delegated: Feature Flags ---
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return getFeatureFlags();
  }
  async getFeatureFlag(flagName: string): Promise<FeatureFlag | null> {
    return getFeatureFlag(flagName);
  }
  async isFeatureEnabled(flagName: string): Promise<boolean> {
    return isFeatureEnabled(flagName, this.featureFlagCache);
  }
  async updateFeatureFlag(
    flagName: string,
    updates: FeatureFlagUpdate,
    updatedBy: string,
  ): Promise<FeatureFlag> {
    return updateFeatureFlag(flagName, updates, updatedBy, this.featureFlagCache);
  }
  async createFeatureFlag(data: CreateFeatureFlagInput, createdBy: string): Promise<FeatureFlag> {
    return createFeatureFlag(data, createdBy);
  }
}

export const userManagementService = new UserManagementService(adminAuthService);
