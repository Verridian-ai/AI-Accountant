import type { Context } from 'hono';

export function getUserId(c: Context): string {
  const payload = c.get('jwtPayload' as never) as { userId?: string } | undefined;
  return payload?.userId ?? 'default-user';
}
