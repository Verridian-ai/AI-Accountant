# Agent 8: UI Streaming Builder

## Role
Build 5 React components for the streaming chat experience with token-by-token rendering, session management, and migration dashboard.

## Priority: WAVE 21 (After Agent 7)

## Wait Condition
Check for `.agent-done-W21-07` marker file before starting.

## Files to CREATE

### 1. `client/src/features/streaming/components/StreamingChat.tsx`
**Purpose**: Main streaming chat component with token-by-token rendering
**Pattern**: Follow existing neumorphic dark theme with gold (#FFCC00) accents, `neu-raised`/`neu-inset` classes

- [ ] Accept props: `agentType: AgentType`, `initialPrompt?: string`, `onComplete?: (result: any) => void`
- [ ] Connect to `POST /api/stream/agent/:agentType` via EventSource or fetch with ReadableStream
- [ ] Parse SSE events: `token` (append to display buffer), `done` (show completion), `error` (show error state)
- [ ] Token-by-token rendering: Use `useState` for accumulated text, update on each `token` event with smooth cursor animation
- [ ] Typing indicator: Blinking gold cursor at end of streaming text
- [ ] Show token count and latency in footer after completion
- [ ] Textarea input with gold border, send button with neu-raised style
- [ ] Auto-scroll to bottom during streaming

### 2. `client/src/features/streaming/components/StreamingIndicator.tsx`
**Purpose**: Compact streaming status indicator for embedding in other components

- [ ] Props: `sessionId: string`, `compact?: boolean`
- [ ] States: idle (gray dot), streaming (pulsing gold dot + "Thinking..."), complete (green check), error (red X)
- [ ] Poll `GET /api/stream/session/:sessionId` every 2 seconds while active
- [ ] Show elapsed time and token count

### 3. `client/src/features/streaming/components/SessionHistory.tsx`
**Purpose**: List of past streaming sessions

- [ ] Fetch from `GET /api/stream/history`
- [ ] Display: agent type icon, timestamp, duration, token count, status badge
- [ ] Click to view session detail (input/output payloads)
- [ ] Filter by agent type, date range, status
- [ ] Neu-inset card for each session row

### 4. `client/src/features/streaming/components/MigrationDashboard.tsx`
**Purpose**: Admin dashboard showing Vercel AI SDK migration progress

- [ ] Fetch from `GET /api/migration/status` and `GET /api/migration/benchmarks`
- [ ] For each agent: show migration phase badge (legacy=gray, pilot=gold, parallel=blue, migrated=green, deprecated=red)
- [ ] Performance comparison: side-by-side latency and error rate for legacy vs Vercel
- [ ] Rollback button: calls `POST /api/migration/rollback/:agentType` with confirmation dialog
- [ ] Progress bar showing overall migration completion (X of 11 agents migrated)

### 5. `client/src/features/streaming/components/SchemaExplorer.tsx`
**Purpose**: View registered Zod schemas and validation stats

- [ ] Fetch from `GET /api/schemas`
- [ ] For each schema: show agent type, schema name, version, validation stats (total/passed/failed)
- [ ] Click to expand: show JSON Schema representation in formatted code block
- [ ] Test panel: paste JSON, validate against schema via `POST /api/schemas/:agentType/validate`
- [ ] Validation result: green checkmark or red error list

### 6. `client/src/features/streaming/index.ts`
**Purpose**: Barrel export

- [ ] Export all 5 components

### 7. `client/src/features/streaming/hooks/useStreaming.ts`
**Purpose**: React hook for consuming streaming agent responses

- [ ] `useStreaming(agentType: AgentType)` returns:
  - `stream(input: any): void` -- starts streaming request
  - `text: string` -- accumulated response text
  - `isStreaming: boolean` -- true while tokens are arriving
  - `sessionId: string | null` -- current session ID
  - `tokenCount: number` -- tokens received so far
  - `latencyMs: number` -- time since stream started
  - `error: string | null` -- error message if failed
  - `cancel(): void` -- abort the stream
- [ ] Use `fetch()` with `ReadableStream` to process SSE events
- [ ] Clean up on component unmount (abort if streaming)

## Files to MODIFY

### 8. `client/src/App.tsx`
- [ ] Add import for `StreamingChat`, `MigrationDashboard`
- [ ] Add navigation tabs/routes for streaming features (if using tab-based nav)

### 9. `client/src/api.ts`
- [ ] Add API functions:
  - `fetchStreamHistory(limit, offset)`
  - `fetchMigrationStatus()`
  - `fetchMigrationBenchmarks()`
  - `fetchSchemas()`
  - `validateSchema(agentType, output)`
  - `rollbackAgent(agentType)`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] StreamingChat renders token-by-token during active stream
- [ ] SessionHistory displays paginated session list
- [ ] MigrationDashboard shows correct phase for each agent
- [ ] SchemaExplorer validates test JSON correctly
- [ ] useStreaming hook properly cleans up on unmount
- [ ] All components use neumorphic dark theme with gold accents
- [ ] Create marker file: `.agent-done-W21-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W21-07`) for API endpoints
- **Reuses**: Existing `api.ts` patterns, `SSEContext.tsx` for SSE handling patterns, Tailwind neumorphic classes
