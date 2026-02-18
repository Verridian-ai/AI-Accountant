/**
 * Tenant-Aware JWT — Generate, verify, and refresh tenant-scoped tokens.
 */

import { sign, verify } from 'hono/jwt';
import { db, tenantMembers, tenants, rolePermissions, permissions } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import type { TenantRole } from '../tenant-types.js';
import type { JWTPayload } from '../auth-types.js';
import { TENANT_TOKEN_EXPIRY_S } from './types.js';
import { getTenantJwtSecret } from './authentication.js';

async function _getTenantPermissions(tenantId: string, role: TenantRole): Promise<string[]> {
  const rps = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.role, role)))
    .all();
  const permIds: string[] = rps
    .map((rp: { permissionId?: string | null; permission_id?: string | null }) =>
      String(rp.permissionId ?? rp.permission_id ?? ''),
    )
    .filter(Boolean);
  if (permIds.length === 0) return [];
  const allPerms = await db.select().from(permissions).all();
  const permMap = new Map<string, string>();
  for (const p of allPerms) {
    permMap.set(p.id, p.name);
  }
  return permIds.map((id) => permMap.get(id)).filter((name): name is string => !!name);
}

export async function generateTenantToken(userId: string, tenantId: string): Promise<string> {
  const member = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .get();
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
  const tenant = await db.select().from(tenants).where(eq(tenants.id, targetTenantId)).get();
  if (!tenant) return null;
  const tenantRow = tenant as Record<string, unknown>;
  const isActive = tenantRow.isActive ?? tenantRow.is_active ?? true;
  if (!isActive) return null;
  const member = await db
    .select()
    .from(tenantMembers)
    .where(
      and(eq(tenantMembers.tenantId, targetTenantId), eq(tenantMembers.userId, existing.userId)),
    )
    .get();
  if (!member) return null;
  const newToken = await generateTenantToken(existing.userId, targetTenantId);
  const newPayload = await verifyTenantToken(newToken);
  return newPayload ? { token: newToken, payload: newPayload } : null;
}
