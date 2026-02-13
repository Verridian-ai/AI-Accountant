/**
 * Admin Authentication Service (Wave 20, upgraded Wave 23)
 *
 * Provides JWT-based admin authentication with:
 * - Password hashing (bcryptjs, 12 rounds)
 * - Login with lockout (5 failures → 15min lock)
 * - JWT access + refresh tokens (hono/jwt)
 * - RBAC middleware for Hono
 * - Session tracking (in-memory)
 * - Default admin seeding
 *
 * Wave 23 additions:
 * - Tenant-aware JWT generation (generateTenantToken)
 * - Tenant-aware JWT verification (verifyTenantToken)
 * - Tenant context switching via token refresh (refreshTenantToken)
 */

import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import crypto from 'crypto';
import { db, tenantMembers, tenants, rolePermissions, permissions } from '../schema.js';
import { adminUsers, type AdminUser } from '../db/admin-schema.js';
import { eq, and } from 'drizzle-orm';
import type { TenantRole } from './tenant-types.js';
import type { JWTPayload } from './auth-types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AdminTokenPayload {
  adminId: string;
  username: string;
  role: string;
  permissions: string[];
  type: 'access' | 'refresh';
  exp: number;
  iat: number;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  admin?: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    role: string;
    permissions: string[];
  };
  error?: string;
  remainingAttempts?: number;
}

interface AdminSession {
  adminId: string;
  username: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ACCESS_TOKEN_EXPIRY_S = 8 * 60 * 60; // 8 hours
const REFRESH_TOKEN_EXPIRY_S = 7 * 24 * 60 * 60; // 7 days
const TENANT_TOKEN_EXPIRY_S = 24 * 60 * 60; // 24 hours (tenant-aware tokens)

function getAdminJwtSecret(): string {
  return process.env.ADMIN_JWT_SECRET || 'admin-jwt-secret-change-me';
}

function getTenantJwtSecret(): string {
  return process.env.TENANT_JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'tenant-jwt-secret-change-me';
}

// ============================================================================
// ADMIN AUTH SERVICE
// ============================================================================

export class AdminAuthService {
  private sessions: Map<string, AdminSession> = new Map();

  // --------------------------------------------------------------------------
  // Password Management
  // --------------------------------------------------------------------------

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    return { valid: errors.length === 0, errors };
  }

  // --------------------------------------------------------------------------
  // JWT Management
  // --------------------------------------------------------------------------

  async generateToken(admin: Pick<AdminUser, 'id' | 'username' | 'role' | 'permissions'>): Promise<string> {
    const permissions = typeof admin.permissions === 'string'
      ? JSON.parse(admin.permissions)
      : admin.permissions;

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      permissions,
      type: 'access',
      iat: now,
      exp: now + ACCESS_TOKEN_EXPIRY_S,
    };
    return sign(payload, getAdminJwtSecret());
  }

  async generateRefreshToken(admin: Pick<AdminUser, 'id' | 'username' | 'role' | 'permissions'>): Promise<string> {
    const permissions = typeof admin.permissions === 'string'
      ? JSON.parse(admin.permissions)
      : admin.permissions;

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      permissions,
      type: 'refresh',
      iat: now,
      exp: now + REFRESH_TOKEN_EXPIRY_S,
    };
    return sign(payload, getAdminJwtSecret());
  }

  async verifyToken(token: string): Promise<AdminTokenPayload | null> {
    try {
      const payload = await verify(token, getAdminJwtSecret()) as unknown as AdminTokenPayload;
      if (!payload || !payload.adminId) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; admin: AdminTokenPayload } | null> {
    const payload = await this.verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') return null;

    // Verify admin still exists and is active
    const admin = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, payload.adminId))
      .get();
    if (!admin || !admin.isActive) return null;

    const newToken = await this.generateToken(admin);
    const newPayload = await this.verifyToken(newToken);
    return newPayload ? { token: newToken, admin: newPayload } : null;
  }

  // --------------------------------------------------------------------------
  // Tenant-Aware JWT (Wave 23)
  // --------------------------------------------------------------------------

  /**
   * Generate a tenant-aware JWT for a user within a specific tenant.
   * Looks up the user's role in tenant_members and their permissions from role_permissions.
   * Token expires in 24 hours.
   */
  async generateTenantToken(userId: string, tenantId: string): Promise<string> {
    // Look up the user's membership in this tenant
    const member = await db.select().from(tenantMembers)
      .where(and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId)
      )).get();

    if (!member) {
      throw new Error('User is not a member of this tenant');
    }

    const role = ((member as any).role ?? 'viewer') as TenantRole;

    // Look up permissions for this role in this tenant
    const permList = await this._getTenantPermissions(tenantId, role);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      userId,
      tenantId,
      role,
      permissions: permList,
      iat: now,
      exp: now + TENANT_TOKEN_EXPIRY_S,
    };

    return sign(payload, getTenantJwtSecret());
  }

  /**
   * Verify a tenant-aware JWT and return the decoded payload.
   * Validates signature and expiry but does NOT re-check membership (middleware does that).
   */
  async verifyTenantToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = await verify(token, getTenantJwtSecret()) as unknown as JWTPayload;
      if (!payload || !payload.userId || !payload.tenantId) return null;
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Refresh a tenant-aware token, optionally switching to a different tenant.
   * If newTenantId is provided, validates the user's membership in the new tenant
   * and generates a token for the new tenant context.
   */
  async refreshTenantToken(
    token: string,
    newTenantId?: string
  ): Promise<{ token: string; payload: JWTPayload } | null> {
    const existing = await this.verifyTenantToken(token);
    if (!existing) return null;

    const targetTenantId = newTenantId ?? existing.tenantId;

    // Verify the target tenant exists and is active
    const tenant = await db.select().from(tenants)
      .where(eq(tenants.id, targetTenantId)).get();
    if (!tenant) return null;
    const tenantRow = tenant as any;
    const isActive = tenantRow.isActive ?? tenantRow.is_active ?? true;
    if (!isActive) return null;

    // Verify user is a member of the target tenant
    const member = await db.select().from(tenantMembers)
      .where(and(
        eq(tenantMembers.tenantId, targetTenantId),
        eq(tenantMembers.userId, existing.userId)
      )).get();
    if (!member) return null;

    // Generate fresh token for the (possibly new) tenant
    const newToken = await this.generateTenantToken(existing.userId, targetTenantId);
    const newPayload = await this.verifyTenantToken(newToken);

    return newPayload ? { token: newToken, payload: newPayload } : null;
  }

  /**
   * Fetch permission names for a role in a tenant from the DB.
   * Used internally by generateTenantToken.
   */
  private async _getTenantPermissions(tenantId: string, role: TenantRole): Promise<string[]> {
    const rps = await db.select().from(rolePermissions)
      .where(and(
        eq(rolePermissions.tenantId, tenantId),
        eq(rolePermissions.role, role)
      )).all();

    const permIds = (rps as any[]).map(rp => rp.permissionId ?? rp.permission_id);
    if (permIds.length === 0) return [];

    const allPerms = await db.select().from(permissions).all();
    const permMap = new Map<string, string>();
    for (const p of allPerms as any[]) {
      permMap.set(p.id, p.name);
    }

    return permIds.map(id => permMap.get(id)).filter((name): name is string => !!name);
  }

  // --------------------------------------------------------------------------
  // Login
  // --------------------------------------------------------------------------

  async login(username: string, password: string, ipAddress?: string): Promise<LoginResult> {
    const admin = await db.select().from(adminUsers)
      .where(eq(adminUsers.username, username))
      .get();

    if (!admin) {
      return { success: false, error: 'Invalid credentials' };
    }

    if (!admin.isActive) {
      return { success: false, error: 'Account is deactivated' };
    }

    // Check lockout
    if (admin.lockedUntil) {
      const lockedUntilDate = new Date(admin.lockedUntil);
      if (lockedUntilDate > new Date()) {
        const remainingMs = lockedUntilDate.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return {
          success: false,
          error: `Account locked. Try again in ${remainingMin} minute(s).`,
          remainingAttempts: 0,
        };
      }
      // Lock expired, reset
      await db.update(adminUsers)
        .set({ lockedUntil: null, failedLoginCount: 0 })
        .where(eq(adminUsers.id, admin.id))
        .run();
      admin.failedLoginCount = 0;
      admin.lockedUntil = null;
    }

    // Verify password
    if (!admin.passwordHash) {
      return { success: false, error: 'Account not set up (no password)' };
    }

    const passwordValid = await this.verifyPassword(password, admin.passwordHash);

    if (!passwordValid) {
      const newFailCount = (admin.failedLoginCount ?? 0) + 1;
      const remaining = MAX_LOGIN_ATTEMPTS - newFailCount;

      const updateData: Record<string, any> = {
        failedLoginCount: newFailCount,
        updatedAt: new Date().toISOString(),
      };

      // Lock account if max attempts reached
      if (newFailCount >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      }

      await db.update(adminUsers)
        .set(updateData)
        .where(eq(adminUsers.id, admin.id))
        .run();

      return {
        success: false,
        error: remaining > 0
          ? `Invalid credentials. ${remaining} attempt(s) remaining.`
          : 'Account locked due to too many failed attempts.',
        remainingAttempts: Math.max(0, remaining),
      };
    }

    // Success — reset counters and update login info
    await db.update(adminUsers)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
        loginCount: (admin.loginCount ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(adminUsers.id, admin.id))
      .run();

    const token = await this.generateToken(admin);
    const refreshToken = await this.generateRefreshToken(admin);

    // Track session
    const sessionId = crypto.randomUUID();
    this.trackSession(sessionId, {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      ipAddress,
    });

    const permissions = typeof admin.permissions === 'string'
      ? JSON.parse(admin.permissions)
      : admin.permissions;

    return {
      success: true,
      token,
      refreshToken,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
        permissions,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Account Management
  // --------------------------------------------------------------------------

  async createAdmin(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
    role?: string;
    permissions?: string[];
  }): Promise<AdminUser> {
    const validation = this.validatePassword(data.password);
    if (!validation.valid) {
      throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
    }

    const passwordHash = await this.hashPassword(data.password);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(adminUsers).values({
      id,
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName ?? null,
      role: data.role ?? 'admin',
      permissions: JSON.stringify(data.permissions ?? []),
      isActive: true,
      loginCount: 0,
      failedLoginCount: 0,
      mfaEnabled: false,
      createdAt: now,
      updatedAt: now,
    }).run();

    const created = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    return created!;
  }

  async updateAdmin(id: string, data: {
    displayName?: string;
    email?: string;
    role?: string;
    permissions?: string[];
  }): Promise<AdminUser | null> {
    const existing = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    if (!existing) return null;

    const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) updateData.permissions = JSON.stringify(data.permissions);

    await db.update(adminUsers)
      .set(updateData)
      .where(eq(adminUsers.id, id))
      .run();

    return db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
  }

  async deactivateAdmin(id: string): Promise<boolean> {
    const existing = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    if (!existing) return false;

    await db.update(adminUsers)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id))
      .run();
    return true;
  }

  async resetPassword(id: string, newPassword: string): Promise<boolean> {
    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
    }

    const existing = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    if (!existing) return false;

    const passwordHash = await this.hashPassword(newPassword);
    await db.update(adminUsers)
      .set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id))
      .run();
    return true;
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const admin = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    if (!admin || !admin.passwordHash) {
      return { success: false, error: 'Admin not found' };
    }

    const currentValid = await this.verifyPassword(currentPassword, admin.passwordHash);
    if (!currentValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const passwordHash = await this.hashPassword(newPassword);
    await db.update(adminUsers)
      .set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(eq(adminUsers.id, id))
      .run();

    return { success: true };
  }

  async unlockAccount(id: string): Promise<boolean> {
    const existing = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    if (!existing) return false;

    await db.update(adminUsers)
      .set({
        lockedUntil: null,
        failedLoginCount: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(adminUsers.id, id))
      .run();
    return true;
  }

  async listAdmins(): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>[]> {
    const admins = await db.select().from(adminUsers).all();
    return admins.map((a: AdminUser) => {
      const { passwordHash, mfaSecret, ...rest } = a;
      return rest;
    });
  }

  async getAdminById(id: string): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'> | null> {
    const admin = await db.select().from(adminUsers)
      .where(eq(adminUsers.id, id))
      .get();
    if (!admin) return null;
    const { passwordHash, mfaSecret, ...rest } = admin;
    return rest;
  }

  // --------------------------------------------------------------------------
  // Session Tracking (In-Memory)
  // --------------------------------------------------------------------------

  trackSession(sessionId: string, data: {
    adminId: string;
    username: string;
    role: string;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    const now = new Date();
    this.sessions.set(sessionId, {
      ...data,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_S * 1000),
    });
  }

  validateSession(sessionId: string): AdminSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    session.lastActivityAt = new Date();
    return session;
  }

  endSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getActiveSessions(): { sessionId: string; session: AdminSession }[] {
    const now = new Date();
    const active: { sessionId: string; session: AdminSession }[] = [];
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt > now) {
        active.push({ sessionId, session });
      } else {
        this.sessions.delete(sessionId);
      }
    }
    return active;
  }

  // --------------------------------------------------------------------------
  // Default Admin Seeding
  // --------------------------------------------------------------------------

  async seedDefaultAdmin(): Promise<void> {
    try {
      const existing = await db.select().from(adminUsers).all();
      if (existing.length > 0) {
        console.log('[AdminAuth] Admin users already exist, skipping seed.');
        return;
      }

      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || crypto.randomBytes(16).toString('hex');
      const passwordHash = await this.hashPassword(defaultPassword);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.insert(adminUsers).values({
        id,
        username: 'admin',
        email: 'admin@goldledger.local',
        passwordHash,
        displayName: 'Super Admin',
        role: 'super_admin',
        permissions: JSON.stringify([
          'admin.users.manage',
          'admin.agents.manage',
          'admin.system.manage',
          'admin.cognee.manage',
          'admin.features.manage',
          'admin.metrics.view',
          'admin.logs.view',
        ]),
        isActive: true,
        loginCount: 0,
        failedLoginCount: 0,
        mfaEnabled: false,
        createdAt: now,
        updatedAt: now,
      }).run();

      if (process.env.ADMIN_DEFAULT_PASSWORD) {
        console.log('[AdminAuth] Default admin seeded (username: admin, password from ADMIN_DEFAULT_PASSWORD env)');
      } else {
        console.log(`[AdminAuth] Default admin seeded (username: admin, password: ${defaultPassword})`);
        console.log('[AdminAuth] IMPORTANT: Save this password! Set ADMIN_DEFAULT_PASSWORD env var for production.');
      }
    } catch (err: any) {
      // Table might not exist yet — don't crash the server
      console.warn('[AdminAuth] Could not seed default admin:', err.message || err);
    }
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Hono middleware that verifies admin JWT from Authorization: Bearer <token>
 * and optionally checks for a specific permission.
 */
export function adminAuthMiddleware(requiredPermission?: string) {
  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await adminAuthService.verifyToken(token);
    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    if (payload.type !== 'access') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    // Check required permission
    if (requiredPermission) {
      const hasPermission =
        payload.role === 'super_admin' ||
        payload.permissions.includes(requiredPermission);
      if (!hasPermission) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
    }

    // Attach admin payload to context
    c.set('admin', payload);
    await next();
  });
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const adminAuthService = new AdminAuthService();
