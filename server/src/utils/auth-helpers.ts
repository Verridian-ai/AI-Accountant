/**
 * Auth helpers shared by route files.
 *
 * Extracts the userId from the Hono JWT payload (set by auth middleware).
 * Falls back to 'default-user' when no JWT is present (dev mode).
 */
import type { Context } from 'hono';

export function getUserId(c: Context): string {
  const payload = c.get('jwtPayload') as Record<string, unknown> | undefined;
  return (payload?.userId as string) ?? 'default-user';
}

export function getTenantId(c: Context): string | undefined {
  return c.req.header('X-Tenant-Id') ?? undefined;
}
