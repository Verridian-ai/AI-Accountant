# Agent 2: Vercel Base Class Builder

## Role
Build the abstract `VercelAgent<TInput, TOutput>` base class using the Vercel AI SDK (`ai` package) with `@ai-sdk/anthropic` provider. Must be a drop-in replacement pattern compatible with the existing `ClaudeAgent` architecture.

## Priority: WAVE 21 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/claude/vercel-agent.ts`
**Purpose**: Abstract base class for all Vercel AI SDK agents
**Pattern**: Mirror the existing `ClaudeAgent` pattern from `server/src/services/claude/orchestrator.ts`
**Reference**: Existing agents at `server/src/services/claude/agents/*.ts`

```typescript
import { generateText, generateObject, streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
```

- [ ] Create `abstract class VercelAgent<TInput, TOutput>` with:
  - Constructor accepting `agentType: AgentType`, `systemPrompt: string`, `outputSchema?: z.ZodSchema<TOutput>`
  - Abstract method `getTools(): Record<string, CoreTool>` -- returns Vercel AI SDK tool definitions
  - Abstract method `buildPrompt(input: TInput): string` -- converts input to user message
  - Method `execute(input: TInput): Promise<TOutput>` -- uses `generateText()` or `generateObject()` depending on whether outputSchema is provided
  - Method `stream(input: TInput): AsyncIterable<string>` -- uses `streamText()` for token-by-token streaming
  - Method `executeWithFallback(input: TInput): Promise<TOutput>` -- tries Vercel SDK, falls back to legacy ClaudeAgent on error
  - Protected method `getModel()` -- reads from `AGENT_MODELS` config, returns `anthropic(modelId)`
  - Protected method `getTokenBudget()` -- reads from `AGENT_TOKEN_BUDGETS` config
  - Protected method `recordSession(status, input, output, latency)` -- writes to `agent_stream_sessions` table
  - Protected method `updateMigrationStats(success: boolean)` -- increments counters in `agent_migration_status`
- [ ] Handle tool calls: Map `getTools()` output to Vercel AI SDK `tools` parameter format using `tool()` helper with Zod schemas for parameters
- [ ] Error handling: Wrap all API calls in try/catch, log failures, record to session table
- [ ] Token tracking: Extract usage from response metadata, store in session record

### 2. `server/src/services/claude/vercel-provider.ts`
**Purpose**: Provider configuration and model factory

- [ ] Export `getAnthropicProvider()` -- configures `@ai-sdk/anthropic` with API key from `process.env.ANTHROPIC_API_KEY`
- [ ] Export `getOpenRouterProvider()` -- configures OpenRouter as fallback provider using `@ai-sdk/openai` compatible endpoint
- [ ] Export `resolveModel(agentType: AgentType)` -- returns appropriate provider+model based on config
- [ ] Export `VERCEL_SDK_CONFIG` -- shared settings: `maxRetries: 3`, `timeout: 120_000`

### 3. `server/src/services/claude/tool-adapter.ts`
**Purpose**: Convert existing ClaudeAgent tool definitions to Vercel AI SDK format

- [ ] Export `adaptLegacyTool(name, description, inputSchema, handler)` -- converts Anthropic SDK tool format to Vercel AI SDK `tool()` format with Zod parameter schemas
- [ ] Export `adaptAllTools(legacyTools: LegacyTool[])` -- batch conversion utility
- [ ] Handle JSON Schema to Zod conversion for tool parameters using `zod-to-json-schema` inverse

## Files to MODIFY

### 4. `server/src/services/claude/types.ts`
**AFTER line 21** (after AgentType union):
```typescript
// Vercel AI SDK types
export interface VercelAgentConfig {
  agentType: AgentType;
  systemPrompt: string;
  outputSchema?: import('zod').ZodSchema;
  enableStreaming?: boolean;
  enableFallback?: boolean;
}

export interface StreamSession {
  id: string;
  agentType: AgentType;
  status: 'pending' | 'streaming' | 'completed' | 'errored';
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs?: number;
}
```

- [ ] Add `VercelAgentConfig` interface
- [ ] Add `StreamSession` interface
- [ ] Add `VercelAgentExecutionResult<T>` generic result wrapper

### 5. `package.json` (server)
- [ ] Add dependencies: `ai@^4.0`, `@ai-sdk/anthropic@^1.0`, `@ai-sdk/openai@^1.0`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `VercelAgent` can be extended by a concrete class without errors
- [ ] `getAnthropicProvider()` returns valid provider instance
- [ ] `adaptLegacyTool()` correctly converts tool format
- [ ] Create marker file: `.agent-done-W21-02`

## Dependencies
- **None** -- can start immediately (does not need schema tables)
- **Reuses**: `types.ts`, `config.ts` from existing claude framework
