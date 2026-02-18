/**
 * Tenant Service — Invitations and Context Switching
 */

import { db, tenantMembers, tenantInvitations } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import type { Tenant, TenantMember, TenantInvitation, TenantContext, TenantRole } from './types.js';
import { TENANT_ROLES } from './types.js';
import { INVITATION_EXPIRY_MS, rowToInvitation } from './helpers.js';
import {
  addMember,
  getTenant,
  getSubscriptionInfo,
  getMemberCount,
  getPermissionsForRole,
} from './tenant-crud.js';

export async function inviteMember(
  tenantId: string,
  email: string,
  role: TenantRole,
  invitedBy: string,
): Promise<TenantInvitation> {
  if (!TENANT_ROLES.includes(role)) throw new Error(`Invalid role: ${role}`);
  const existing = await db
    .select()
    .from(tenantInvitations)
    .where(
      and(
        eq(tenantInvitations.tenantId, tenantId),
        eq(tenantInvitations.email, email),
        eq(tenantInvitations.status, 'pending'),
      ),
    )
    .get();
  if (existing) throw new Error(`A pending invitation already exists for ${email} in this tenant`);
  const sub = await getSubscriptionInfo(tenantId);
  const memberCount = await getMemberCount(tenantId);
  const pendingCount = await getPendingInvitationCount(tenantId);
  if (memberCount + pendingCount >= sub.maxMembers)
    throw new Error(
      `Member limit would be exceeded (${sub.maxMembers} on ${sub.planName} plan). Upgrade your subscription to invite more members.`,
    );
  const now = new Date().toISOString();
  const invitationId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS).toISOString();
  await db
    .insert(tenantInvitations)
    .values({
      id: invitationId,
      tenantId,
      email,
      role,
      invitedBy,
      token,
      status: 'pending',
      expiresAt,
      createdAt: now,
    })
    .run();
  const row = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.id, invitationId))
    .get();
  return rowToInvitation(row);
}

export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<{ tenant: Tenant; member: TenantMember }> {
  const invitation = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.token, token))
    .get();
  if (!invitation) throw new Error('Invalid invitation token');
  if (invitation.status !== 'pending')
    throw new Error(`Invitation has already been ${invitation.status}`);
  const expiresAt = new Date(invitation.expiresAt ?? invitation.expires_at);
  if (expiresAt < new Date()) {
    await db
      .update(tenantInvitations)
      .set({ status: 'expired' })
      .where(eq(tenantInvitations.id, invitation.id))
      .run();
    throw new Error('Invitation has expired');
  }
  const tenantId = invitation.tenantId ?? invitation.tenant_id;
  const role = (invitation.role ?? 'viewer') as TenantRole;
  const member = await addMember(
    tenantId,
    userId,
    role,
    invitation.invitedBy ?? invitation.invited_by,
  );
  const now = new Date().toISOString();
  await db
    .update(tenantInvitations)
    .set({ status: 'accepted', acceptedAt: now })
    .where(eq(tenantInvitations.id, invitation.id))
    .run();
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error('Tenant not found after accepting invitation');
  return { tenant, member };
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const invitation = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.id, invitationId))
    .get();
  if (!invitation) throw new Error('Invitation not found');
  if (invitation.status !== 'pending') throw new Error('Can only revoke pending invitations');
  await db
    .update(tenantInvitations)
    .set({ status: 'revoked' })
    .where(eq(tenantInvitations.id, invitationId))
    .run();
}

export async function getPendingInvitations(tenantId: string): Promise<TenantInvitation[]> {
  const rows = await db
    .select()
    .from(tenantInvitations)
    .where(and(eq(tenantInvitations.tenantId, tenantId), eq(tenantInvitations.status, 'pending')))
    .all();
  return rows.map(rowToInvitation);
}

export async function cleanupExpiredInvitations(): Promise<number> {
  const now = new Date().toISOString();
  const expired = await db
    .select()
    .from(tenantInvitations)
    .where(eq(tenantInvitations.status, 'pending'))
    .all();
  let count = 0;
  for (const inv of expired) {
    const expiresAt = inv.expiresAt ?? inv.expires_at;
    if (expiresAt && new Date(expiresAt) < new Date(now)) {
      await db
        .update(tenantInvitations)
        .set({ status: 'expired' })
        .where(eq(tenantInvitations.id, inv.id))
        .run();
      count++;
    }
  }
  return count;
}

async function getPendingInvitationCount(tenantId: string): Promise<number> {
  const rows = await db
    .select()
    .from(tenantInvitations)
    .where(and(eq(tenantInvitations.tenantId, tenantId), eq(tenantInvitations.status, 'pending')))
    .all();
  return rows.length;
}

export async function switchTenant(userId: string, tenantId: string): Promise<TenantContext> {
  return getTenantContext(userId, tenantId);
}

export async function getTenantContext(userId: string, tenantId: string): Promise<TenantContext> {
  const member = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .get();
  if (!member) throw new Error('User is not a member of this tenant');
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  if (!tenant.isActive) throw new Error('Tenant has been deactivated');
  const role = (member.role ?? 'viewer') as TenantRole;
  const perms = await getPermissionsForRole(tenantId, role);
  const subscription = await getSubscriptionInfo(tenantId);
  await db
    .update(tenantMembers)
    .set({ lastActiveAt: new Date().toISOString() })
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .run();
  return { tenant, role, permissions: perms, subscription };
}

export async function getDefaultTenant(userId: string): Promise<Tenant | null> {
  const memberships = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .orderBy(tenantMembers.joinedAt)
    .all();
  if (!memberships || memberships.length === 0) return null;
  const first = memberships[0];
  return getTenant(first.tenantId ?? first.tenant_id);
}
