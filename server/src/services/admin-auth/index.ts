/**
 * Admin Authentication — Barrel Re-export
 *
 * Re-exports all types, authentication functions, authorization middleware,
 * and the main AdminAuthService class + singleton.
 */

export type { AdminTokenPayload, LoginResult, AdminSession } from './types.js';
export {
  BCRYPT_ROUNDS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  ACCESS_TOKEN_EXPIRY_S,
  REFRESH_TOKEN_EXPIRY_S,
  TENANT_TOKEN_EXPIRY_S,
} from './types.js';

export {
  getAdminJwtSecret,
  getTenantJwtSecret,
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
} from './authentication.js';

export { adminAuthMiddleware } from './authorization.js';

export { AdminAuthService } from './admin-auth-service.js';

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

import { AdminAuthService } from './admin-auth-service.js';

export const adminAuthService = new AdminAuthService();
