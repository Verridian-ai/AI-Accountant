# Wave 21 — Vercel AI SDK Migration & Streaming — Orchestration Prompt

You are the **Team Lead** for Wave 21: Vercel AI SDK Migration & Streaming. You coordinate 10 specialized agents to adopt the Vercel AI SDK (v6) incrementally alongside the existing ClaudeAgent base class, enabling structured output, streaming responses, and modern agent patterns.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **SDK comparison**: `wave0-research/R05-agent-sdk-comparison.md`
- **Existing base class**: `server/src/services/claude/base-agent.ts`
- **Orchestrator**: `server/src/services/claude/orchestrator.ts`

## Current State (After Wave 20)
- 25 Claude agents all using ClaudeAgent<TInput, TOutput> base class
- No streaming — all responses are full-batch
- No structured output validation (agents return raw JSON)
- Admin dashboard provides agent monitoring
- 22 migrations (0009–0032) applied

## Dependencies
- **Requires**: Wave 20 (admin dashboard for monitoring migrated agents)
- **Estimated Complexity**: HIGH (framework-level refactor)

## SDK Migration Strategy (from R05 research)

### Recommendation: HYBRID approach
- **Keep** `ClaudeAgent<TInput, TOutput>` base class for existing agents
- **Add** Vercel AI SDK for new agent patterns: streaming, structured output, tool calling
- **Create** `VercelAgent<TInput, TOutput>` wrapper that provides ClaudeAgent-compatible interface
- **Migrate** 3 pilot agents first, then remaining agents in batches

### Dependencies to Install
```json
{
  "ai": "^6.0.0",
  "@ai-sdk/anthropic": "^2.0.0",
  "zod": "^3.23.0"
}
```

## Database Schema Changes

### New Tables (3 tables)
| Table | Columns |
|-------|---------|
| `agent_stream_sessions` | id, userId, agentType, status (streaming/completed/error), messageCount, tokensIn, tokensOut, startedAt, endedAt |
| `structured_output_schemas` | id, agentType, schemaName, zodSchema (JSON), version, isActive, createdAt |
| `agent_migration_status` | id, agentType, framework (legacy/vercel/hybrid), migratedAt, migratedBy, rollbackAvailable, notes |

**Migration**: `docker/migrations/0033_vercel_ai_sdk.sql`

## API Endpoints (12 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/chat/stream | Streaming chat endpoint (SSE) |
| POST | /api/agents/:type/stream | Stream agent execution |
| GET | /api/agents/:type/stream/:sessionId | Get stream session status |
| POST | /api/agents/:type/structured | Structured output execution |
| GET | /api/agents/schemas | List output schemas |
| POST | /api/agents/schemas | Register output schema |
| GET | /api/agents/migration-status | Migration status for all agents |
| POST | /api/agents/:type/migrate | Trigger migration for agent |
| POST | /api/agents/:type/rollback | Rollback to legacy framework |
| GET | /api/agents/:type/benchmark | Compare legacy vs Vercel performance |
| POST | /api/agents/generate-object | Generate structured object from prompt |
| POST | /api/agents/generate-text | Generate text with streaming |

## UI Components
### Updates to existing components
- ChatInterface.tsx — UPDATE: Add streaming message rendering (token-by-token)
- AgentDetail.tsx (admin) — UPDATE: Show framework type (legacy/vercel/hybrid)

### `client/src/features/streaming/` — New feature folder
- StreamingChat.tsx — Real-time streaming chat with typing indicator
- StreamingIndicator.tsx — Animated streaming status indicator
- StructuredOutputViewer.tsx — Formatted structured output display
- AgentMigrationPanel.tsx — Admin: migrate/rollback agents
- BenchmarkComparison.tsx — Performance comparison charts

**Note**: No new tab — streaming is integrated into existing chat and admin

## New Claude Agents (0)
No new agents — this wave migrates and enhances existing agents.

### Migration Order
1. **Phase 1** (pilot): `budget_analyzer` (streaming), `transaction_categorizer` (structured output)
2. **Phase 2**: `financial_reporting_agent`, `forecasting_agent`, `market_intelligence_agent`
3. **Phase 3**: Remaining agents that benefit from streaming/structured output

### VercelAgent Base Class Pattern
```typescript
import { generateText, generateObject, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

abstract class VercelAgent<TInput, TOutput> {
  abstract name: string;
  abstract systemPrompt: string;
  abstract outputSchema: z.ZodType<TOutput>;
  abstract tools: Record<string, Tool>;

  async execute(input: TInput): Promise<TOutput> {
    return generateObject({ model: anthropic('claude-sonnet-4-5-20250929'), schema: this.outputSchema, ... });
  }

  async *stream(input: TInput): AsyncGenerator<string> {
    const result = streamText({ model: anthropic('claude-sonnet-4-5-20250929'), ... });
    for await (const chunk of result.textStream) { yield chunk; }
  }
}
```

## Cognee Integration
- No new datasets — existing agents maintain their Cognee tool access through migration
- Verify all Cognee tools work with both legacy and Vercel agent frameworks

## Testing Criteria
- [ ] Vercel AI SDK packages install without conflicts
- [ ] VercelAgent base class compiles and extends correctly
- [ ] budget_analyzer migrated: streaming output works
- [ ] transaction_categorizer migrated: structured output validated by Zod
- [ ] Streaming chat shows token-by-token rendering
- [ ] Structured output conforms to registered schema
- [ ] Legacy agents still work alongside Vercel agents
- [ ] Benchmark shows <10% latency difference for non-streaming
- [ ] Rollback reverts agent to legacy framework
- [ ] Admin dashboard shows correct framework status per agent
- [ ] `cd server && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: sdk-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave21-agent-tasks/01-sdk-schema-builder.md`

### Agent 2: vercel-base-class-builder [PRIORITY: WAVE 1]
**Task file**: `wave21-agent-tasks/02-vercel-base-class-builder.md`
**Creates**: server/src/services/claude/vercel-agent.ts

### Agent 3: streaming-service-builder [PRIORITY: WAVE 1]
**Task file**: `wave21-agent-tasks/03-streaming-service-builder.md`
**Creates**: server/src/services/streaming.ts

### Agent 4: pilot-migration-1 [DEPENDS ON: Agent 2]
**Task file**: `wave21-agent-tasks/04-pilot-migration-1.md`
**Modifies**: budget_analyzer (add streaming)

### Agent 5: pilot-migration-2 [DEPENDS ON: Agent 2]
**Task file**: `wave21-agent-tasks/05-pilot-migration-2.md`
**Modifies**: transaction_categorizer (add structured output)

### Agent 6: structured-output-builder [DEPENDS ON: Agent 2]
**Task file**: `wave21-agent-tasks/06-structured-output-builder.md`
**Creates**: server/src/services/claude/schemas/ (Zod schemas)

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 3, 4, 5]
**Task file**: `wave21-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-streaming-builder [DEPENDS ON: Agent 7]
**Task file**: `wave21-agent-tasks/08-ui-streaming-builder.md`

### Agent 9: batch-migration-builder [DEPENDS ON: Agents 4, 5]
**Task file**: `wave21-agent-tasks/09-batch-migration-builder.md`
**Modifies**: Phase 2 agent migrations

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave21-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7 + Agent 9
Sub-wave 4 (After 3):  Agent 8
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave21-agent-tasks/`.
