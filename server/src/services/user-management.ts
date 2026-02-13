/**
 * User Management Service (Wave 20)
 *
 * Admin CRUD, role/permission management, activity logging,
 * and feature flag management for the admin dashboard.
 */

import crypto from 'crypto';
import { db } from '../schema.js';
import {
  adminUsers,
  userActivityLog,
  featureFlags,
  type AdminUser,
  type FeatureFlag,
} from '../db/admin-schema.js';
import { eq, and, gte, lte, like, desc, asc, sql } from 'drizzle-orm';
import { AdminAuthService, adminAuthService } from './admin-auth.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateAdminInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  role: 'super_admin' | 'admin' | 'viewer';
  permissions?: string[];
}

export interface UpdateAdminInput {
  email?: string;
  displayName?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface AdminListFilters {
  role?: string;
  isActive?: boolean;
  search?: string;
  sortBy?: 'username' | 'last_login_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActivityLogInput {
  userId?: string;
  sessionId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
  status?: 'success' | 'failure';
}

export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ActivitySummary {
  totalActions: number;
  actionBreakdown: Record<string, number>;
  dailyActivity: Array<{ date: string; count: number }>;
  mostActiveHour: number;
  topResources: Array<{ type: string; count: number }>;
  lastActivity: string;
}

export interface RoleDefinition {
  role: string;
  displayName: string;
  description: string;
  defaultPermissions: string[];
}

export interface PermissionDefinition {
  permission: string;
  displayName: string;
  description: string;
  category: string;
}

export interface CreateFeatureFlagInput {
  flagName: string;
  displayName: string;
  description?: string;
  isEnabled: boolean;
  rolloutPercentage?: number;
  category: string;
}

export interface FeatureFlagUpdate {
  isEnabled?: boolean;
  rolloutPercentage?: number;
  conditions?: Record<string, any>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ROLES: RoleDefinition[] = [
  {
    role: 'super_admin',
    displayName: 'Super Admin',
    description:
      'Full system access — can manage all users, agents, Cognee, features, and system settings',
    defaultPermissions: [
      'manage_users',
      'manage_agents',
      'manage_cognee',
      'view_metrics',
      'manage_features',
      'trigger_crawl',
      'manage_scheduler',
    ],
  },
  {
    role: 'admin',
    displayName: 'Admin',
    description: 'Operational access — can manage agents, trigger crawls, and view metrics',
    defaultPermissions: ['view_metrics', 'manage_agents', 'trigger_crawl', 'manage_scheduler'],
  },
  {
    role: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access — can view metrics and dashboards',
    defaultPermissions: ['view_metrics'],
  },
];

const PERMISSIONS: PermissionDefinition[] = [
  {
    permission: 'manage_users',
    displayName: 'Manage Users',
    description: 'Create, update, delete admin users and assign roles',
    category: 'User Management',
  },
  {
    permission: 'manage_agents',
    displayName: 'Manage Agents',
    description: 'Configure, enable/disable, and monitor AI agents',
    category: 'Agent Management',
  },
  {
    permission: 'manage_cognee',
    displayName: 'Manage Cognee',
    description: 'Manage knowledge graph, datasets, ontologies, and Cognee settings',
    category: 'Cognee Management',
  },
  {
    permission: 'view_metrics',
    displayName: 'View Metrics',
    description: 'View system metrics, dashboards, and monitoring data',
    category: 'System Monitoring',
  },
  {
    permission: 'manage_features',
    displayName: 'Manage Features',
    description: 'Toggle feature flags and manage rollout percentages',
    category: 'Feature Flags',
  },
  {
    permission: 'trigger_crawl',
    displayName: 'Trigger Crawl',
    description: 'Trigger knowledge ingestion and data crawling operations',
    category: 'Data Operations',
  },
  {
    permission: 'manage_scheduler',
    displayName: 'Manage Scheduler',
    description: 'Configure scheduled jobs and background task settings',
    category: 'Data Operations',
  },
];

const VALID_PERMISSIONS = new Set(PERMISSIONS.map((p) => p.permission));

// ============================================================================
// SERVICE
// ============================================================================

export class UserManagementService {
  private adminAuth: AdminAuthService;
  private featureFlagCache: Map<string, { value: boolean; expiresAt: number }> = new Map();

  constructor(adminAuth: AdminAuthService) {
    this.adminAuth = adminAuth;
  }

  // --------------------------------------------------------------------------
  // Helper: strip sensitive fields from AdminUser
  // --------------------------------------------------------------------------
  private sanitizeAdmin(admin: AdminUser): Omit<AdminUser, 'passwordHash' | 'mfaSecret'> {
    const { passwordHash, mfaSecret, ...rest } = admin;
    return rest;
  }

  private getDefaultPermissions(role: string): string[] {
    const roleDef = ROLES.find((r) => r.role === role);
    return roleDef ? roleDef.defaultPermissions : [];
  }

  // --------------------------------------------------------------------------
  // Admin CRUD
  // --------------------------------------------------------------------------

  async createAdmin(
    data: CreateAdminInput,
    createdBy: string,
  ): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>> {
    // Validate password
    const validation = this.adminAuth.validatePassword(data.password);
    if (!validation.valid) {
      throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
    }

    // Check username uniqueness
    const existingUsername = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, data.username))
      .get();
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // Check email uniqueness
    const existingEmail = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, data.email))
      .get();
    if (existingEmail) {
      throw new Error('Email already exists');
    }

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

    // Log activity (fire and forget)
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

    // Prevent self-role-change
    if (id === updatedBy && data.role !== undefined && data.role !== existing.role) {
      throw new Error('Cannot change your own role');
    }

    // Prevent self-deactivation
    if (id === updatedBy && data.isActive === false) {
      throw new Error('Cannot deactivate your own account');
    }

    // Validate email uniqueness if changed
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
    if (id === deletedBy) {
      throw new Error('Cannot delete your own account');
    }

    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
    if (!admin) throw new Error('Admin not found');

    // Prevent deleting the last super_admin
    if (admin.role === 'super_admin') {
      const superAdmins = await db
        .select()
        .from(adminUsers)
        .where(and(eq(adminUsers.role, 'super_admin'), eq(adminUsers.isActive, true)))
        .all();
      if (superAdmins.length <= 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    // Soft delete
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

    // Build conditions
    const conditions: any[] = [];
    if (filters?.role) conditions.push(eq(adminUsers.role, filters.role));
    if (filters?.isActive !== undefined) conditions.push(eq(adminUsers.isActive, filters.isActive));
    if (filters?.search) {
      conditions.push(
        sql`(${adminUsers.username} LIKE ${'%' + filters.search + '%'} OR ${adminUsers.email} LIKE ${'%' + filters.search + '%'} OR ${adminUsers.displayName} LIKE ${'%' + filters.search + '%'})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;

    // Determine sort
    const sortCol =
      filters?.sortBy === 'last_login_at'
        ? adminUsers.lastLoginAt
        : filters?.sortBy === 'created_at'
          ? adminUsers.createdAt
          : adminUsers.username;
    const sortFn = filters?.sortOrder === 'desc' ? desc : asc;

    // Query
    const rows = await db
      .select()
      .from(adminUsers)
      .where(whereClause)
      .orderBy(sortFn(sortCol))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      data: rows.map((r: AdminUser) => this.sanitizeAdmin(r)),
      total,
      limit,
      offset,
    };
  }

  // --------------------------------------------------------------------------
  // Role & Permission Management
  // --------------------------------------------------------------------------

  async assignRole(adminId: string, role: string, assignedBy: string): Promise<void> {
    const validRoles = ROLES.map((r) => r.role);
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}`);
    }

    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).get();
    if (!admin) throw new Error('Admin not found');

    const defaultPerms = this.getDefaultPermissions(role);

    await db
      .update(adminUsers)
      .set({
        role,
        permissions: JSON.stringify(defaultPerms),
        updatedAt: new Date().toISOString(),
      })
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
    // Validate all permissions
    const invalid = permissions.filter((p) => !VALID_PERMISSIONS.has(p));
    if (invalid.length > 0) {
      throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
    }

    const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).get();
    if (!admin) throw new Error('Admin not found');

    await db
      .update(adminUsers)
      .set({
        permissions: JSON.stringify(permissions),
        updatedAt: new Date().toISOString(),
      })
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

  // --------------------------------------------------------------------------
  // Activity Logging
  // --------------------------------------------------------------------------

  async logActivity(input: ActivityLogInput): Promise<void> {
    try {
      const id = crypto.randomUUID();
      await db
        .insert(userActivityLog)
        .values({
          id,
          userId: input.userId ?? null,
          sessionId: input.sessionId ?? null,
          action: input.action,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          details: JSON.stringify(input.details ?? {}),
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          durationMs: input.durationMs ?? null,
          status: input.status ?? 'success',
          createdAt: new Date().toISOString(),
        })
        .run();
    } catch {
      // Non-blocking — don't fail if logging fails
    }
  }

  async getActivityLog(filters: ActivityLogFilters): Promise<PaginatedResult<any>> {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const conditions: any[] = [];
    if (filters.userId) conditions.push(eq(userActivityLog.userId, filters.userId));
    if (filters.action) conditions.push(eq(userActivityLog.action, filters.action));
    if (filters.resourceType)
      conditions.push(eq(userActivityLog.resourceType, filters.resourceType));
    if (filters.status) conditions.push(eq(userActivityLog.status, filters.status));
    if (filters.from) conditions.push(gte(userActivityLog.createdAt, filters.from));
    if (filters.to) conditions.push(lte(userActivityLog.createdAt, filters.to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userActivityLog)
      .where(whereClause)
      .get();
    const total = countResult?.count ?? 0;

    const rows = await db
      .select()
      .from(userActivityLog)
      .where(whereClause)
      .orderBy(desc(userActivityLog.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return { data: rows, total, limit, offset };
  }

  async getActivitySummary(userId?: string, days: number = 30): Promise<ActivitySummary> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const conditions: any[] = [gte(userActivityLog.createdAt, cutoff)];
    if (userId) conditions.push(eq(userActivityLog.userId, userId));
    const whereClause = and(...conditions);

    const rows = await db
      .select()
      .from(userActivityLog)
      .where(whereClause)
      .orderBy(desc(userActivityLog.createdAt))
      .all();

    // Compute aggregates
    const actionBreakdown: Record<string, number> = {};
    const dailyCounts: Record<string, number> = {};
    const hourlyCounts: Record<number, number> = {};
    const resourceCounts: Record<string, number> = {};

    for (const row of rows) {
      // Action breakdown
      actionBreakdown[row.action] = (actionBreakdown[row.action] || 0) + 1;

      // Daily activity
      const date = row.createdAt.substring(0, 10);
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;

      // Hourly activity
      const hour = parseInt(row.createdAt.substring(11, 13), 10);
      if (!isNaN(hour)) {
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      }

      // Resource counts
      if (row.resourceType) {
        resourceCounts[row.resourceType] = (resourceCounts[row.resourceType] || 0) + 1;
      }
    }

    const dailyActivity = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const mostActiveHour =
      Object.entries(hourlyCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '0';

    const topResources = Object.entries(resourceCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalActions: rows.length,
      actionBreakdown,
      dailyActivity,
      mostActiveHour: parseInt(mostActiveHour, 10),
      topResources,
      lastActivity: rows[0]?.createdAt ?? '',
    };
  }

  // --------------------------------------------------------------------------
  // Feature Flag Management
  // --------------------------------------------------------------------------

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).all();
  }

  async getFeatureFlag(flagName: string): Promise<FeatureFlag | null> {
    return db.select().from(featureFlags).where(eq(featureFlags.flagName, flagName)).get() ?? null;
  }

  async isFeatureEnabled(flagName: string): Promise<boolean> {
    // Check cache first
    const cached = this.featureFlagCache.get(flagName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const flag = await this.getFeatureFlag(flagName);
    if (!flag) {
      this.featureFlagCache.set(flagName, { value: false, expiresAt: Date.now() + 60_000 });
      return false;
    }

    let enabled = flag.isEnabled;
    if (enabled && flag.rolloutPercentage < 100) {
      // Simple deterministic rollout based on flag name hash
      const hash = Array.from(flagName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      enabled = hash % 100 < flag.rolloutPercentage;
    }

    this.featureFlagCache.set(flagName, { value: enabled, expiresAt: Date.now() + 60_000 });
    return enabled;
  }

  async updateFeatureFlag(
    flagName: string,
    updates: FeatureFlagUpdate,
    updatedBy: string,
  ): Promise<FeatureFlag> {
    const existing = await this.getFeatureFlag(flagName);
    if (!existing) throw new Error(`Feature flag '${flagName}' not found`);

    const updateData: Record<string, any> = {
      updatedBy,
      updatedAt: new Date().toISOString(),
    };
    if (updates.isEnabled !== undefined) updateData.isEnabled = updates.isEnabled;
    if (updates.rolloutPercentage !== undefined)
      updateData.rolloutPercentage = updates.rolloutPercentage;
    if (updates.conditions !== undefined)
      updateData.conditions = JSON.stringify(updates.conditions);

    await db.update(featureFlags).set(updateData).where(eq(featureFlags.flagName, flagName)).run();

    // Clear cache
    this.featureFlagCache.delete(flagName);

    this.logActivity({
      userId: updatedBy,
      action: 'feature_flag.update',
      resourceType: 'feature_flag',
      resourceId: existing.id,
      details: { flagName, changes: updates },
      status: 'success',
    }).catch(() => {});

    return (await this.getFeatureFlag(flagName))!;
  }

  async createFeatureFlag(data: CreateFeatureFlagInput, createdBy: string): Promise<FeatureFlag> {
    const existing = await this.getFeatureFlag(data.flagName);
    if (existing) throw new Error(`Feature flag '${data.flagName}' already exists`);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .insert(featureFlags)
      .values({
        id,
        flagName: data.flagName,
        displayName: data.displayName,
        description: data.description ?? null,
        isEnabled: data.isEnabled,
        rolloutPercentage: data.rolloutPercentage ?? 0,
        conditions: JSON.stringify({}),
        category: data.category,
        createdBy,
        updatedBy: createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    this.logActivity({
      userId: createdBy,
      action: 'feature_flag.create',
      resourceType: 'feature_flag',
      resourceId: id,
      details: { flagName: data.flagName },
      status: 'success',
    }).catch(() => {});

    return (await this.getFeatureFlag(data.flagName))!;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  async cleanupActivityLog(olderThanDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    // Count first
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(userActivityLog)
      .where(lte(userActivityLog.createdAt, cutoff))
      .get();
    const count = countResult?.count ?? 0;

    if (count > 0) {
      await db.delete(userActivityLog).where(lte(userActivityLog.createdAt, cutoff)).run();
    }

    return count;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const userManagementService = new UserManagementService(adminAuthService);
