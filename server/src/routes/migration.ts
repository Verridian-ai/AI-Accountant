import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../schema.js';
import { sql } from 'drizzle-orm';
import { SchemaRegistry } from '../services/claude/schemas/schema-registry.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

// Zod type reference for migration status response shape
const _migrationStatusShape = z.object({ agentType: z.string(), status: z.string() });

const migrationRoutes = new Hono();
const schemaRegistry = new SchemaRegistry();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
migrationRoutes.use('/*', tenantAuthMiddleware());

migrationRoutes.get('/schemas', async (c) => {
  return c.json(schemaRegistry.listSchemas());
});

migrationRoutes.get('/schemas/:agentType', async (c) => {
  const schema = schemaRegistry.getSchema(c.req.param('agentType') as any);
  return schema ? c.json(schema) : c.json({ error: 'Not found' }, 404);
});

migrationRoutes.get('/status', async (c) => {
  try {
    const statuses = await db.all(sql`SELECT * FROM agent_migration_status`);
    return c.json({ statuses });
  } catch { return c.json({ statuses: [] }); }
});

migrationRoutes.get('/benchmarks', async (c) => {
  try {
    const statuses = await db.all(sql`SELECT * FROM agent_migration_status`);
    return c.json({ benchmarks: statuses });
  } catch { return c.json({ benchmarks: [] }); }
});

export default migrationRoutes;
