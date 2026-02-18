/**
 * User Account Management — Wave 3 per-user Cognee auth.
 *
 * Exposes HTTP-layer calls for user creation, token retrieval, refresh,
 * and revocation. Token cache management (setupUserAuth, clearUserToken)
 * stays in the CogneeClient class since it mutates private state.
 *
 * All functions take a CogneeClientContext as the first parameter.
 */

import { REQUEST_TIMEOUT_MS } from './config.js';
import type { CogneeClientContext } from './client-context.js';

/**
 * Create a Cognee user account.
 * SECURITY: password is used ONLY for initial account creation and immediate
 * token retrieval. It is NOT stored — only the resulting refresh token is kept.
 */
export async function createCogneeUser(
  ctx: CogneeClientContext,
  email: string,
  password: string,
): Promise<{ userId: string; refreshToken: string }> {
  const adminHeaders = await ctx.authHeaders();
  const response = await fetch(`${ctx.baseUrl}/api/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders,
    },
    body: JSON.stringify({ username: email, password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to create Cognee user: ${response.status}`);
  }
  const result = await response.json();

  const tokens = await getCogneeUserTokens(ctx, email, password);
  return { userId: result.userId ?? result.id, refreshToken: tokens.refreshToken };
}

/**
 * Get Cognee auth tokens for a specific user.
 * Returns BOTH access_token (short-lived, < 15 min) and refresh_token.
 */
export async function getCogneeUserTokens(
  ctx: CogneeClientContext,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(`${ctx.baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Cognee user auth failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    accessToken: data.access_token ?? data.token,
    refreshToken: data.refresh_token ?? data.access_token ?? data.token,
    expiresIn: data.expires_in ?? 900,
  };
}

/**
 * Refresh a Cognee access token using a stored refresh token.
 * This replaces password-based re-auth per D02 CRIT-03.
 */
export async function refreshCogneeToken(
  ctx: CogneeClientContext,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const response = await fetch(`${ctx.baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Cognee token refresh failed: ${response.status}`);
  }
  const data = await response.json();
  return {
    accessToken: data.access_token ?? data.token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? 900,
  };
}

/**
 * Revoke a Cognee user's tokens — call on session expiry/logout.
 * Cache eviction must be done separately in the class (clearUserToken).
 */
export async function revokeUserToken(
  ctx: CogneeClientContext,
  userId: string,
  refreshToken?: string,
): Promise<void> {
  if (refreshToken) {
    try {
      await fetch(`${ctx.baseUrl}/api/v1/auth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      console.warn(`[CogneeClient] Failed to revoke Cognee token for user ${userId}:`, e);
    }
  }
}
