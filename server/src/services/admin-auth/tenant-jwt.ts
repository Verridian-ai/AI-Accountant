/**
 * Tenant-Aware JWT — Generate, verify, and refresh tenant-scoped tokens.
 */

import { sign, verify } from 'hono/jwt';
import {
  db,
  tenantMembers,
  tenants,
  rolePermissions,
  permissions,
  sessions,
} from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { TenantRole } from '../tenant-types.js';
import type { JWTPayload } from '../auth-types.js';
import { TENANT_TOKEN_EXPIRY_S, REFRESH_TOKEN_EXPIRY_S } from './types.js';
import { getTenantJwtSecret } from './authentication.js';

async function _getTenantPermissions(tenantId: string, role: TenantRole): Promise<string[]> {
  const rps = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)));
  const permIds: string[] = rps
    .map((rp: { permissionId?: string | null; permission_id?: string | null }) =>
      String(rp.permissionId ?? rp.permission_id ?? ''),
    )
    .filter(Boolean);
  if (permIds.length === 0) return [];
  const allPerms = await db.select().from(permissions);
  const permMap = new Map<string, string>();
  for (const p of allPerms) {
    permMap.set(p.id, p.name);
  }
  return permIds.map((id) => permMap.get(id)).filter((name): name is string => !!name);
}

export async function generateTenantToken(userId: string, tenantId: string): Promise<string> {
  const member = (
    await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
  )[0];
  if (!member) throw new Error('User is not a member of this tenant');
  const role = ((member as Record<string, unknown>).role ?? 'viewer') as TenantRole;
  const permList = await _getTenantPermissions(tenantId, role);
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

export async function verifyTenantToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = (await verify(token, getTenantJwtSecret())) as unknown as JWTPayload;
    if (!payload || !payload.userId || !payload.tenantId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function refreshTenantToken(
  token: string,
  newTenantId?: string,
): Promise<{ token: string; payload: JWTPayload } | null> {
  const existing = await verifyTenantToken(token);
  if (!existing) return null;
  const targetTenantId = newTenantId ?? existing.tenantId;
  const tenant = (await db.select().from(tenants).where(eq(tenants.id, targetTenantId)))[0];
  if (!tenant) return null;
  const tenantRow = tenant as Record<string, unknown>;
  const isActive = tenantRow.isActive ?? tenantRow.is_active ?? true;
  if (!isActive) return null;
  const member = (
    await db
      .select()
      .from(tenantMembers)
      .where(
        and(eq(tenantMembers.tenantId, targetTenantId), eq(tenantMembers.userId, existing.userId)),
      )
  )[0];
  if (!member) return null;
  const newToken = await generateTenantToken(existing.userId, targetTenantId);
  const newPayload = await verifyTenantToken(newToken);
  return newPayload ? { token: newToken, payload: newPayload } : null;
}

// ============================================================================
// REFRESH TOKEN ROTATION (HIGH-05)
// ============================================================================

function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Generate an access + refresh token pair, storing the refresh hash in sessions. */
export async function generateTenantTokenWithRefresh(
  userId: string,
  tenantId: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await generateTenantToken(userId, tenantId);
  const rawRefreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_S * 1000);

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tenantId,
    refreshTokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

/**
 * Rotate a refresh token: invalidate old session, issue new token pair.
 * Returns null if the token is invalid, already used, or expired.
 */
export async function rotateTenantRefreshToken(
  rawRefreshToken: string,
  newTenantId?: string,
): Promise<{ accessToken: string; refreshToken: string; payload: JWTPayload } | null> {
  const hash = hashRefreshToken(rawRefreshToken);
  const now = new Date().toISOString();

  // Find valid session by refresh token hash
  const allSessions = await db.select().from(sessions).where(eq(sessions.refreshTokenHash, hash));
  const session = allSessions[0];

  if (!session) return null;
  if (session.revokedAt) return null; // already used — potential token reuse attack
  if (session.expiresAt < now) return null; // expired

  // Revoke old session (single-use enforcement)
  await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, session.id));

  // Determine target tenant
  const targetTenantId = newTenantId ?? session.tenantId;
  if (!targetTenantId) return null;

  // Verify tenant is still active
  const tenant = (await db.select().from(tenants).where(eq(tenants.id, targetTenantId)))[0];
  if (!tenant) return null;
  const tenantRow = tenant as Record<string, unknown>;
  const isActive = tenantRow.isActive ?? tenantRow.is_active ?? true;
  if (!isActive) return null;

  // Verify user is still a member
  const member = (
    await db
      .select()
      .from(tenantMembers)
      .where(
        and(eq(tenantMembers.tenantId, targetTenantId), eq(tenantMembers.userId, session.userId)),
      )
  )[0];
  if (!member) return null;

  // Issue new token pair
  const result = await generateTenantTokenWithRefresh(session.userId, targetTenantId);
  const payload = await verifyTenantToken(result.accessToken);
  if (!payload) return null;

  return { accessToken: result.accessToken, refreshToken: result.refreshToken, payload };
}
