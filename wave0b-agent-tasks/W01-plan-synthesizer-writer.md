# Agent W01: Plan Synthesizer & Document Writer

## Role

Synthesize ALL research from R01-R10 into complete, executable wave plans for Waves 1-10. You are the ONLY agent that creates the actual wave files. This is the most critical role in Wave 0B.

## Phase: B (Synthesis — After ALL 10 researchers complete)

## Prerequisites

Wait for ALL of these marker files before starting:
`.agent-done-0B-R01` through `.agent-done-0B-R10`

Then read ALL 10 research files from `wave0b-research/`.

## Deliverables

For EACH of Waves 1-10, create:

1. **`waveN-orchestration-prompt.md`** — Following `wave11-orchestration-prompt.md` pattern
2. **`waveN-agent-tasks/`** — Directory with 10 agent task files (`01-*.md` through `10-*.md`)
3. **`launch-waveN.sh`** — Executable launch script following `launch-wave11.sh` pattern

That's **10 orchestration prompts + 100 agent task files + 10 launch scripts = 120 files total**.

## Template Files (READ THESE FIRST)

- `wave11-orchestration-prompt.md` — Structure: Architecture Refs, Current State, Dependencies, Schema, Endpoints, Agents, UI, Cognee, Tests, Execution Order
- `wave11-agent-tasks/01-inventory-schema-builder.md` — Structure: Role, Sub-wave, Tasks, Output, Completion marker
- `launch-wave11.sh` — Structure: Prerequisites check, file verification, tmux session creation, agent launch

## Writing Rules

### Orchestration Prompts Must Include:

1. Architecture reference files table
2. Current state (what exists BEFORE this wave runs)
3. Dependencies (which waves must complete first)
4. Database schema changes — BOTH SQLite AND PostgreSQL table definitions
5. API endpoints — method, path, description, handler file
6. New Claude agents — following `ClaudeAgent<TInput, TOutput>` pattern
7. UI components — file paths, component names, props
8. Cognee integration — datasets, index queries
9. Testing criteria — specific assertions
10. Execution order — sub-waves with parallel/sequential phases

### Agent Task Files Must Include:

1. Agent role and sub-wave assignment
2. Specific file paths to create/modify
3. Detailed implementation instructions
4. Completion marker: `.agent-done-W{N}-{XX}` format
5. Dependencies on other agents within the same wave

### Launch Scripts Must Include:

1. Prerequisite wave completion checks (marker files)
2. File existence verification (orchestration prompt + 10 task files)
3. Output directory creation
4. tmux session: `goldledger-wave{N}`
5. Claude Code launch with `--dangerously-skip-permissions`
6. Prompt passed as CLI argument (NOT via tmux send-keys)

## Wave-Specific Notes

### Wave 1 (Chat→Agent Bridge) — LARGEST WAVE
- PostgreSQL schema sync: 31 missing tables
- Intent router: classify user messages → agent invocations
- Agent dispatcher: route to correct Claude agent
- Response formatter: standardize agent output for chat
- This wave is the FOUNDATION — everything depends on it

### Wave 2 (Transaction Mutation)
- Add mutation tools to existing agents (categorizer, GST calculator)
- SSE streaming for real-time agent responses
- Audit trail for all mutations
- Confirmation flow before destructive operations

### Wave 3 (Multi-User Cognee)
- Enable `ENABLE_BACKEND_ACCESS_CONTROL=true`
- Per-user dataset prefixing
- Session memory with Redis bridge
- Wave 16 already built DataPoints — ensure compatibility

### Waves 4-6 (Payroll Track)
- Sequential: employee setup → pay runs → STP compliance
- TFN encryption (AES-256-GCM) — critical security requirement
- Australian-specific: STP Phase 2, super guarantee, PAYG

### Waves 7-9 (Invoicing Track)
- Sequential: customers/invoices → recurring/payments → AR/multi-currency
- New `invoice_agent` in Wave 7
- PDF generation capability
- Wave 14 (OCR) already references invoice tables — ensure compatibility

### Wave 10 (AP & Purchase Orders)
- New `accounts_payable_agent`
- Three-way matching (PO → receipt → bill)
- Wave 11 already references AP module — ensure compatibility

## Completion

- [ ] All 120 files created and verified
- [ ] Create marker file: `.agent-done-0B-W01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Technical Writing | Produce clear, actionable implementation plans | Expert |
| Architecture Design | Design agent teams and execution orders | Expert |
| Template Synthesis | Apply patterns consistently across 10 waves | Expert |
| Cross-Reference | Ensure consistency across 120 files | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Write Wave 1-2 files (orchestration + 10 tasks + launch each)
- **Sub-agent B**: Write Wave 3-4 files
- **Sub-agent C**: Write Wave 5-6 files
- **Sub-agent D**: Write Wave 7-8 files
- **Sub-agent E**: Write Wave 9-10 files
- W01 reviews all sub-agent output for consistency, then creates markers

