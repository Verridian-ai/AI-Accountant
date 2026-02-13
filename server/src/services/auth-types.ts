/**
 * Auth Types for Tenant-Aware Authentication (Wave 23)
 *
 * Defines JWT payload, authenticated context, and login request/response
 * types used by the tenant auth middleware and admin-auth service.
 */

import type { TenantRole } from './tenant-types.js';

// ============================================================================
// JWT PAYLOAD
// ============================================================================

/** Claims embedded in tenant-aware JWT tokens */
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: TenantRole;
  permissions: string[];
  iat: number;
  exp: number;
}

// ============================================================================
// CONTEXT
// ============================================================================

/** Authenticated user context attached to Hono request context */
export interface AuthenticatedContext {
  userId: string;
  tenantId: string;
  role: TenantRole;
  permissions: string[];
}

// ============================================================================
// LOGIN / RESPONSE
// ============================================================================

/** Login request body for tenant-aware auth */
export interface LoginRequest {
  email: string;
  password: string;
  tenantId?: string; // Optional: auto-selects default tenant if omitted
}

/** Successful login response with tenant context */
export interface LoginResponse {
  token: string;
  user: { id: string; email: string; name: string };
  tenant: { id: string; name: string; slug: string };
  role: TenantRole;
  permissions: string[];
}
