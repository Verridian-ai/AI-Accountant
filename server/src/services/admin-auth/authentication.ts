/**
 * Admin Authentication — Login/Logout Logic
 *
 * Handles password hashing, verification, login with lockout,
 * JWT generation/refresh, and session tracking.
 */

import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import crypto from 'crypto';
import { db } from '../../schema.js';
import { adminUsers, type AdminUser } from '../../db/admin-schema.js';
import { eq } from 'drizzle-orm';
import { config } from '../../lib/config.js';
import type { AdminTokenPayload, LoginResult, AdminSession } from './types.js';
import {
  BCRYPT_ROUNDS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  ACCESS_TOKEN_EXPIRY_S,
  REFRESH_TOKEN_EXPIRY_S,
} from './types.js';

// Re-export tenant JWT functions for backward compatibility
export { generateTenantToken, verifyTenantToken, refreshTenantToken } from './tenant-jwt.js';

// ============================================================================
// JWT SECRET HELPERS
// ============================================================================

export function getAdminJwtSecret(): string {
  const secret = config.adminJwtSecret;
  if (!secret) {
    throw new Error('Missing required environment variable: ADMIN_JWT_SECRET');
  }
  return secret;
}

export function getTenantJwtSecret(): string {
  const secret = config.tenantJwtSecret || config.adminJwtSecret;
  if (!secret) {
    throw new Error('Missing required environment variable: TENANT_JWT_SECRET or ADMIN_JWT_SECRET');
  }
  return secret;
}

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// JWT MANAGEMENT
// ============================================================================

export async function generateToken(
  admin: Pick<AdminUser, 'id' | 'username' | 'role' | 'permissions'>,
): Promise<string> {
  const perms =
    typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : admin.permissions;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    permissions: perms,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_S,
  };
  return sign(payload, getAdminJwtSecret());
}

export async function generateRefreshToken(
  admin: Pick<AdminUser, 'id' | 'username' | 'role' | 'permissions'>,
): Promise<string> {
  const perms =
    typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : admin.permissions;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    permissions: perms,
    type: 'refresh',
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY_S,
  };
  return sign(payload, getAdminJwtSecret());
}

export async function verifyToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const payload = (await verify(token, getAdminJwtSecret())) as unknown as AdminTokenPayload;
    if (!payload || !payload.adminId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ token: string; admin: AdminTokenPayload } | null> {
  const payload = await verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') return null;

  // Verify admin still exists and is active
  const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, payload.adminId)).get();
  if (!admin || !admin.isActive) return null;

  const newToken = await generateToken(admin);
  const newPayload = await verifyToken(newToken);
  return newPayload ? { token: newToken, admin: newPayload } : null;
}

// ============================================================================
// LOGIN
// ============================================================================

export async function login(
  sessions: Map<string, AdminSession>,
  trackSession: (
    sessionId: string,
    data: { adminId: string; username: string; role: string; ipAddress?: string },
  ) => void,
  username: string,
  password: string,
  ipAddress?: string,
): Promise<LoginResult> {
  const admin = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).get();

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
    await db
      .update(adminUsers)
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

  const passwordValid = await verifyPassword(password, admin.passwordHash);

  if (!passwordValid) {
    const newFailCount = (admin.failedLoginCount ?? 0) + 1;
    const remaining = MAX_LOGIN_ATTEMPTS - newFailCount;

    const updateData: Record<string, any> = {
      failedLoginCount: newFailCount,
      updatedAt: new Date().toISOString(),
    };

    if (newFailCount >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    }

    await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, admin.id)).run();

    return {
      success: false,
      error:
        remaining > 0
          ? `Invalid credentials. ${remaining} attempt(s) remaining.`
          : 'Account locked due to too many failed attempts.',
      remainingAttempts: Math.max(0, remaining),
    };
  }

  // Success — reset counters and update login info
  await db
    .update(adminUsers)
    .set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
      loginCount: (admin.loginCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(adminUsers.id, admin.id))
    .run();

  const token = await generateToken(admin);
  const refreshToken = await generateRefreshToken(admin);

  // Track session
  const sessionId = crypto.randomUUID();
  trackSession(sessionId, {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    ipAddress,
  });

  const perms =
    typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : admin.permissions;

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
      permissions: perms,
    },
  };
}
