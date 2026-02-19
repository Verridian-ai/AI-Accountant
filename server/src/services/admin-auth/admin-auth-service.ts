/**
 * Admin Auth Service — Main Service Class
 *
 * Orchestrates password management, JWT, login, account management,
 * session tracking, and default admin seeding.
 */

import { type AdminUser } from '../../db/admin-schema.js';
import type { AdminTokenPayload, LoginResult, AdminSession } from './types.js';
import { ACCESS_TOKEN_EXPIRY_S } from './types.js';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  refreshAccessToken,
  generateTenantToken,
  verifyTenantToken,
  refreshTenantToken,
  generateTenantTokenWithRefresh,
  rotateTenantRefreshToken,
  login,
} from './authentication.js';
import {
  createAdmin as createAdminFn,
  updateAdmin as updateAdminFn,
  deactivateAdmin as deactivateAdminFn,
  resetPassword as resetPasswordFn,
  changePassword as changePasswordFn,
  unlockAccount as unlockAccountFn,
  listAdmins as listAdminsFn,
  getAdminById as getAdminByIdFn,
  seedDefaultAdmin as seedDefaultAdminFn,
} from './account-management.js';
import type { JWTPayload } from '../auth-types.js';

// ============================================================================
// ADMIN AUTH SERVICE
// ============================================================================

export class AdminAuthService {
  private sessions: Map<string, AdminSession> = new Map();

  // --------------------------------------------------------------------------
  // Password Management (delegated)
  // --------------------------------------------------------------------------

  async hashPassword(password: string): Promise<string> {
    return hashPassword(password);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return verifyPassword(password, hash);
  }

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    return validatePassword(password);
  }

  // --------------------------------------------------------------------------
  // JWT Management (delegated)
  // --------------------------------------------------------------------------

  async generateToken(
    admin: Pick<AdminUser, 'id' | 'username' | 'role' | 'permissions'>,
  ): Promise<string> {
    return generateToken(admin);
  }

  async generateRefreshToken(
    admin: Pick<AdminUser, 'id' | 'username' | 'role' | 'permissions'>,
  ): Promise<string> {
    return generateRefreshToken(admin);
  }

  async verifyToken(token: string): Promise<AdminTokenPayload | null> {
    return verifyToken(token);
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ token: string; admin: AdminTokenPayload } | null> {
    return refreshAccessToken(refreshToken);
  }

  // --------------------------------------------------------------------------
  // Tenant-Aware JWT (Wave 23, delegated)
  // --------------------------------------------------------------------------

  async generateTenantToken(userId: string, tenantId: string): Promise<string> {
    return generateTenantToken(userId, tenantId);
  }

  async verifyTenantToken(token: string): Promise<JWTPayload | null> {
    return verifyTenantToken(token);
  }

  async refreshTenantToken(
    token: string,
    newTenantId?: string,
  ): Promise<{ token: string; payload: JWTPayload } | null> {
    return refreshTenantToken(token, newTenantId);
  }

  async generateTenantTokenWithRefresh(
    userId: string,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return generateTenantTokenWithRefresh(userId, tenantId);
  }

  async rotateTenantRefreshToken(
    rawRefreshToken: string,
    newTenantId?: string,
  ): Promise<{ accessToken: string; refreshToken: string; payload: JWTPayload } | null> {
    return rotateTenantRefreshToken(rawRefreshToken, newTenantId);
  }

  // --------------------------------------------------------------------------
  // Login (delegated)
  // --------------------------------------------------------------------------

  async login(username: string, password: string, ipAddress?: string): Promise<LoginResult> {
    return login(this.sessions, this.trackSession.bind(this), username, password, ipAddress);
  }

  // -- Account Management (delegated to account-management.ts) --

  async createAdmin(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
    role?: string;
    permissions?: string[];
  }): Promise<AdminUser> {
    return createAdminFn(data);
  }

  async updateAdmin(
    id: string,
    data: {
      displayName?: string;
      email?: string;
      role?: string;
      permissions?: string[];
    },
  ): Promise<AdminUser | null> {
    return updateAdminFn(id, data);
  }

  async deactivateAdmin(id: string): Promise<boolean> {
    return deactivateAdminFn(id);
  }
  async resetPassword(id: string, newPassword: string): Promise<boolean> {
    return resetPasswordFn(id, newPassword);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    return changePasswordFn(id, currentPassword, newPassword);
  }

  async unlockAccount(id: string): Promise<boolean> {
    return unlockAccountFn(id);
  }
  async listAdmins(): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>[]> {
    return listAdminsFn();
  }
  async getAdminById(id: string): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'> | null> {
    return getAdminByIdFn(id);
  }

  // --------------------------------------------------------------------------
  // Session Tracking (In-Memory)
  // --------------------------------------------------------------------------

  trackSession(
    sessionId: string,
    data: {
      adminId: string;
      username: string;
      role: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): void {
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

  // -- Default Admin Seeding --

  async seedDefaultAdmin(): Promise<void> {
    return seedDefaultAdminFn((pw) => hashPassword(pw));
  }
}
