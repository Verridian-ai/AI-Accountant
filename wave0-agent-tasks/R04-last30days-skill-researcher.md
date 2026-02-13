# Agent R04: Last 30 Days Skill Researcher

## Role

Analyze the Last 30 Days skill plugin (<https://github.com/mvanhorn/last30days-skill>) and design its integration into GoldLedger as a financial market intelligence agent tool.

## Phase: A (Research — Start Immediately, Parallel with R01-R03, R05-R10)

## Research Tasks

### 1. Plugin Analysis

- [ ] Read the GitHub repository README and source code at <https://github.com/mvanhorn/last30days-skill>
- [ ] Document: What data does it provide? (market trends, economic indicators, financial news?)
- [ ] Document: What APIs does it call? (data sources, authentication requirements)
- [ ] Document: What is the output format? (JSON schema, text, structured data?)
- [ ] Document: What dependencies does it require? (Python packages, API keys, external services)
- [ ] Document: Is it a standalone service, a library, or a skill/plugin for a specific framework?

### 2. Data Coverage Assessment

- [ ] What financial markets does it cover? (ASX, NYSE, crypto, forex, commodities?)
- [ ] What time range? (last 30 days only, or configurable?)
- [ ] What granularity? (daily, hourly, real-time?)
- [ ] Does it provide Australian-specific data? (ASX, AUD exchange rates, RBA rates?)
- [ ] Does it provide analysis/insights or just raw data?

### 3. Integration Architecture

- [ ] Design how to integrate as a Claude agent tool:
  - Option A: Wrap as a tool in an existing agent (e.g., financial_planner)
  - Option B: Create a new `market_intelligence_agent` with this as a primary tool
  - Option C: Run as a separate microservice, called via HTTP from agent tools
- [ ] Propose the integration pattern that best fits ClaudeAgent<TInput, TOutput>
- [ ] Design the MarketIntelligenceInput and MarketIntelligenceOutput interfaces
- [ ] Propose Cognee dataset: `market_intelligence` — index market data for queries like "What's happening with interest rates?"

### 4. Universal Knowledge Graph Design

- [ ] This data is NOT personal to any user — it's shared/universal knowledge
- [ ] Design how to store in Cognee as a shared dataset (no user prefix)
- [ ] Propose refresh schedule: daily market data update → Cognee re-cognify
- [ ] Design the data flow: Last30Days API → normalize → Cognee universal dataset → agent queries

### 5. Alternative/Complementary Data Sources

- [ ] Research other financial market data APIs that could complement Last 30 Days:
  - Alpha Vantage (free tier: 25 requests/day)
  - Yahoo Finance API
  - RBA Statistical Tables (<https://www.rba.gov.au/statistics/tables/>)
  - ASX market data
- [ ] Propose a unified market data interface that can pull from multiple sources

## Output Format

Write findings to `wave0-research/R04-last30days-skill.md` with these sections:

1. **Plugin Overview** — What it does, how it works, dependencies
2. **Data Coverage** — Markets, time range, granularity, Australian relevance
3. **Integration Design** — Recommended approach, agent architecture, I/O types
4. **Universal Knowledge** — Shared Cognee dataset design, refresh strategy
5. **Complementary Sources** — Additional APIs for comprehensive market intelligence
6. **Implementation Estimate** — Effort, complexity, prerequisites

## Completion

- [ ] All sections populated
- [ ] Create marker file: `.agent-done-R04`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **GitHub Repository Analysis** | Read and understand open-source project structure, dependencies, APIs | Expert |
| **Plugin/Skill Architecture** | Evaluate plugin integration patterns, dependency injection, API wrapping | Expert |
| **Financial Market Data** | Understand market data types, time series, indicators, data providers | Advanced |
| **Agent Tool Design** | Design ClaudeAgent-compatible tools with proper I/O contracts | Advanced |
| **Universal Knowledge Architecture** | Design shared (non-personal) Cognee datasets and refresh strategies | Advanced |
| **API Evaluation** | Compare multiple data source APIs by coverage, cost, reliability | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel research | Advanced |

## Sub-Agent Delegation Plan

```
R04 (Last 30 Days Skill Researcher):
├── Sub-agent A: GitHub Plugin Deep Dive
│   ├── Read https://github.com/mvanhorn/last30days-skill README and source
│   ├── Document: data sources, output format, dependencies, API keys needed
│   ├── Assess: Is it maintained? Last commit? Issues? Stars?
│   └── Output: wave0-research/.scratch-R04-plugin.md
│
├── Sub-agent B: Alternative Market Data APIs
│   ├── Research Alpha Vantage, Yahoo Finance, RBA Statistical Tables
│   ├── Document free tier limits, auth requirements, data formats
│   ├── Assess Australian-specific data availability
│   └── Output: wave0-research/.scratch-R04-alternatives.md
│
├── Sub-agent C: Integration Architecture Design
│   ├── Design MarketIntelligenceInput/Output interfaces
│   ├── Design universal Cognee dataset structure
│   ├── Propose agent tool definitions for market queries
│   └── Output: wave0-research/.scratch-R04-design.md
│
└── R04 Parent: Merge and produce unified market intelligence plan
    ├── Read all .scratch-R04-*.md files
    ├── Produce recommendation: best integration approach
    ├── Write final wave0-research/R04-last30days-skill.md
    └── Delete scratch files
```

### Delegation Rules for R04

- Sub-agents write ONLY to `wave0-research/.scratch-R04-*.md` files
- Sub-agent A should assess if the plugin is production-ready or needs forking
- Sub-agent B should include pricing tables for each API

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
- **External research**: Needs to read GitHub repository
