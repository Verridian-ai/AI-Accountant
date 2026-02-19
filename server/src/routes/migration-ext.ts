import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../schema.js';
import { sql } from 'drizzle-orm';
import { schemaRegistry } from '../services/singletons.js';
import type { AgentType } from '../services/claude/types.js';
import { ALL_AGENT_TYPES } from './agent-routes-extended/routes-status.js';
import { adminAuthMiddleware } from '../services/admin-auth/index.js';

const migrationExtRoutes = new Hono();

const schemaValidateBodySchema = z.object({ output: z.any() });

// Apply admin auth to all routes — schema validation and migration management are admin-only
migrationExtRoutes.use('/*', adminAuthMiddleware());

// POST /api/schemas/:agentType/validate — Validate output against schema
migrationExtRoutes.post(
  '/schemas/:agentType/validate',
  zValidator('json', schemaValidateBodySchema),
  async (c) => {
    try {
      const rawAgentType = c.req.param('agentType');
      if (!ALL_AGENT_TYPES.includes(rawAgentType as AgentType)) {
        return c.json({ error: `Invalid agent type: ${rawAgentType}` }, 400);
      }
      const agentType = rawAgentType as AgentType;
      const { output } = c.req.valid('json');
      if (output === undefined) {
        return c.json({ error: 'Request body must include "output" field' }, 400);
      }
      const result = schemaRegistry.validateOutput(agentType, output);
      schemaRegistry.updateStats(agentType, result.valid);
      return c.json({
        agentType,
        valid: result.valid,
        errors: result.errors?.issues ?? null,
      });
    } catch (err) {
      console.error('Schema validation failed:', err);
      return c.json({ error: 'Failed to validate output' }, 500);
    }
  },
);

// GET /api/schemas/:agentType/stats — Get validation stats
migrationExtRoutes.get('/schemas/:agentType/stats', async (c) => {
  try {
    const agentType = c.req.param('agentType');
    const row = await db.get(sql`SELECT agent_type as "agentType", schema_name as "schemaName",
            schema_version as "schemaVersion", validation_stats as "validationStats",
            is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
            FROM structured_output_schemas WHERE agent_type = ${agentType}`);
    if (row) {
      return c.json(row);
    }
    const schemaList = schemaRegistry.listSchemas();
    const meta = schemaList.find((s) => s.agentType === agentType);
    return c.json({
      agentType,
      schemaName: meta?.name ?? null,
      schemaVersion: meta?.version ?? null,
      validationStats: { total: 0, passed: 0, failed: 0 },
      isActive: !!meta,
    });
  } catch (err) {
    console.error('Get schema stats failed:', err);
    return c.json({
      agentType: c.req.param('agentType'),
      validationStats: { total: 0, passed: 0, failed: 0 },
    });
  }
});

// GET /api/migration/status — List all agent migration statuses
migrationExtRoutes.get('/migration/status', async (c) => {
  try {
    const statuses =
      await db.all(sql`SELECT id, agent_type as "agentType", legacy_class as "legacyClass",
            vercel_class as "vercelClass", migration_phase as "migrationPhase",
            legacy_invocations as "legacyInvocations", vercel_invocations as "vercelInvocations",
            error_rate_legacy as "errorRateLegacy", error_rate_vercel as "errorRateVercel",
            avg_latency_legacy_ms as "avgLatencyLegacyMs", avg_latency_vercel_ms as "avgLatencyVercelMs",
            migrated_at as "migratedAt", rollback_count as "rollbackCount",
            created_at as "createdAt", updated_at as "updatedAt"
            FROM agent_migration_status ORDER BY agent_type`);
    return c.json({ statuses });
  } catch (err) {
    console.error('Get migration statuses failed:', err);
    return c.json({ statuses: [] });
  }
});

// GET /api/migration/status/:agentType — Get specific agent status
migrationExtRoutes.get('/migration/status/:agentType', async (c) => {
  try {
    const agentType = c.req.param('agentType');
    const status =
      await db.get(sql`SELECT id, agent_type as "agentType", legacy_class as "legacyClass",
            vercel_class as "vercelClass", migration_phase as "migrationPhase",
            legacy_invocations as "legacyInvocations", vercel_invocations as "vercelInvocations",
            error_rate_legacy as "errorRateLegacy", error_rate_vercel as "errorRateVercel",
            avg_latency_legacy_ms as "avgLatencyLegacyMs", avg_latency_vercel_ms as "avgLatencyVercelMs",
            migrated_at as "migratedAt", rollback_count as "rollbackCount",
            created_at as "createdAt", updated_at as "updatedAt"
            FROM agent_migration_status WHERE agent_type = ${agentType}`);
    if (!status) {
      return c.json({ error: `No migration status found for agent: ${agentType}` }, 404);
    }
    return c.json(status);
  } catch (err) {
    console.error('Get migration status failed:', err);
    return c.json({ error: 'Failed to get migration status' }, 500);
  }
});

// GET /api/migration/benchmarks — Compare legacy vs Vercel metrics
migrationExtRoutes.get('/migration/benchmarks', async (c) => {
  try {
    const statuses: Array<{
      agentType: string;
      migrationPhase: string;
      legacyInvocations: number;
      vercelInvocations: number;
      errorRateLegacy: number;
      errorRateVercel: number;
      avgLatencyLegacyMs: number;
      avgLatencyVercelMs: number;
    }> = await db.all(sql`SELECT agent_type as "agentType",
            migration_phase as "migrationPhase",
            legacy_invocations as "legacyInvocations", vercel_invocations as "vercelInvocations",
            error_rate_legacy as "errorRateLegacy", error_rate_vercel as "errorRateVercel",
            avg_latency_legacy_ms as "avgLatencyLegacyMs", avg_latency_vercel_ms as "avgLatencyVercelMs"
            FROM agent_migration_status ORDER BY agent_type`);

    const benchmarks = statuses.map((s) => {
      const latencyImprovement =
        s.avgLatencyLegacyMs && s.avgLatencyVercelMs
          ? Math.round(((s.avgLatencyLegacyMs - s.avgLatencyVercelMs) / s.avgLatencyLegacyMs) * 100)
          : null;
      const errorRateImprovement =
        s.errorRateLegacy > 0 && s.errorRateVercel >= 0
          ? Math.round(((s.errorRateLegacy - s.errorRateVercel) / s.errorRateLegacy) * 100)
          : null;
      return {
        agentType: s.agentType,
        migrationPhase: s.migrationPhase,
        legacy: {
          invocations: s.legacyInvocations,
          errorRate: s.errorRateLegacy,
          avgLatencyMs: s.avgLatencyLegacyMs,
        },
        vercel: {
          invocations: s.vercelInvocations,
          errorRate: s.errorRateVercel,
          avgLatencyMs: s.avgLatencyVercelMs,
        },
        improvement: {
          latencyPercent: latencyImprovement,
          errorRatePercent: errorRateImprovement,
        },
      };
    });

    return c.json({ benchmarks });
  } catch (err) {
    console.error('Get migration benchmarks failed:', err);
    return c.json({ benchmarks: [] });
  }
});

// POST /api/migration/rollback/:agentType — Force rollback to legacy
migrationExtRoutes.post(
  '/migration/rollback/:agentType',
  zValidator('json', z.object({}).optional()),
  async (c) => {
    try {
      const agentType = c.req.param('agentType');

      const existing = await db.get(sql`SELECT id, migration_phase as "migrationPhase"
            FROM agent_migration_status WHERE agent_type = ${agentType}`);
      if (!existing) {
        return c.json({ error: `No migration status found for agent: ${agentType}` }, 404);
      }

      await db.run(sql`UPDATE agent_migration_status
            SET migration_phase = 'legacy',
                rollback_count = rollback_count + 1,
                updated_at = NOW()
            WHERE agent_type = ${agentType}`);

      return c.json({
        success: true,
        agentType,
        migrationPhase: 'legacy',
        message: `Agent ${agentType} rolled back to legacy implementation`,
      });
    } catch (err) {
      console.error('Migration rollback failed:', err);
      return c.json({ error: 'Failed to rollback agent' }, 500);
    }
  },
);

export default migrationExtRoutes;
