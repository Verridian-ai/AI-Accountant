/**
 * Account Management — Create, update, deactivate, reset password, list admins.
 */

import crypto from 'crypto';
import { db } from '../../schema.js';
import { adminUsers, type AdminUser } from '../../db/admin-schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';
import { config } from '../../lib/config.js';
import { hashPassword, validatePassword } from './authentication.js';

export async function createAdmin(data: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  role?: string;
  permissions?: string[];
}): Promise<AdminUser> {
  const validation = validatePassword(data.password);
  if (!validation.valid) {
    throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
  }
  const passwordHash = await hashPassword(data.password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(adminUsers)
    .values({
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
    })
    .run();
  return (await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get())!;
}

export async function updateAdmin(
  id: string,
  data: { displayName?: string; email?: string; role?: string; permissions?: string[] },
): Promise<AdminUser | null> {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
  if (!existing) return null;
  const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.permissions !== undefined) updateData.permissions = JSON.stringify(data.permissions);
  await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, id)).run();
  return db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
}

export async function deactivateAdmin(id: string): Promise<boolean> {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
  if (!existing) return false;
  await db
    .update(adminUsers)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(adminUsers.id, id))
    .run();
  return true;
}

export async function resetPassword(id: string, newPassword: string): Promise<boolean> {
  const validation = validatePassword(newPassword);
  if (!validation.valid) throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
  if (!existing) return false;
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(adminUsers)
    .set({ passwordHash, updatedAt: new Date().toISOString() })
    .where(eq(adminUsers.id, id))
    .run();
  return true;
}

export async function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const { verifyPassword } = await import('./authentication.js');
  const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
  if (!admin || !admin.passwordHash) return { success: false, error: 'Admin not found' };
  const currentValid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!currentValid) return { success: false, error: 'Current password is incorrect' };
  const validation = validatePassword(newPassword);
  if (!validation.valid) return { success: false, error: validation.errors.join(', ') };
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(adminUsers)
    .set({ passwordHash, updatedAt: new Date().toISOString() })
    .where(eq(adminUsers.id, id))
    .run();
  return { success: true };
}

export async function unlockAccount(id: string): Promise<boolean> {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
  if (!existing) return false;
  await db
    .update(adminUsers)
    .set({ lockedUntil: null, failedLoginCount: 0, updatedAt: new Date().toISOString() })
    .where(eq(adminUsers.id, id))
    .run();
  return true;
}

export async function listAdmins(): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'>[]> {
  const admins = await db.select().from(adminUsers).all();
  return admins.map((a: AdminUser) => {
    const { passwordHash: _passwordHash, mfaSecret: _mfaSecret, ...rest } = a;
    return rest;
  });
}

export async function getAdminById(
  id: string,
): Promise<Omit<AdminUser, 'passwordHash' | 'mfaSecret'> | null> {
  const admin = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).get();
  if (!admin) return null;
  const { passwordHash: _passwordHash, mfaSecret: _mfaSecret, ...rest } = admin;
  return rest;
}

export async function seedDefaultAdmin(hashFn: (pw: string) => Promise<string>): Promise<void> {
  try {
    const existing = await db.select().from(adminUsers).all();
    if (existing.length > 0) {
      logger.info('[AdminAuth] Admin users already exist, skipping seed.');
      return;
    }
    const defaultPassword = config.adminDefaultPassword || crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashFn(defaultPassword);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .insert(adminUsers)
      .values({
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
      })
      .run();
    if (config.adminDefaultPassword) {
      logger.info(
        '[AdminAuth] Default admin seeded (username: admin, password from ADMIN_DEFAULT_PASSWORD env)',
      );
    } else {
      logger.info(
        `[AdminAuth] Default admin seeded (username: admin, password: ${defaultPassword})`,
      );
      logger.info(
        '[AdminAuth] IMPORTANT: Save this password! Set ADMIN_DEFAULT_PASSWORD env var for production.',
      );
    }
  } catch (err: any) {
    logger.warn('[AdminAuth] Could not seed default admin:', err.message || err);
  }
}
