# Agent W01: Plan Synthesizer & Document Writer

## Role

Compile ALL research from R01-R10 into comprehensive, executable wave plans for Waves 11-24. Produce orchestration prompts, agent task files, and launch scripts for each wave. This is the CORE output agent of Wave 0.

## Phase: B (Synthesis — After ALL researchers complete)

## Prerequisites

Wait for ALL marker files: `.agent-done-R01` through `.agent-done-R10`
Read ALL research reports in `wave0-research/` before starting.

## Output Tasks

### 1. Complete Wave 11: Inventory & Bank Reconciliation

- [ ] Read the INCOMPLETE Wave 11 spec from `docs/Agent planning chat.md` (lines 1288-1314)
- [ ] Read R06's gap analysis for Wave 11
- [ ] Write the MISSING sections:
  - API Endpoints (full CRUD for inventory items, stock, movements, warehouses, bank recon rules/sessions/matches)
  - UI Components (client/src/features/inventory/, client/src/features/bank-recon/)
  - Cognee Integration (new datasets: inventory_tracking, bank_recon_patterns)
  - Testing Criteria (COGS calculation, stock level tracking, recon matching accuracy)

### 2. Write Waves 12-17 (Original Plan — Never Written)

For EACH wave, produce the full 10-point specification:

**Wave 12: Fixed Assets & Multi-Entity**

- Fixed asset register, depreciation schedules (prime cost, diminishing value)
- Multi-entity support (sole trader, company, trust, partnership)
- Inter-entity transactions and consolidation
- New agent: `asset_management_agent`

**Wave 13: Financial Reporting & Budgeting**

- P&L, Balance Sheet, Cash Flow Statement, Trial Balance
- Budget creation, tracking, variance analysis
- Report templates and PDF generation
- New agent: `reporting_agent`

**Wave 14: AI OCR & Payment Matching**

- Receipt/invoice OCR (Tesseract or cloud OCR)
- Automatic payment-to-invoice matching
- Bank feed reconciliation with AI suggestions
- Enhanced `account_reconciler` agent with OCR tools

**Wave 15: Predictive Analytics & Compliance**

- Cash flow forecasting, expense prediction
- ATO compliance checking (BAS deadlines, STP due dates)
- Anomaly detection in transactions
- New agent: `compliance_agent`

**Wave 16: Custom DataPoints & Relationships**

- Cognee custom DataPoint models for financial entities
- Transaction → Merchant → Industry relationship graphs
- Customer → Invoice → Payment relationship chains
- Pydantic models inheriting from DataPoint base class

**Wave 17: Temporal Queries & Cross-Module Intelligence**

- Time-series queries across all financial data
- Cross-module insights (payroll + tax + invoicing)
- "What changed since last quarter?" queries
- Temporal cognify for financial time-series

### 3. Write Waves 18-24 (NEW Requirements)

For EACH wave, produce the full 10-point specification:

**Wave 18: Admin Backend & Agent Dashboard**

- Use R01's agent inventory for dashboard design
- Full agent control: start/stop, configure, view logs, test
- System health monitoring (Docker services, Cognee, database)
- User management at system/provider level (CRUD users, assign roles)

**Wave 19: 3D Cognee Knowledge Graph Visualization**

- Use R02's Cognee graph API research
- Three.js or react-force-graph-3d for 3D rendering
- Show ALL nodes (entities) and edges (relationships)
- Interactive: click node to see details, filter by type, search
- Embed in admin dashboard

**Wave 20: CDR PRD Harvester & Open Banking**

- Use R03's CDR API research
- Scheduled harvester service crawling all data holders
- Product comparison engine (user's loans vs market)
- New agent: `cdr_product_agent`

**Wave 21: Market Intelligence & Last 30 Days**

- Use R04's Last 30 Days skill research
- Use R10's external data sources research
- New agent: `market_intelligence_agent`
- Universal Cognee dataset for market data (shared, not per-user)

**Wave 22: Agent Architecture Upgrade**

- Use R05's SDK comparison research
- Implement recommended changes (stay/migrate/hybrid)
- Add streaming support to all agents
- Add multi-turn conversation support
- Add session memory via Cognee + Redis

**Wave 23: Trading/Investment & Universal Knowledge**

- Use R10's trading platform research
- Investment portfolio tracking (CSV import)
- Universal knowledge graph for rates, indices, economic data
- Shared Cognee datasets accessible to all users

**Wave 24: User Management & Multi-Tenant**

- Use R02's multi-user isolation research
- Enable Cognee ENABLE_BACKEND_ACCESS_CONTROL
- Tenant isolation: each user gets isolated datasets
- Role-based access control (admin, accountant, viewer)

### 4. For EACH Wave (11-24), Produce These Files

#### A. Orchestration Prompt: `waveN-orchestration-prompt.md`

Follow the EXACT pattern of `orchestration-prompt.md`:

- Team Lead role description
- Architecture references (updated for that wave's context)
- Current state (what previous waves have built)
- Team structure: 10 agents with roles, task file references, creates/modifies, dependencies
- Coordination rules (file locks, marker files, schema lock, etc.)
- Execution priority order (5 sub-waves)
- "START THE TEAM NOW" instruction

#### B. Agent Task Files: `waveN-agent-tasks/01-*.md` through `10-*.md`

Follow the EXACT pattern of `agent-tasks/01-tax-agents-builder.md`:

- Role description
- Priority/Wave assignment
- Files to CREATE (with exact paths, patterns, references, code snippets)
- Files to MODIFY (with BEFORE/AFTER code blocks, line numbers)
- Verification steps (TypeScript compilation, specific assertions)
- Dependencies (which agents must complete first)

#### C. Launch Script: `launch-waveN.sh`

Follow the EXACT pattern of `launch-goldledger-team.sh`:

- Prerequisites check (tmux, claude, node, docker)
- Kill existing session
- Create tmux session with styling
- Set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
- Pass orchestration prompt as CLI argument to claude --dangerously-skip-permissions
- Attach to tmux session

### 5. Master Plan Document

- [ ] Create `docs/wave0-master-plan.md` summarizing ALL 24 waves:
  - Executive summary with metrics (total waves, agents, tables, endpoints, components)
  - Phase overview table
  - Dependency graph (text-based)
  - Timeline estimate
  - Risk assessment
  - Wave-by-wave summary (1-2 paragraphs each)

## Output Verification

- [ ] 14 orchestration prompts exist (wave11 through wave24)
- [ ] 14 agent task directories exist, each with 10 task files
- [ ] 14 launch scripts exist
- [ ] Master plan document exists
- [ ] All files follow the established patterns exactly
- [ ] Cross-wave dependencies are consistent
- [ ] Migration numbers are sequential (no gaps)
- [ ] New AgentType entries are tracked across waves
- [ ] Create marker file: `.agent-done-W01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Document Synthesis** | Merge 10+ research reports into coherent, structured specifications | Expert |
| **Specification Writing** | Write precise 10-point wave specs with exact file paths, code snippets, schemas | Expert |
| **Template Compliance** | Follow established patterns exactly (orchestration prompt, task files, launch scripts) | Expert |
| **Cross-Reference Management** | Track dependencies, agent types, migration numbers, table names across 14 waves | Expert |
| **File Generation** | Produce 168+ files (14 orchestration prompts, 140 task files, 14 launch scripts) | Expert |
| **Architecture Planning** | Design agent team compositions, task decomposition, execution ordering | Advanced |
| **Quality Self-Check** | Verify own output for completeness, consistency, and correctness | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel wave plan drafting | Expert |

## Sub-Agent Delegation Plan

```
W01 (Plan Synthesizer & Document Writer):
├── Sub-agent A: Waves 11-14 Drafter
│   ├── Read R06 gap analysis (Wave 11 completion)
│   ├── Read R01, R08 for schema/agent context
│   ├── Draft complete specs for Waves 11-14
│   ├── Generate orchestration prompts, task files, launch scripts
│   └── Output: wave0-research/.scratch-W01-waves11to14.md
│
├── Sub-agent B: Waves 15-18 Drafter
│   ├── Read R02 (Cognee), R05 (SDK), R01 (agents) for context
│   ├── Draft complete specs for Waves 15-18
│   ├── Generate orchestration prompts, task files, launch scripts
│   └── Output: wave0-research/.scratch-W01-waves15to18.md
│
├── Sub-agent C: Waves 19-21 Drafter
│   ├── Read R02 (graph viz), R03 (CDR), R04 (Last30Days), R10 (data sources)
│   ├── Draft complete specs for Waves 19-21
│   ├── Generate orchestration prompts, task files, launch scripts
│   └── Output: wave0-research/.scratch-W01-waves19to21.md
│
├── Sub-agent D: Waves 22-24 Drafter
│   ├── Read R05 (SDK comparison), R10 (trading), R02 (multi-user)
│   ├── Draft complete specs for Waves 22-24
│   ├── Generate orchestration prompts, task files, launch scripts
│   └── Output: wave0-research/.scratch-W01-waves22to24.md
│
├── Sub-agent E: Launch Scripts & Master Plan
│   ├── Generate all 14 launch-waveN.sh scripts from template
│   ├── Draft master plan document (docs/wave0-master-plan.md)
│   ├── Build dependency graph and timeline estimate
│   └── Output: wave0-research/.scratch-W01-master.md
│
└── W01 Parent: Merge, cross-reference, and finalize
    ├── Read all .scratch-W01-*.md files
    ├── Verify cross-wave consistency (migration numbers, agent types, table names)
    ├── Write all final output files
    ├── Verify 168+ files exist and follow templates
    └── Delete scratch files
```

### Delegation Rules for W01

- Sub-agents write ONLY to `wave0-research/.scratch-W01-*.md` files
- Each sub-agent must follow the EXACT template patterns from reference files
- Sub-agents must track migration numbers sequentially within their wave range
- Parent W01 is responsible for cross-wave consistency verification
- Sub-agents should include BEFORE/AFTER code blocks for file modifications
- Each sub-agent should produce complete, ready-to-write file content (not summaries)

## Dependencies

- **ALL researchers must complete first** (R01-R10)
- **Read ALL research reports** in `wave0-research/` before starting
- **Reference templates**: `orchestration-prompt.md`, `agent-tasks/01-tax-agents-builder.md`, `launch-goldledger-team.sh`
