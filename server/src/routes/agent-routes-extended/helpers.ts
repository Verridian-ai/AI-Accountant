import { z } from 'zod';
import { isClaudeAgentsEnabled, isAgentEnabled } from '../../services/claude/config.js';
import type { AgentType } from '../../services/claude/types.js';

export function ensureEnabled(
  agentType: AgentType,
): { ok: true } | { ok: false; status: number; body: { error: string } } {
  if (!isClaudeAgentsEnabled()) {
    return { ok: false, status: 503, body: { error: 'Claude agents are not enabled' } };
  }
  if (!isAgentEnabled(agentType)) {
    return { ok: false, status: 503, body: { error: `Agent ${agentType} is disabled` } };
  }
  return { ok: true };
}

export function parseBody<T extends z.ZodType>(
  schema: T,
  data: unknown,
):
  | { ok: true; data: z.infer<T> }
  | { ok: false; status: number; body: { error: string; details?: unknown } } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    };
  }
  return { ok: true, data: result.data };
}
