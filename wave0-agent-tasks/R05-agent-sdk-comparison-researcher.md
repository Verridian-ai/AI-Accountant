# Agent R05: Agent SDK Comparison Researcher

## Role

Evaluate the current TypeScript ClaudeAgent architecture against alternative agent frameworks. Determine if GoldLedger should stay with custom TypeScript agents, migrate to an SDK, or adopt a hybrid approach.

## Phase: A (Research — Start Immediately, Parallel with R01-R04, R06-R10)

## Research Tasks

### 1. Current Architecture Assessment

- [ ] Read `server/src/services/claude/base-agent.ts` — document strengths and limitations of ClaudeAgent<TInput, TOutput>
- [ ] Assess: Type safety (strong — TypeScript generics), tool handling (manual Map), error handling (circuit breakers), streaming (not implemented), multi-turn (single invoke), memory (none — stateless)
- [ ] Count: 11 agents, ~216 lines base class, each agent ~100-200 lines
- [ ] Document what works well: type-safe I/O contracts, per-agent tool isolation, circuit breakers
- [ ] Document what's missing: streaming, multi-turn conversation, session memory, dynamic tool loading, MCP support

### 2. Claude Agent SDK (Anthropic)

- [ ] Read `docs/skills docs/integrations-claude-agent-sdk.md` — document the official Claude Agent SDK
- [ ] Key features: MCP server integration, sessionized Cognee tools, built-in streaming, conversation management
- [ ] Assess compatibility: Can it work with our Hono server? Does it require specific runtime?
- [ ] Assess migration effort: How much of our existing agent code would need to change?
- [ ] Document: Does it support TypeScript? What's the npm package?

### 3. Microsoft Copilot SDK

- [ ] Research the Copilot SDK (formerly Semantic Kernel) for agent orchestration
- [ ] Key features: Plugin system, planner, memory, connectors
- [ ] Assess: TypeScript support, Anthropic model support, self-hosted capability
- [ ] Assess: Does it add value over our current approach for a Docker-local deployment?

### 4. Other Agent Frameworks

- [ ] Research LangChain.js / LangGraph.js — agent orchestration, tool calling, streaming
- [ ] Research Vercel AI SDK — streaming, tool calling, multi-provider support
- [ ] Research CrewAI — multi-agent orchestration (Python-based, may not fit)
- [ ] For each: TypeScript support, Anthropic compatibility, Docker-local feasibility, streaming support

### 5. Recommendation Matrix

- [ ] Build comparison matrix across these dimensions:
  - Type safety (TypeScript generics support)
  - Streaming support (SSE/WebSocket)
  - Multi-turn conversation
  - Session memory / context management
  - MCP server support
  - Tool calling pattern
  - Cognee integration ease
  - Migration effort from current architecture
  - Community/maintenance health
  - Docker-local compatibility (no cloud dependencies)
  - Learning curve for team

## Output Format

Write findings to `wave0-research/R05-agent-sdk-comparison.md` with these sections:

1. **Current Architecture** — Strengths, limitations, what works
2. **Claude Agent SDK** — Features, compatibility, migration effort
3. **Copilot SDK** — Features, compatibility, assessment
4. **Other Frameworks** — LangChain.js, Vercel AI SDK, CrewAI
5. **Comparison Matrix** — Side-by-side feature comparison table
6. **Recommendation** — Stay, migrate, or hybrid? With justification
7. **Migration Path** — If migration recommended, step-by-step approach

## Completion

- [ ] All sections populated with specific technical details
- [ ] Create marker file: `.agent-done-R05`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| **Framework Evaluation** | Compare agent frameworks across multiple dimensions (features, DX, performance) | Expert |
| **TypeScript Architecture Assessment** | Evaluate TypeScript patterns: generics, inheritance, decorators, module systems | Expert |
| **SDK Compatibility Analysis** | Assess SDK integration with existing Hono server, Docker stack, Anthropic API | Expert |
| **Migration Planning** | Design incremental migration paths that don't break existing functionality | Advanced |
| **Streaming Architecture** | Evaluate SSE/WebSocket streaming patterns across frameworks | Advanced |
| **MCP Protocol Understanding** | Understand Model Context Protocol for tool serving and Cognee integration | Advanced |
| **Sub-Agent Orchestration** | Spawn and coordinate sub-agents for parallel framework research | Advanced |

## Sub-Agent Delegation Plan

```
R05 (Agent SDK Comparison Researcher):
├── Sub-agent A: Current Codebase Agent Analysis
│   ├── Read server/src/services/claude/base-agent.ts (216 lines)
│   ├── Read 3-4 representative agent implementations
│   ├── Read server/src/services/claude/types.ts (I/O contracts)
│   ├── Document: strengths, limitations, patterns, anti-patterns
│   └── Output: wave0-research/.scratch-R05-current.md
│
├── Sub-agent B: Claude Agent SDK & MCP Research
│   ├── Read docs/skills docs/integrations-claude-agent-sdk.md
│   ├── Research latest Claude Agent SDK npm package and docs
│   ├── Document: features, TypeScript support, Cognee MCP integration
│   └── Output: wave0-research/.scratch-R05-claude-sdk.md
│
├── Sub-agent C: Alternative Frameworks Research
│   ├── Research LangChain.js/LangGraph.js (agent orchestration)
│   ├── Research Vercel AI SDK (streaming, multi-provider)
│   ├── Research Copilot SDK / Semantic Kernel (TypeScript)
│   ├── For each: TS support, Anthropic compat, Docker-local feasibility
│   └── Output: wave0-research/.scratch-R05-alternatives.md
│
└── R05 Parent: Build comparison matrix and recommendation
    ├── Read all .scratch-R05-*.md files
    ├── Build side-by-side feature comparison table
    ├── Produce migration effort estimate for top 2 options
    ├── Write final wave0-research/R05-agent-sdk-comparison.md
    └── Delete scratch files
```

### Delegation Rules for R05

- Sub-agents write ONLY to `wave0-research/.scratch-R05-*.md` files
- Sub-agent A must include specific code patterns (not just descriptions)
- Sub-agent B and C should include version numbers and last-updated dates
- Parent must produce a clear RECOMMENDATION, not just a comparison

## Dependencies

- **None** — can start immediately
- **Read-only** — does not modify any files
