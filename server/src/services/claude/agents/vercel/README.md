# Vercel AI SDK Agent Migration

This directory contains agents migrated from the legacy `ClaudeAgent` (Anthropic SDK) to the Vercel AI SDK pattern.

## Directory Structure

```
vercel/
  transaction-categorizer.ts   # First migrated agent
  budget-analyzer.ts           # Budget analysis agent
  categorizer-validator.ts     # Validation helpers
  README.md                    # This file
```

## Base Class: `VercelAgent<TInput, TOutput>`

All migrated agents extend `VercelAgent` (defined in `../../vercel-agent.ts`). Subclasses implement three methods:

- **`getTools(): ToolSet`** -- Returns Vercel AI SDK tools (converted via `adaptLegacyTool()`)
- **`buildPrompt(input: TInput): string`** -- Converts typed input into a user-message prompt
- **`buildFallbackOutput(input, error): TOutput`** -- Returns a minimal valid output on failure

Constructor receives `(agentType, systemPrompt, outputSchema?)` where the Zod output schema enables structured output validation.

## Tool Adaptation

Legacy tools use Anthropic SDK JSON Schema format. The `adaptLegacyTool()` function from `../../tool-adapter.ts` bridges them:

```typescript
tools['my_tool'] = adaptLegacyTool(
  'my_tool',
  'Tool description for the LLM',
  { type: 'object', properties: { ... }, required: [...] },
  async (input) => { /* handler */ },
);
```

Each JSON Schema property is mapped to `z.any()` with the original description preserved, so the model still receives full contextual guidance without requiring a manual JSON-Schema-to-Zod conversion.

## Structured Output

When a Zod schema is provided at construction, `VercelAgent.execute()` uses `Output.object({ schema })` which instructs the Vercel SDK to validate the model's response against the schema. This guarantees type-safe output.

## Streaming

`VercelAgent.stream(input)` returns an `AsyncGenerator<string>` of partial text deltas, suitable for piping into SSE connections.

## Fallback Strategy

`executeWithFallback(input)` wraps `execute()` in a try/catch. On failure it calls `buildFallbackOutput()` so the pipeline continues instead of crashing. Each agent defines a sensible default (e.g., empty arrays, zero confidence, descriptive error summary).

## Migration Flags

Migration is gated by `VERCEL_MIGRATION_FLAGS` in `../../config.ts`. Each agent type maps to `process.env.USE_VERCEL_SDK === 'true'`. The orchestrator checks these flags before dispatching to either the Vercel or legacy path.

## Adding a New Agent

1. Create `vercel/<agent-name>.ts` extending `VercelAgent`
2. Ensure a Zod output schema exists in `../../schemas/`
3. Add the agent type to `VERCEL_MIGRATION_FLAGS` in `../../config.ts`
4. Add a dispatch case in `../../orchestrator.ts` inside the `VERCEL_MIGRATION_FLAGS` block
