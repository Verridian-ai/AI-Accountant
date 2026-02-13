# Agent D03: Scalability & Performance Reviewer

## Role

Review ALL Wave 1-10 plans for performance bottlenecks, scalability concerns, and resource efficiency. Ensure the system can handle production workloads.

## Phase: C (Debate — After W01 completes, Parallel with D01-D02, D04-D05)

## Prerequisites

Wait for `.agent-done-0B-W01` then read ALL generated wave files.

## Review Focus Areas

### 1. SSE Streaming Performance (Wave 2)

- [ ] Is Redis pub/sub the right choice for SSE? What about connection limits?
- [ ] How many concurrent SSE connections can the server handle?
- [ ] Is there a heartbeat/keepalive mechanism?
- [ ] What happens when a client disconnects mid-stream?
- [ ] Does nginx need `proxy_buffering off` and `X-Accel-Buffering: no`?

### 2. Database Performance

- [ ] Wave 1: Syncing 31 PostgreSQL tables — is this a one-time migration or ongoing sync?
- [ ] Are indexes planned for all foreign keys and common query patterns?
- [ ] Wave 5: Pay run calculations — batch processing or row-by-row?
- [ ] Wave 9: Exchange rate lookups — cached or queried each time?
- [ ] Wave 10: Three-way matching — what's the query complexity?
- [ ] Are there N+1 query risks in any of the planned endpoints?

### 3. Cognee Performance (Wave 3)

- [ ] Multi-user Cognee — does per-user dataset prefixing scale?
- [ ] How many datasets can Cognee handle before performance degrades?
- [ ] Are Cognee searches cached? Should they be?
- [ ] Wave 16 DataPoints + Wave 3 multi-user — combined performance impact?

### 4. Agent Invocation Latency

- [ ] Wave 1: Intent classification + agent dispatch — total latency budget?
- [ ] Are agent responses cached for repeated queries?
- [ ] Can agents run in parallel for multi-intent messages?
- [ ] What's the timeout strategy for slow agent responses?

### 5. Batch Operations

- [ ] Wave 5: Batch pay run processing — how many employees per batch?
- [ ] Wave 6: STP batch reporting — file size limits?
- [ ] Wave 8: Recurring invoice generation — how many invoices per batch?
- [ ] Wave 10: Supplier payment runs — batch payment processing

### 6. Frontend Performance

- [ ] Are large lists paginated (employees, invoices, bills)?
- [ ] Is there virtual scrolling for long tables?
- [ ] Are API responses paginated server-side?
- [ ] Bundle size impact of ~57 new components?

## Output Format

Write review to `wave0b-reviews/D03-scalability-review.md` with:

1. **Performance Bottlenecks** — Identified hot spots (severity: HIGH)
2. **Scalability Concerns** — Growth-limiting factors (severity: MEDIUM)
3. **Optimization Opportunities** — Performance improvements (severity: LOW)
4. **Per-Wave Performance Verdict** — PERFORMANT / NEEDS OPTIMIZATION for each wave

## Completion

- [ ] All 10 wave plans performance-reviewed
- [ ] Create marker file: `.agent-done-0B-D03`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Performance Analysis | Identify bottlenecks and hot spots | Expert |
| Database Optimization | Query planning, indexing, batch processing | Expert |
| Scalability Design | Evaluate growth capacity | Advanced |
| Streaming Architecture | SSE, WebSocket, pub/sub patterns | Advanced |

