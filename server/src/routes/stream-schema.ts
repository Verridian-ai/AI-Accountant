import { Hono } from 'hono';
import { db } from '../schema.js';
import { sql } from 'drizzle-orm';
import { getErrorMessage } from '../utils/error.js';
import type { AgentType } from '../services/claude/types.js';
import { ALL_AGENT_TYPES } from './agent-routes-extended/routes-status.js';
import { StreamingService } from '../services/claude/streaming.js';
import { StreamingRegistry } from '../services/streaming-registry.js';
import { SchemaRegistry } from '../services/claude/schemas/schema-registry.js';
import { sseStreamMiddleware, streamingRateLimiter } from '../services/streaming-middleware.js';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import crypto from 'crypto';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const streamSchemaRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
streamSchemaRoutes.use('/*', tenantAuthMiddleware());
const streamingService = new StreamingService();
const streamingRegistry = new StreamingRegistry();
const schemaRegistry = new SchemaRegistry();
schemaRegistry.initializeDefaults();

const agentStreamInputSchema = z
  .object({
    query: z.string().optional(),
    userId: z.string().optional(),
  })
  .passthrough();

const schemaValidateInputSchema = z.object({ output: z.any() });

// POST /api/stream/agent/:agentType
streamSchemaRoutes.post(
  '/stream/agent/:agentType',
  sseStreamMiddleware(),
  streamingRateLimiter(),
  zValidator('json', agentStreamInputSchema),
  async (c) => {
    try {
      const agentType = c.req.param('agentType');
      const input = c.req.valid('json');
      const userId = c.req.query('userId') || 'default';

      const agent = streamingRegistry.getAgent(agentType as AgentType);
      if (!agent) {
        return c.json({ error: `Agent ${agentType} not available for streaming` }, 404);
      }

      const sessionId = crypto.randomUUID();
      try {
        await db.run(sql`INSERT INTO agent_stream_sessions (id, agent_type, user_id, session_status, input_payload, model_id, provider, stream_started_at)
            VALUES (${sessionId}, ${agentType}, ${userId}, 'streaming', ${JSON.stringify(input)}, 'auto', 'anthropic', NOW())`);
      } catch {
        // Table may not exist yet — continue without session tracking
      }

      return streamingService.handleSSE(c, async (writer) => {
        const startMs = Date.now();
        try {
          writer.sendAgentSelected(agentType, 1.0);
          let fullText = '';
          for await (const chunk of agent.stream(input)) {
            writer.sendToken(chunk);
            fullText += chunk;
          }
          const latencyMs = Date.now() - startMs;
          writer.sendComplete({ agentType, status: 'completed', latencyMs });
          try {
            await db.run(sql`UPDATE agent_stream_sessions
                SET session_status = 'completed', output_payload = ${JSON.stringify({ text: fullText })},
                    latency_ms = ${latencyMs}, stream_completed_at = NOW(), updated_at = NOW()
                WHERE id = ${sessionId}`);
          } catch {
            // Session tracking is best-effort
          }
        } catch (err: unknown) {
          writer.sendError(getErrorMessage(err) || 'Stream failed');
          try {
            await db.run(sql`UPDATE agent_stream_sessions
                SET session_status = 'failed', error_message = ${getErrorMessage(err) || 'Stream failed'}, updated_at = NOW()
                WHERE id = ${sessionId}`);
          } catch {
            // Session tracking is best-effort
          }
        }
      });
    } catch (err) {
      console.error('Stream agent failed:', err);
      return c.json({ error: 'Failed to start stream' }, 500);
    }
  },
);

// POST /api/schemas/:agentType/validate
streamSchemaRoutes.post(
  '/schemas/:agentType/validate',
  zValidator('json', schemaValidateInputSchema),
  async (c) => {
    try {
      const rawAgentType = c.req.param('agentType');
      if (!ALL_AGENT_TYPES.includes(rawAgentType as AgentType)) {
        return c.json({ error: `Invalid agent type: ${rawAgentType}` }, 400);
      }
      const agentType = rawAgentType as AgentType;
      const { output } = c.req.valid('json');
      if (output === undefined)
        return c.json({ error: 'Request body must include "output" field' }, 400);
      const result = schemaRegistry.validateOutput(agentType, output);
      schemaRegistry.updateStats(agentType, result.valid);
      return c.json({ agentType, valid: result.valid, errors: result.errors?.issues ?? null });
    } catch (err) {
      console.error('Schema validation failed:', err);
      return c.json({ error: 'Failed to validate output' }, 500);
    }
  },
);

// GET /api/schemas/:agentType/stats
streamSchemaRoutes.get('/schemas/:agentType/stats', async (c) => {
  try {
    const agentType = c.req.param('agentType');
    const row = await db.get(sql`SELECT agent_type as "agentType", schema_name as "schemaName",
        schema_version as "schemaVersion", validation_stats as "validationStats",
        is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
        FROM structured_output_schemas WHERE agent_type = ${agentType}`);
    if (row) return c.json(row);
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

// GET /api/migration/status
streamSchemaRoutes.get('/migration/status', async (c) => {
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

// GET /api/migration/status/:agentType
streamSchemaRoutes.get('/migration/status/:agentType', async (c) => {
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
    if (!status) return c.json({ error: `No migration status found for agent: ${agentType}` }, 404);
    return c.json(status);
  } catch (err) {
    console.error('Get migration status failed:', err);
    return c.json({ error: 'Failed to get migration status' }, 500);
  }
});

// GET /api/migration/benchmarks
streamSchemaRoutes.get('/migration/benchmarks', async (c) => {
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
        improvement: { latencyPercent: latencyImprovement, errorRatePercent: errorRateImprovement },
      };
    });
    return c.json({ benchmarks });
  } catch (err) {
    console.error('Get migration benchmarks failed:', err);
    return c.json({ benchmarks: [] });
  }
});

// POST /api/migration/rollback/:agentType
streamSchemaRoutes.post('/migration/rollback/:agentType', async (c) => {
  try {
    const agentType = c.req.param('agentType');
    const existing = await db.get(sql`SELECT id, migration_phase as "migrationPhase"
        FROM agent_migration_status WHERE agent_type = ${agentType}`);
    if (!existing)
      return c.json({ error: `No migration status found for agent: ${agentType}` }, 404);
    await db.run(sql`UPDATE agent_migration_status
        SET migration_phase = 'legacy', rollback_count = rollback_count + 1, updated_at = NOW()
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
});

export default streamSchemaRoutes;
