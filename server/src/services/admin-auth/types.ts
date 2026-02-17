/**
 * Admin Authentication Types
 *
 * Type definitions for admin authentication, sessions, and JWT payloads.
 */

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

export interface AdminSession {
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

export const BCRYPT_ROUNDS = 12;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const ACCESS_TOKEN_EXPIRY_S = 8 * 60 * 60; // 8 hours
export const REFRESH_TOKEN_EXPIRY_S = 7 * 24 * 60 * 60; // 7 days
export const TENANT_TOKEN_EXPIRY_S = 24 * 60 * 60; // 24 hours (tenant-aware tokens)
