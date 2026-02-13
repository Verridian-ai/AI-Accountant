import { Hono } from 'hono';
import { db, users } from '../schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../auth.js';
import { validateBody, loginSchema, registerSchema, ValidationError } from '../validation/index.js';

const authRoutes = new Hono();

// Auth routes
authRoutes.post('/register', async (c) => {
  let validated;
  try {
    validated = validateBody(registerSchema, await c.req.json());
  } catch (e) {
    if (e instanceof ValidationError) return c.json({ error: e.message, details: e.errors }, 400);
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const { username, password } = validated;

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  try {
    await db.insert(users).values({ id, username, passwordHash });
    const token = await generateToken(id);
    return c.json({ token, user: { id, username } });
  } catch (_err) {
    return c.json({ error: 'Username already exists' }, 400);
  }
});

authRoutes.post('/login', async (c) => {
  let validated;
  try {
    validated = validateBody(loginSchema, await c.req.json());
  } catch (e) {
    if (e instanceof ValidationError) return c.json({ error: e.message, details: e.errors }, 400);
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const { username, password } = validated;
  const user = await db.select().from(users).where(eq(users.username, username)).get();

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await generateToken(user.id);
  return c.json({ token, user: { id: user.id, username: user.username } });
});

authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ error: 'No token' }, 401);

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: 'Invalid token' }, 401);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId as string))
      .get();
    if (!user) return c.json({ error: 'User not found' }, 404);

    return c.json({ user: { id: user.id, username: user.username } });
  } catch (_err) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

export default authRoutes;
