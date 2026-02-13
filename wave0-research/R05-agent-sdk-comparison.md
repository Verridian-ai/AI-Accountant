# R05: Agent SDK & Framework Comparison Report

**Author:** Agent R05 — SDK Comparison Researcher
**Date:** 2026-02-12
**Scope:** Evaluate GoldLedger's custom ClaudeAgent architecture against alternative agent frameworks

---

## 1. Current Architecture — Assessment

### 1.1 Architecture Overview

GoldLedger uses a **custom TypeScript agent framework** built on the raw Anthropic SDK (`@anthropic-ai/sdk ^0.74.0`). The architecture consists of:

| Component | File | Role |
|-----------|------|------|
| **ClaudeAgent\<TInput, TOutput\>** | `base-agent.ts` | Abstract generic base class with agentic tool-use loop |
| **AgentOrchestrator** | `orchestrator.ts` | Registry, circuit breakers, SSE progress events, pipeline coordinator |
| **Config** | `config.ts` | Per-agent model selection, token budgets, feature flags |
| **Retry/Circuit Breaker** | `retry.ts` | Exponential backoff with jitter + circuit breaker pattern |
| **Client** | `client.ts` | Singleton Anthropic SDK instance |
| **Types** | `types.ts` | Strongly typed I/O contracts for all 11 agents |
| **CogneeTools** | `cognee-tools.ts` | Cognee RAG integration wrapper for agents |

**11 registered agents:**
`statement_parser`, `transaction_categorizer`, `gst_calculator`, `account_reconciler`, `budget_analyzer`, `cross_account_tracer`, `merchant_intelligence`, `payroll_agent`, `tax_strategy`, `personal_tax_claims`, `financial_planner`

### 1.2 Strengths

| Strength | Evidence |
|----------|----------|
| **Strong typing** | Generic `ClaudeAgent<TInput, TOutput>` with full I/O contracts in `types.ts`; orchestrator uses mapped types (`AgentInputMap`, `AgentOutputMap`) for compile-time safety |
| **Domain-specific tools** | Each agent defines its own tools + handlers (e.g., `lookup_merchant_memory`, `search_similar_transactions`, `batch_categorize`) — tightly coupled to business logic |
| **Token budget enforcement** | Per-agent `maxInputTokens`, `maxOutputTokens`, `maxToolCalls` with warning thresholds |
| **Robust error handling** | Per-tool circuit breaker (3 failures → skip), per-agent circuit breaker (5 failures → fallback), exponential backoff with jitter |
| **Model flexibility** | Per-agent model selection (Sonnet for complex tasks, Haiku for simple ones) with env var overrides |
| **SSE integration** | Orchestrator emits progress events (`started`, `completed`, `error`) via EventEmitter → SSE |
| **Cognee RAG** | Agents can search/index Cognee knowledge graph with smart search type selection per domain |
| **Learning loop** | TransactionCategorizer stores high-confidence results back to Cognee for merchant memory |
| **Pipeline orchestration** | `processStatement()` chains parse → categorize → GST in a single pipeline |
| **Minimal dependencies** | Only `@anthropic-ai/sdk` — no framework lock-in |
| **JSON output parsing** | Handles raw JSON, markdown-fenced JSON, and embedded JSON extraction |

### 1.3 Limitations

| Limitation | Impact | Severity |
|------------|--------|----------|
| **No streaming** | All agent calls are blocking `await`; no token-by-token streaming to client | **High** — poor UX for long-running agents (tax strategy, budget analyzer) |
| **Single-turn only** | Each `invoke()` is stateless — no multi-turn conversation across requests | **High** — cannot do follow-up questions or progressive refinement |
| **No session memory** | Agent state is lost after each call; merchant memory injected per-call | **Medium** — redundant context assembly on every invocation |
| **No human-in-the-loop** | No mechanism for agent to pause and ask user for input mid-execution | **High** — low-confidence results can't prompt user clarification |
| **Untyped tool inputs** | Tool handlers take `Record<string, unknown>` and cast manually | **Medium** — runtime type safety gap |
| **No parallel tool execution** | Tools execute sequentially in the loop; no parallel dispatch | **Low** — most agents have few tool calls |
| **No MCP support** | Tools are hand-coded; no Model Context Protocol integration | **Medium** — can't leverage MCP ecosystem |
| **Hardcoded business rules** | `TransactionCategorizerAgent` has Amica Beauty rules baked into system prompt | **Medium** — not multi-tenant friendly |
| **No observability/tracing** | Beyond SSE events, no structured logging of tool calls, tokens, latency | **Medium** — debugging is difficult |
| **No extended thinking** | Doesn't use Claude's extended thinking mode for complex reasoning | **Low** — could improve GST/tax accuracy |

### 1.4 Code Quality Assessment

The implementation is **clean and well-structured** for its scope:
- Clear separation of concerns (base, config, retry, types, orchestrator)
- Effective use of TypeScript generics
- Good error handling at every level
- ~215 lines for base-agent, ~253 for orchestrator — lean and readable

**Estimated LOC:** ~2,500 across all agent files (base + 11 agents + orchestrator + config + types + retry + client + cognee-tools)

---

## 2. Claude Agent SDK — Analysis

### 2.1 What It Is

The **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) is Anthropic's official framework for building AI agents. It provides the same tools, agent loop, and context management that power Claude Code, programmable in TypeScript and Python.

### 2.2 Key Features

| Feature | Description | Relevance to GoldLedger |
|---------|-------------|------------------------|
| **Built-in tools** | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion | Low — GoldLedger needs domain-specific tools, not file/code tools |
| **Streaming** | Async generator pattern (`for await (const message of query(...))`) | **High** — directly solves the streaming limitation |
| **Sessions** | Resume sessions with `session_id`; maintains full context across turns | **High** — solves multi-turn and session memory |
| **Subagents** | Spawn specialized agents within a parent agent via Task tool | **Medium** — matches orchestrator pattern but more flexible |
| **MCP support** | Connect external MCP servers (databases, browsers, APIs) | **Medium** — could connect Cognee as MCP server |
| **Hooks** | `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SessionEnd` callbacks | **High** — audit logging, validation, security middleware |
| **Permissions** | `bypassPermissions`, `acceptEdits`, custom permission modes | **Medium** — useful for security |
| **Skills** | Markdown-defined specialized capabilities | **Low** — more relevant for coding agents |
| **Custom agents** | Define agents with `description`, `prompt`, `tools` | **High** — maps to current agent definitions |

### 2.3 Compatibility Assessment

| Criterion | Assessment |
|-----------|------------|
| **Hono server** | Compatible — SDK runs server-side in Node.js; can be called from Hono route handlers |
| **Docker** | Compatible — requires `ANTHROPIC_API_KEY` env var; supports Bedrock/Vertex/Azure backends |
| **TypeScript** | Native TypeScript support |
| **Anthropic SDK** | Built on top of `@anthropic-ai/sdk` — compatible with existing client setup |
| **Cognee integration** | Would need custom tool definitions wrapping CogneeTools |
| **Structured output** | SDK returns message streams; JSON parsing would need custom handling |

### 2.4 Critical Limitations for GoldLedger

1. **Tool paradigm mismatch**: The Agent SDK's built-in tools are file/code-oriented (Read, Write, Bash). GoldLedger's tools are domain-specific (lookup_merchant_memory, search_similar_transactions, batch_categorize). **Custom tools must be defined via MCP or hacked in.**

2. **No typed I/O contracts**: The SDK uses free-form prompts → free-form text output. GoldLedger's `ClaudeAgent<TInput, TOutput>` generic pattern with typed contracts (`CategorizerInput → CategorizerOutput`) has no direct equivalent.

3. **Subprocess architecture**: The SDK spawns Claude as a subprocess. This is designed for CLI/CI/CD use cases, not for a web server handling concurrent requests. **Running 11 agent subprocesses in a Docker container could be resource-intensive.**

4. **Token budget control**: The SDK doesn't expose per-agent token budgets or tool call limits the way GoldLedger's config does.

5. **Model selection**: The SDK doesn't support per-agent model selection (Sonnet vs Haiku).

### 2.5 Migration Effort: **HIGH**

- Would require rewriting all 11 agents to use MCP tools or custom tool definitions
- Loss of typed I/O contracts unless a wrapper layer is built
- Subprocess model doesn't fit web server architecture well
- Token budgets and model selection would need custom wrappers
- Estimated effort: **4–6 weeks** for a full migration

---

## 3. Other Frameworks

### 3.1 Vercel AI SDK (v6)

**Package:** `ai` + `@ai-sdk/anthropic`

| Feature | Details |
|---------|---------|
| **Agent abstraction** | `ToolLoopAgent` — reusable agent with model, instructions, tools; auto-handles tool execution loop (up to 20 steps) |
| **Tool calling** | `tool()` with Zod schemas, `dynamicTool()`, approval workflows, strict mode, input examples |
| **Streaming** | `streamText()`, `streamObject()`, native token-by-token streaming |
| **Structured output** | `generateObject()` / `streamObject()` with Zod/JSON Schema validation |
| **Anthropic support** | First-class via `@ai-sdk/anthropic` — extended thinking, prompt caching, tool streaming, MCP connectors |
| **Multi-provider** | Unified API across OpenAI, Anthropic, Google, Mistral, etc. |
| **Middleware** | `wrapLanguageModel()` for custom model behavior modification |
| **Conversation** | `ModelMessage`/`UIMessage` types, `pruneMessages()`, context management |
| **Framework support** | React, Next.js, Vue, Svelte, Node.js — also works standalone in Hono |
| **MCP** | Stable HTTP transport, OAuth, resources, prompts, elicitation |
| **Human-in-the-loop** | `needsApproval` flag on tools with function-based logic |
| **Observability** | DevTools with step-by-step inspection, token usage, timing, raw payloads |

**Compatibility with GoldLedger:**
- **Excellent** — works with Hono, Docker, TypeScript natively
- `@ai-sdk/anthropic` supports Claude Sonnet/Haiku model selection
- Zod schemas replace the manual `Record<string, unknown>` casting
- `streamText()` directly solves the streaming limitation
- `generateObject()` replaces custom JSON parsing with validated structured output
- Tools defined with Zod → full type safety on inputs AND outputs
- Middleware can add token tracking, circuit breakers
- Does NOT force subprocess model — runs in-process

**Limitations:**
- No built-in circuit breaker (must implement)
- No built-in per-agent token budgets (must implement)
- Agent abstraction is relatively new (v6) — may have rough edges
- No native Cognee integration (but easy to wrap as tools)

**Migration effort: MEDIUM (2–3 weeks)**

### 3.2 LangChain.js / LangGraph.js

**Packages:** `@langchain/core`, `@langchain/anthropic`, `@langchain/langgraph`

| Feature | Details |
|---------|---------|
| **Agent abstraction** | `createAgent()` — highest-level abstraction; `AgentExecutor` for custom loops |
| **Graph-based orchestration** | LangGraph — stateful, durable graph-based agent workflows with checkpointing |
| **Tool calling** | `DynamicTool`, `StructuredTool` with Zod schemas, native function calling |
| **Streaming** | Token-by-token streaming + intermediate step streaming |
| **Anthropic support** | `@langchain/anthropic` — ChatAnthropic with tool calling, streaming |
| **Multi-provider** | Supports 50+ LLM providers |
| **State management** | LangGraph checkpointing — rewind, replay, fork state |
| **Human-in-the-loop** | First-class support in LangGraph with interrupt/resume |
| **Memory** | Conversation memory, vector store memory, entity memory |
| **Observability** | LangSmith integration for tracing, debugging, evaluation |

**Compatibility with GoldLedger:**
- Good TypeScript support (1.0 released)
- Works with Hono/Docker
- LangGraph's graph-based model maps well to GoldLedger's pipeline (parse → categorize → GST)
- Checkpointing could enable resumable statement processing

**Limitations:**
- **Heavy dependency tree** — LangChain adds significant bundle size
- **Abstraction tax** — wrapping everything in LangChain types adds complexity
- **Over-engineered for the use case** — GoldLedger's agents are relatively simple (single tool loop, not graph workflows)
- **Learning curve** — LangGraph's graph model is powerful but complex
- **Lock-in** — LangChain's abstractions make it harder to switch later

**Migration effort: HIGH (4–6 weeks)**

### 3.3 Microsoft Semantic Kernel

**Status:** Primarily .NET/Python; **TypeScript support is unofficial/experimental**

| Feature | Details |
|---------|---------|
| **Plugin system** | Encapsulate APIs into AI-callable plugins |
| **Planning** | Auto-planning via function calling |
| **Agent framework** | Multi-agent with specialized roles |
| **TypeScript** | Unofficial community port (`semantic-kernel-typescript` by lordkiz); NOT production-ready |
| **Anthropic** | No native Claude support — would need custom connector |

**Compatibility with GoldLedger:**
- **Poor** — TypeScript support is unofficial and incomplete
- No native Anthropic/Claude integration
- Primarily designed for Microsoft ecosystem (Azure OpenAI, Copilot SDK)
- Plugin model would require significant rewiring

**Migration effort: VERY HIGH (8+ weeks) — NOT RECOMMENDED**

---

## 4. Comparison Matrix

| Criterion | Current (Custom) | Claude Agent SDK | Vercel AI SDK v6 | LangChain/LangGraph | Semantic Kernel |
|-----------|-----------------|-----------------|-------------------|---------------------|-----------------|
| **Type safety** | ★★★★☆ (generics, typed I/O) | ★★☆☆☆ (free-form) | ★★★★★ (Zod, end-to-end) | ★★★☆☆ (Zod optional) | ★★☆☆☆ (unofficial TS) |
| **Streaming** | ☆☆☆☆☆ (none) | ★★★★★ (native async gen) | ★★★★★ (streamText/Object) | ★★★★☆ (native) | ★★☆☆☆ (limited) |
| **Multi-turn / Sessions** | ☆☆☆☆☆ (stateless) | ★★★★★ (session_id resume) | ★★★☆☆ (conversation mgmt) | ★★★★★ (checkpointing) | ★★★☆☆ (kernel state) |
| **Session memory** | ☆☆☆☆☆ (none) | ★★★★☆ (session persistence) | ★★☆☆☆ (manual) | ★★★★☆ (vector/entity) | ★★★☆☆ (plugin state) |
| **MCP support** | ☆☆☆☆☆ (none) | ★★★★★ (native) | ★★★★☆ (stable v6) | ★★☆☆☆ (community) | ☆☆☆☆☆ (none) |
| **Tool calling** | ★★★☆☆ (manual handlers) | ★★★★☆ (built-in + custom) | ★★★★★ (Zod, approval, strict) | ★★★★☆ (structured tools) | ★★★☆☆ (plugins) |
| **Cognee integration** | ★★★★★ (native wrapper) | ★★☆☆☆ (needs MCP/custom) | ★★★★☆ (easy tool wrap) | ★★★☆☆ (custom tool) | ★☆☆☆☆ (custom) |
| **Structured output** | ★★★☆☆ (JSON parse) | ★★☆☆☆ (text extraction) | ★★★★★ (generateObject) | ★★★★☆ (output parser) | ★★☆☆☆ (limited) |
| **Human-in-the-loop** | ☆☆☆☆☆ (none) | ★★★★☆ (AskUserQuestion) | ★★★★☆ (needsApproval) | ★★★★★ (interrupt/resume) | ★★★☆☆ (planner) |
| **Per-agent model selection** | ★★★★★ (native) | ★☆☆☆☆ (single model) | ★★★★★ (per-call model) | ★★★★☆ (configurable) | ★★★☆☆ (kernel config) |
| **Token budget control** | ★★★★★ (native) | ★☆☆☆☆ (none) | ★★★☆☆ (max_tokens only) | ★★☆☆☆ (manual) | ★★☆☆☆ (manual) |
| **Circuit breaker** | ★★★★★ (both per-tool + per-agent) | ☆☆☆☆☆ (none) | ☆☆☆☆☆ (must implement) | ☆☆☆☆☆ (must implement) | ☆☆☆☆☆ (must implement) |
| **Extended thinking** | ☆☆☆☆☆ (not used) | ★★★★☆ (supported) | ★★★★★ (budget config) | ★★★☆☆ (via provider) | ☆☆☆☆☆ (N/A) |
| **Observability** | ★★☆☆☆ (SSE events only) | ★★★☆☆ (message stream) | ★★★★★ (DevTools) | ★★★★★ (LangSmith) | ★★☆☆☆ (basic) |
| **Migration effort** | N/A | High (4-6 wks) | Medium (2-3 wks) | High (4-6 wks) | Very High (8+ wks) |
| **Bundle size impact** | Minimal | Medium (subprocess) | Small (~50KB) | Large (~500KB+) | Large |
| **Community / Ecosystem** | N/A | Growing (Anthropic-backed) | ★★★★★ (massive, Vercel) | ★★★★★ (largest AI community) | ★★★★☆ (Microsoft) |
| **Docker-local compat** | ★★★★★ | ★★★☆☆ (subprocess issues) | ★★★★★ | ★★★★★ | ★★★☆☆ |
| **Learning curve** | N/A (already known) | Medium | Low-Medium | High | High |
| **Anthropic-first** | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★☆☆☆☆ |

---

## 5. Recommendation: **HYBRID — Adopt Vercel AI SDK Incrementally**

### 5.1 Decision

**Do NOT do a full migration.** Instead, adopt a **hybrid approach**:

1. **Keep** the `ClaudeAgent<TInput, TOutput>` base class and typed I/O contracts — this is the architecture's strongest asset
2. **Adopt** Vercel AI SDK's `@ai-sdk/anthropic` provider for the API layer (replacing raw `@anthropic-ai/sdk` calls)
3. **Add** streaming via `streamText()` / `streamObject()` for client-facing agents
4. **Add** `generateObject()` with Zod schemas for structured output (replacing manual JSON parsing)
5. **Keep** circuit breakers, token budgets, and SSE integration as-is

### 5.2 Justification

| Factor | Reasoning |
|--------|-----------|
| **ROI** | Vercel AI SDK solves the three biggest gaps (streaming, structured output, type-safe tools) with minimal disruption |
| **Risk** | Full migration to Claude Agent SDK would break the typed I/O system and force subprocess architecture — too risky |
| **LangChain** | Over-engineered for GoldLedger's relatively simple agent patterns; adds heavy dependencies |
| **Semantic Kernel** | Non-starter — no production TypeScript support, no Claude integration |
| **Incremental** | Can migrate one agent at a time; old and new can coexist |
| **Escape hatch** | Vercel AI SDK's provider model means switching from Anthropic to another provider is trivial |
| **Community** | Vercel AI SDK has massive community, excellent docs, and rapid iteration |

### 5.3 What NOT to Adopt

- **Claude Agent SDK** — wrong architecture for web server (subprocess model); weak typed output; doesn't add enough value over raw SDK + Vercel AI SDK
- **LangChain/LangGraph** — only consider if GoldLedger evolves into complex multi-agent graph workflows (not currently needed)
- **Semantic Kernel** — TypeScript is not production-ready; Microsoft ecosystem lock-in

---

## 6. Migration Path

### Phase 1: Foundation (Week 1)

1. **Install Vercel AI SDK:**
   ```bash
   npm install ai @ai-sdk/anthropic zod
   ```

2. **Create a new base class** `VercelAgent<TInput, TOutput>` alongside existing `ClaudeAgent`:
   ```typescript
   import { generateObject, streamText } from 'ai';
   import { anthropic } from '@ai-sdk/anthropic';
   import { z } from 'zod';
   ```

3. **Define Zod schemas** for existing type contracts (e.g., `CategorizerOutputSchema`)

4. **Keep** `ClaudeAgent` working — both systems coexist

### Phase 2: Streaming Agent (Week 1–2)

5. **Migrate `budget_analyzer`** first — it's client-facing and most benefits from streaming
6. Wire `streamText()` through Hono SSE endpoint
7. Test streaming in the client (AnalyticsDashboard)

### Phase 3: Structured Output (Week 2)

8. **Migrate `transaction_categorizer`** — replace JSON parsing with `generateObject()` + Zod schema
9. **Migrate `gst_calculator`** — structured BAS labels output
10. Verify Cognee tool integration works with new tool definition format

### Phase 4: Remaining Agents (Week 2–3)

11. Migrate remaining agents one by one, prioritizing:
    - `merchant_intelligence` (benefits from streaming)
    - `statement_parser` (large output, benefits from structured output)
    - `tax_strategy`, `personal_tax_claims`, `financial_planner`
    - `account_reconciler`, `cross_account_tracer`, `payroll_agent`

### Phase 5: Cleanup (Week 3)

12. Remove old `ClaudeAgent` base class once all agents migrated
13. Update `client.ts` to use Vercel AI SDK's provider model
14. Add Vercel AI SDK DevTools for observability
15. Consider adding extended thinking for tax/GST agents

### Migration Checklist Per Agent

- [ ] Define Zod output schema matching existing TypeScript interface
- [ ] Define tools using `tool()` with Zod input schemas
- [ ] Replace `invoke()` with `generateObject()` or `streamText()` as appropriate
- [ ] Preserve token budget enforcement (via `maxTokens` parameter)
- [ ] Preserve model selection (Sonnet vs Haiku per agent)
- [ ] Preserve circuit breaker wrapper
- [ ] Preserve SSE progress events
- [ ] Test Cognee tool integration
- [ ] Verify output matches existing contract
- [ ] Update orchestrator to use new agent

### Dependencies to Add

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/anthropic": "^1.0.0",
  "zod": "^3.23.0"
}
```

### Dependencies to Remove (after full migration)

```json
{
  "@anthropic-ai/sdk": "^0.74.0"  // replaced by @ai-sdk/anthropic
}
```

Note: `@ai-sdk/anthropic` wraps `@anthropic-ai/sdk` internally, so there's no functionality loss.

---

## Appendix A: Framework Links

- **Vercel AI SDK v6**: https://vercel.com/blog/ai-sdk-6
- **AI SDK Anthropic Provider**: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
- **Claude Agent SDK (TS)**: https://github.com/anthropics/claude-agent-sdk-typescript
- **Claude Agent SDK Docs**: https://platform.claude.com/docs/en/agent-sdk/overview
- **LangGraph.js**: https://github.com/langchain-ai/langgraphjs
- **Semantic Kernel**: https://github.com/microsoft/semantic-kernel

## Appendix B: Current vs Proposed Code Pattern

### Current (raw Anthropic SDK)
```typescript
// base-agent.ts — manual tool loop
const response = await this.client.messages.create({
  model: this.model,
  max_tokens: budget.maxOutputTokens,
  system: this.systemPrompt,
  tools: this.tools,
  messages,
});
// Manual JSON parsing from text block
const parsed = this.parseJsonOutput(textBlock.text);
```

### Proposed (Vercel AI SDK)
```typescript
// vercel-agent.ts — typed structured output
const result = await generateObject({
  model: anthropic('claude-sonnet-4-5-20250929'),
  schema: CategorizerOutputSchema,
  system: this.systemPrompt,
  tools: this.zodTools,
  prompt: JSON.stringify(input),
  maxTokens: budget.maxOutputTokens,
  maxSteps: budget.maxToolCalls,
});
// result.object is fully typed CategorizerOutput — no JSON parsing needed
```

### Proposed (Streaming)
```typescript
// For client-facing agents (budget, tax, financial planner)
const stream = streamText({
  model: anthropic('claude-sonnet-4-5-20250929'),
  system: this.systemPrompt,
  tools: this.zodTools,
  prompt: JSON.stringify(input),
  maxTokens: budget.maxOutputTokens,
  maxSteps: budget.maxToolCalls,
});
// Pipe to Hono SSE response
for await (const chunk of stream.textStream) {
  sseController.enqueue(chunk);
}
```
