# T9: Python Agent & Dual-Orchestrator Alignment Audit

**Auditor:** Teammate 9 (Python Agent & Dual-Orchestrator Alignment Engineer)
**Date:** 2026-02-11
**Status:** Complete
**Scope:** Python agent health, subprocess orchestrator correctness, TS/Python alignment, observability

---

## Table of Contents

1. [Registry Coverage: Can All 7 Python Agents Be Invoked?](#1-registry-coverage)
2. [Python Dependencies Audit](#2-python-dependencies)
3. [Timeout Management & Zombie Prevention](#3-timeout-management)
4. [Cache Key Determinism & Collision Analysis](#4-cache-key-analysis)
5. [Health Tracking & Circuit Breaking](#5-health-tracking)
6. [Tracing: End-to-End Observability](#6-tracing)
7. [TS ↔ Python Consistency Cross-Check](#7-ts-python-consistency)
8. [Python Observability Integration](#8-observability-integration)
9. [Subprocess Spawning Protocol](#9-subprocess-protocol)
10. [Summary of Findings](#10-summary)

---

## 1. Registry Coverage

### Registered Agents (4 of 7)

The TS orchestrator registry at `server/src/services/orchestrator/registry.ts:29-105` defines only **4 agents**:

| Agent Type | Script Path | Timeout | Max Retries |
|---|---|---|---|
| `financial-analyst` | `financial_analyst.py` | 60s | 3 |
| `bas` | `bas_agent.py` | 45s | 3 |
| `tax` | `tax_agent.py` | 60s | 3 |
| `reconciliation` | `reconciliation_agent.py` | 30s | 2 |

The `AgentType` union type at `types.ts:12` confirms: `'financial-analyst' | 'bas' | 'tax' | 'reconciliation'`

### Missing from Registry (3 agents)

The following Python agents exist in `server/src/services/agents/` but are **NOT registered** in the subprocess orchestrator:

| Python Agent File | Class | Status |
|---|---|---|
| `cgt_calculator.py` | `CGTCalculator` | **NOT registered** - Pure calculation module, no `BaseAgent` subclass, no stdin/stdout protocol |
| `depreciation_calculator.py` | `DepreciationCalculator` | **NOT registered** - Pure calculation module, no `BaseAgent` subclass |
| `code_interpreter.py` | `CodeInterpreter` | **NOT registered** - Support module used by `BaseAgent._register_tools()` |

**FINDING [F1-INFO]:** The "7 Python agents" framing is misleading. There are 4 actual agents (subclasses of `BaseAgent` with stdin/stdout JSON protocol support) and 3 support modules (CGT calculator, depreciation calculator, code interpreter). The support modules are imported and used as tools *within* the 4 agents (e.g., `tax_agent.py:21-32` imports both CGT and depreciation). They cannot be invoked independently via the subprocess orchestrator because they lack the `BaseAgent.run()` protocol.

**FINDING [F2-WARN]:** The Python `runner.py:22-27` also registers only 4 agents in its `AGENTS` dict:
```python
AGENTS = {
    "financial_analyst": FinancialAnalystAgent,
    "bas": BASAgent,
    "tax": TaxAgent,
    "reconciliation": ReconciliationAgent,
}
```
This aligns with the TS registry, but note the key naming convention mismatch: TS uses kebab-case (`financial-analyst`) while Python uses snake_case (`financial_analyst`).

### Agent Name Misalignment

| TS Registry ID | Python `agent_name` | Python `runner.py` Key | Issue |
|---|---|---|---|
| `financial-analyst` | `financial_analyst` | `financial_analyst` | Kebab vs snake_case |
| `bas` | `bas_agent` | `bas` | `agent_name` has `_agent` suffix |
| `tax` | `tax_agent` | `tax` | `agent_name` has `_agent` suffix |
| `reconciliation` | `reconciliation_agent` | `reconciliation` | `agent_name` has `_agent` suffix |

**FINDING [F3-LOW]:** The `agent_name` property on Python agents includes `_agent` suffix (e.g., `bas_agent.py:25` → `agent_name = "bas_agent"`) but this is only used for tracing/logging, not for routing. No functional impact since the orchestrator routes by TS registry ID, not by Python agent_name.

---

## 2. Python Dependencies

### `server/requirements.txt` (4 lines)

```
pydantic>=2.0.0,<3.0.0
python-dotenv>=1.0.0
openai>=1.0.0
httpx>=0.27.0
```

### Missing Dependencies

**FINDING [F4-CRITICAL]:** Multiple Python imports will fail at runtime because their packages are not in `requirements.txt`:

| Import | File:Line | Package Needed | Status |
|---|---|---|---|
| `from pydantic_ai import Agent` | `base.py:8` | `pydantic-ai` | **MISSING** |
| `from pydantic_ai.models.openai import OpenAIModel` | `base.py:9` | `pydantic-ai` | **MISSING** |
| `import logfire` | `observability.py:11` | `logfire` (optional, gracefully handled) | Missing but guarded |

Without `pydantic-ai`, **ALL 4 agents will fail to instantiate** because `BaseAgent._create_agent()` at `base.py:78-85` creates a `pydantic_ai.Agent` instance. The import at line 8 (`from pydantic_ai import Agent`) will raise `ModuleNotFoundError`.

**FINDING [F5-LOW]:** Dependencies are version-range pinned (e.g., `pydantic>=2.0.0,<3.0.0`) rather than exact-pinned (e.g., `pydantic==2.10.3`). This is acceptable for development but risky for production Docker builds where version drift could introduce breakage. No lockfile exists.

**FINDING [F6-INFO]:** The `logfire` import in `observability.py:11-12` is correctly guarded with try/except, so missing `logfire` won't crash agents. However, `pydantic-ai` is not guarded.

---

## 3. Timeout Management & Zombie Prevention

### Timeout Implementation

The timeout is implemented at `orchestrator.ts:309-315`:

```typescript
const timeoutId = setTimeout(() => {
    if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill('SIGKILL');
    }
    controller.abort();
    safeReject(this.createError('TIMEOUT', ...));
}, timeoutMs);
```

**FINDING [F7-GOOD]:** Timeout correctly uses `SIGKILL` (not `SIGTERM`) to forcefully terminate the Python subprocess. This prevents agents from ignoring the kill signal.

**FINDING [F8-GOOD]:** The timeout is cleared on normal process exit at `orchestrator.ts:346` (`clearTimeout(timeoutId)`), preventing the timeout from firing after process completion.

**FINDING [F9-WARN]:** No SIGTERM → SIGKILL escalation pattern. The code jumps straight to `SIGKILL`, which means:
- Python agents have no chance to clean up resources (close connections, flush logs)
- If the Python agent has spawned child processes, those may become orphans since SIGKILL doesn't propagate to the process group

**FINDING [F10-WARN]:** No process group kill. The spawn call at `orchestrator.ts:326` does not use `detached: true` + `process.kill(-pid)`, so child processes of the Python agent (if any) could become zombies.

**FINDING [F11-GOOD]:** The `isSettled` guard pattern at `orchestrator.ts:287-306` prevents double-resolution of the Promise, which could occur if timeout fires simultaneously with process exit.

### Zombie Accumulation Risk

**FINDING [F12-LOW]:** Each agent invocation spawns a new Python process (`spawn('python', [config.scriptPath])`). There is no process pool or concurrency limit. Under heavy load, this could spawn many concurrent Python processes. The commented-out `requestQueue` at `orchestrator.ts:35` suggests this was planned but not implemented.

The `AbortController` at `orchestrator.ts:285` + `signal` option at `orchestrator.ts:331` provides a cancellation mechanism, but it's only used for manual cancel requests (`cancel()` method), not for concurrency limits.

---

## 4. Cache Key Determinism & Collision Analysis

### Cache Key Generation

At `cache.ts:25-36`:

```typescript
export function generateCacheKey(agentType, query, contextHash) {
    const data = JSON.stringify({
        agentType,
        query: query.trim().toLowerCase(),
        contextHash,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
}
```

**FINDING [F13-GOOD]:** Cache keys are deterministic:
- Uses SHA-256 (collision-resistant)
- Query is normalized: `trim().toLowerCase()`
- Includes `agentType` to prevent cross-agent collisions
- Context is hashed separately via `hashContext()`

### Context Hashing

At `cache.ts:41-44`:

```typescript
export function hashContext(context: Record<string, unknown>): string {
    const sortedContext = JSON.stringify(context, Object.keys(context).sort());
    return crypto.createHash('md5').update(sortedContext).digest('hex');
}
```

**FINDING [F14-WARN]:** `Object.keys(context).sort()` only sorts **top-level** keys. Nested objects are not recursively sorted. For example:

```javascript
hashContext({a: {z: 1, a: 2}}) !== hashContext({a: {a: 2, z: 1}})
```

This could cause cache misses for semantically identical contexts with differently-ordered nested keys. However, since `AgentContext` has a fixed schema (`transactionIds`, `accountIds`, `dateRange`, etc.), this is unlikely to be a practical issue.

**FINDING [F15-INFO]:** MD5 is used for context hashing. While MD5 is cryptographically weak, it's used here only as a cache key component (inside SHA-256), so collision attacks are not a concern.

### Cache Configuration

- Max entries: 1000 (`types.ts:275`)
- Default TTL: 5 minutes (`types.ts:276`)
- LRU eviction when at capacity (`cache.ts:139-141`)
- Periodic cleanup every 5 minutes (`cache.ts:351-353`)

**FINDING [F16-GOOD]:** Cache is well-designed with LRU eviction, TTL expiry, per-agent clearing, and proper cleanup on process exit.

---

## 5. Health Tracking & Circuit Breaking

### Health State Machine

At `registry.ts:442-477`, health states are calculated:

| Condition | State |
|---|---|
| `successRate >= 0.95 && p95 <= 30s && errors <= 3` | `healthy` |
| `successRate >= 0.80 && p95 <= 60s && errors <= 10` | `degraded` |
| Otherwise | `unhealthy` |

### Circuit Breaker

At `health.ts:58-177`, the circuit breaker implements standard three-state pattern:

| State | Behavior |
|---|---|
| `closed` | All requests pass through. Opens after 3 consecutive failures |
| `open` | Blocks all requests. Transitions to half-open after 30s |
| `half-open` | Allows probe requests. Closes after 2 successes; reopens on any failure |

**FINDING [F17-CRITICAL]:** The circuit breaker in `health.ts` is **NOT integrated** with the orchestrator. The `AgentOrchestrator.execute()` method at `orchestrator.ts:44-96` does NOT check `healthMonitor.allowRequest()` before spawning a process. The circuit breaker exists but is **dead code** from the orchestrator's perspective.

Evidence: `orchestrator.ts` imports from `registry.js` and `cache.js` but does NOT import from `health.js`. The health monitor tracks metrics but never blocks requests.

**FINDING [F18-WARN]:** The `HealthMonitor.start()` only auto-starts in production (`health.ts:501-503`):
```typescript
if (process.env.NODE_ENV === 'production') {
    healthMonitor.start();
}
```
In development, no periodic health checks run, so health state remains `unknown` for all agents.

**FINDING [F19-WARN]:** Health checks spawn Python agents with `--health-check` flag (`health.ts:305`):
```typescript
healthCheckProcess = spawn('python', [scriptPath, '--health-check']);
```
But **no Python agent handles `--health-check`**. The base `BaseAgent` class has no CLI argument parsing. The agents only accept input via `AGENT_INPUT` env var or stdin (as per `orchestrator.ts:318-331`). This means health checks will always fail because the Python process will attempt to initialize the full agent without the required input, likely crashing with a `pydantic-ai` error.

---

## 6. Tracing: End-to-End Observability

### TS-Side Tracing (Langfuse)

At `tracing.ts:134-505`, the `AgentTracer` provides:

- Trace lifecycle: `startTrace()` → `addEvent()` → `endTrace()`
- Langfuse integration (optional, via dynamic import)
- Local in-memory trace storage as fallback
- Memory management: max 1000 traces, 30-minute retention
- Sample rate support

**FINDING [F20-GOOD]:** The TS orchestrator correctly instruments the full request lifecycle:
1. `execute()` → `startTrace()` at `orchestrator.ts:53`
2. Cache hit/miss events at `orchestrator.ts:63`
3. Retry attempts at `orchestrator.ts:200`
4. Success/error recording at `orchestrator.ts:211` / `orchestrator.ts:236`
5. `endTrace()` at `orchestrator.ts:86` / `orchestrator.ts:93`

### Python-Side Tracing (Logfire)

At `observability.py:37-128`, the `AgentTracer` provides:
- Per-agent trace tracking with steps, tool use, reasoning
- Logfire integration (optional, via try/except import)
- Decorator `@trace_operation` for automatic tracing

**FINDING [F21-WARN]:** The two tracing systems are **completely separate** and **not correlated**:

- TS side uses `requestId` (UUID) as trace ID
- Python side generates its own trace ID: `f"{agent_name}_{operation}_{timestamp}"` at `observability.py:46`
- The `requestId` is passed to Python via `AGENT_INPUT` env var (`orchestrator.ts:319`) but the Python `BaseAgent.run()` at `base.py:161-179` does NOT use it for tracing. Instead, it creates a new trace with `self.tracer.trace_start("run", query=query[:200])`.

This means there is **no way to correlate a TS trace with its corresponding Python trace** without manual timestamp matching.

**FINDING [F22-WARN]:** Python traces are stored in-memory on the `AgentTracer` instance (`observability.py:43`), but since each orchestrator invocation spawns a fresh Python process, all traces are lost when the process exits. The `get_all_traces()` method at `base.py:181-183` is never callable from TS since traces exist only within the subprocess's memory.

---

## 7. TS ↔ Python Consistency Cross-Check

### Dual Agent Systems

The codebase has **TWO completely separate agent systems**:

1. **Claude Agents (TS):** `server/src/services/claude/agents/` - Uses Anthropic SDK directly
   - `gst-calculator.ts` (GSTCalculatorAgent)
   - `account-reconciler.ts` (AccountReconcilerAgent)
   - Plus others (statement-parser, budget-analyzer, etc.)

2. **Python Agents:** `server/src/services/agents/` - Uses Pydantic AI + OpenRouter
   - `bas_agent.py` (BASAgent)
   - `reconciliation_agent.py` (ReconciliationAgent)
   - Plus tax and financial analyst

### GST/BAS: TS vs Python Comparison

| Aspect | TS `gst-calculator.ts` | Python `bas_agent.py` + `gst_rules.py` |
|---|---|---|
| **GST Formula** | `calculateGstFromInclusive()` from `bas.ts` | `calculate_gst_from_inclusive()` at `gst_rules.py:147-163` |
| **Formula** | `round(abs(amount) * rate / (1 + rate))` | `round(abs(amount_cents) * gst_rate / (1 + gst_rate))` |
| **Match?** | **YES** - Identical formula | |
| **Category System** | `GSTCategory` enum in `bas.ts:11-18` | `GSTCategory` enum in `gst_rules.py:14-22` |
| **Categories** | `TAXABLE_10, GST_FREE, INPUT_TAXED, EXPORT, CAPITAL, PRIVATE` | Same + `NO_ABN` (extra) |
| **BAS Labels** | `BASLabels` interface in `bas.ts:28-41` | `BASLabel` enum in `gst_rules.py:25-38` |
| **Labels** | `G1,G2,G3,G10,G11,1A,1B,W1,W2,5A,7C,7D` | Same set |
| **Match?** | **YES** - Labels match | |
| **Classification** | Keyword-based Sets (`GST_FREE_KEYWORDS`, `INPUT_TAXED_KEYWORDS`, etc.) at `gst-calculator.ts:26-51` | Regex-based patterns (`GST_FREE_PATTERNS`, `INPUT_TAXED_PATTERNS`, etc.) at `gst_rules.py:54-144` |
| **Match?** | **PARTIAL** - Same intent but different keyword sets | |

**FINDING [F23-HIGH]:** GST classification keyword/pattern divergence between TS and Python:

1. **TS** uses simple `Set.has()` substring matching; **Python** uses regex patterns
2. **TS** has `PRIVATE_KEYWORDS` including `'bpay'`, `'direct debit'`, `'osko'`, `'superannuation'`, `'salary'`, `'wages'`, `'dividend'`, `'depreciation'` — these are **absent from Python's** `PRIVATE_PATTERNS`
3. **Python** has `PRIVATE_PATTERNS` with `'atm withdrawal'`, `'cash withdrawal'`, `'transfer to self'`, `'personal'`, `'grocery'`, `'netflix'`, `'spotify'`, `'disney+'`, `'gym membership'` — these are **absent from TS's** `PRIVATE_KEYWORDS`
4. **Python** has `NO_ABN` category not present in TS
5. **TS** has explicit `CATEGORY_GST_MAP` at `gst-calculator.ts:54-88` that maps app categories → GST treatment. Python has no equivalent and relies purely on description regex.

This means the **same transaction will get different GST classifications depending on which system processes it**. Example: A "BPAY" transaction is `private` in TS but would be `taxable_10` (default) in Python.

**FINDING [F24-MEDIUM]:** Capital acquisition threshold difference:
- **TS** (`gst-calculator.ts:329`): Capital if GST-exclusive >= $1,000 AND has capital keyword, OR if total > $20,000
- **Python** (`gst_rules.py:252`): Capital if matches `CAPITAL_PATTERNS` regex (no amount threshold)

Different thresholds mean the same purchase could be classified as G10 (capital) in one system and G11 (non-capital) in the other.

**FINDING [F25-MEDIUM]:** Motor vehicle GST cap exists in TS (`gst-calculator.ts:91`: $68,108) but not in Python's BAS agent.

### Reconciliation: TS vs Python Comparison

| Aspect | TS `account-reconciler.ts` | Python `reconciliation_agent.py` |
|---|---|---|
| **Duplicate Detection** | O(n^2) pairwise comparison, exact match on date+amount+description, or date+amount at 0.7 confidence (`account-reconciler.ts:169-202`) | Key-based detection using `{amount}_{date}_{description[:20]}` (`reconciliation_agent.py:53-82`) |
| **Balance Verification** | Checks `closingBalance == next.openingBalance` across sorted statements (`account-reconciler.ts:206-239`) | Checks `opening + sum(transactions) == closing` for a single statement (`reconciliation_agent.py:85-120`) |
| **Transfer Detection** | Uses `TransferDetector` class with cross-account matching (`account-reconciler.ts:264-272`) | Simple income/expense amount matching within tolerance days (`reconciliation_agent.py:122-187`) |
| **Continuity Check** | Verifies balance continuity | Checks for date gaps/overlaps between statements (`reconciliation_agent.py:189-236`) |

**FINDING [F26-MEDIUM]:** The two reconciliation systems check different things:
- **TS** reconciler verifies balance chain (closing = next opening) across statements
- **Python** reconciler verifies arithmetic (opening + transactions = closing) within a statement
- These are complementary, not conflicting, but there's no unified reconciliation flow

**FINDING [F27-LOW]:** Python duplicate detection truncates description to 20 chars (`reconciliation_agent.py:56`) which is more aggressive than TS (full description match). This could cause false positives in Python that TS would not flag.

---

## 8. Python Observability Integration

### Logfire Integration

At `observability.py:23-34`:

```python
def init_observability():
    if LOGFIRE_AVAILABLE and LOGFIRE_TOKEN:
        logfire.configure(token=LOGFIRE_TOKEN, ...)
        logfire.instrument_pydantic_ai()
        return True
    return False
```

**FINDING [F28-GOOD]:** Logfire integration is properly optional with graceful degradation. The `LOGFIRE_AVAILABLE` flag is set via try/except import at `observability.py:11-15`.

**FINDING [F29-WARN]:** `init_observability()` is called at module load time (`base.py:21`) which means it runs on every subprocess spawn. Since each agent invocation creates a new Python process, Logfire initialization happens per-request, not once at startup. This is wasteful but not harmful.

### Trace Decorator

The `@trace_operation` decorator at `observability.py:130-173` supports both sync and async functions, properly wrapping with trace start/end and error handling.

**FINDING [F30-INFO]:** The decorator is defined but **never used** in any of the 4 agents. All agents rely on manual `self.tracer.trace_start()`/`trace_end()` calls in `BaseAgent.run()` at `base.py:168-179`.

---

## 9. Subprocess Spawning Protocol

### Input Protocol

The orchestrator sends input to Python agents via **two channels simultaneously** (`orchestrator.ts:317-389`):

1. **Environment variable:** `AGENT_INPUT` = JSON string (`orchestrator.ts:329`)
2. **stdin:** Same JSON string written to `pythonProcess.stdin` (`orchestrator.ts:388-389`)

```typescript
// Env var
env: { ...process.env, AGENT_INPUT: input }
// AND stdin
pythonProcess.stdin?.write(input);
pythonProcess.stdin?.end();
```

**FINDING [F31-CRITICAL]:** The Python `BaseAgent` class does **NOT read from either channel**. Looking at `base.py`, the `run()` method at line 161 expects `query` and `context` as direct Python arguments:

```python
async def run(self, query: str, context: AgentContext = None) -> AgentResponse:
```

There is no code in `base.py` that reads from `sys.stdin` or `os.environ['AGENT_INPUT']`. The `runner.py` CLI at `runner.py:107-184` reads from `sys.argv`, not stdin or env vars.

This means the orchestrator spawns `python financial_analyst.py` but the Python script has no way to receive the input. The script would need either:
- A `__main__` block that reads `AGENT_INPUT` from env/stdin and calls `agent.run()`
- Or the orchestrator should call `runner.py run financial_analyst <json>` instead

**This is a complete integration failure** — the TS orchestrator and Python agents cannot communicate at all in the current implementation.

### Output Protocol

The orchestrator expects JSON on stdout (`orchestrator.ts:358-374`):

```typescript
const result = JSON.parse(stdout);
safeResolve({
    content: result.content || result.response || '',
    data: result.data,
    toolCalls: result.toolCalls,
    agentTimeMs: result.executionTimeMs || 0,
    ...
});
```

**FINDING [F32-CRITICAL]:** The Python `AgentResponse` model at `base.py:42-49` outputs:

```python
class AgentResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    reasoning: Optional[str] = None
    code_executed: Optional[str] = None
    code_result: Optional[Any] = None
```

The TS orchestrator expects `content` or `response` field, but Python outputs `message`. Field name mismatch:

| TS Expects | Python Outputs | Match? |
|---|---|---|
| `content` or `response` | `message` | **NO** |
| `data` | `data` | YES |
| `toolCalls` | (none) | **NO** |
| `executionTimeMs` | (none) | **NO** |
| `modelUsed` | (none) | **NO** |
| `tokenUsage` | (none) | **NO** |
| `version` | (none) | **NO** |

The `content` field at `orchestrator.ts:361` would be empty string since `result.content` and `result.response` are both undefined. The actual response text is in `result.message`.

### Which Orchestrator is Actually Used?

**FINDING [F33-HIGH]:** The routes at `server/src/routes/agents.ts` import from the **Claude orchestrator** (`server/src/services/claude/orchestrator.js`), NOT from the Python subprocess orchestrator (`server/src/services/orchestrator/orchestrator.js`):

```typescript
// agents.ts:8
import { orchestrator } from '../services/claude/orchestrator.js';
```

This means the API endpoints (`/api/agents/analyze`, `/api/agents/bas/calculate`, `/api/agents/reconcile`) use the **TS Claude agents**, not the Python agents. The entire Python subprocess orchestrator appears to be **unused in production routes**.

---

## 10. Summary of Findings

### Critical Issues

| ID | Description | Files |
|---|---|---|
| **F4** | `pydantic-ai` missing from `requirements.txt` — all Python agents will fail to import | `requirements.txt`, `base.py:8` |
| **F17** | Circuit breaker exists but is NOT integrated with orchestrator — unhealthy agents are never blocked | `health.ts`, `orchestrator.ts` |
| **F31** | Python agents have no stdin/env reader — orchestrator cannot send input to agents | `orchestrator.ts:317-389`, `base.py:161` |
| **F32** | Response field name mismatch: TS expects `content`, Python outputs `message` | `orchestrator.ts:361`, `base.py:42-49` |
| **F33** | API routes use Claude TS orchestrator, not Python subprocess orchestrator — Python system is entirely unused | `routes/agents.ts:8` |

### High Issues

| ID | Description | Files |
|---|---|---|
| **F23** | GST classification divergence: TS and Python use different keyword sets → same transaction gets different categories | `gst-calculator.ts:26-51`, `gst_rules.py:54-144` |

### Medium Issues

| ID | Description | Files |
|---|---|---|
| **F24** | Capital acquisition threshold differs between TS ($1,000 GST-excl + keyword OR $20K total) and Python (regex only, no threshold) | `gst-calculator.ts:329`, `gst_rules.py:252` |
| **F25** | Motor vehicle GST cap ($68,108) exists in TS but not Python | `gst-calculator.ts:91` |
| **F26** | Reconciliation systems check complementary but different aspects with no unified flow | `account-reconciler.ts`, `reconciliation_agent.py` |

### Warnings

| ID | Description | Files |
|---|---|---|
| **F9** | SIGKILL with no SIGTERM escalation — no graceful shutdown for Python agents | `orchestrator.ts:311` |
| **F10** | No process group kill — child processes of agents could become orphans | `orchestrator.ts:326` |
| **F14** | Context hash only sorts top-level keys — nested object key order may cause cache misses | `cache.ts:42` |
| **F18** | Health monitor only starts in production `NODE_ENV` | `health.ts:501-503` |
| **F19** | Health checks pass `--health-check` flag but no Python agent handles it | `health.ts:305` |
| **F21** | TS and Python tracing systems are uncorrelated — no shared trace ID | `tracing.ts`, `observability.py` |
| **F22** | Python traces are in-memory per subprocess — all lost when process exits | `observability.py:43` |
| **F29** | Logfire init runs on every subprocess spawn (per-request) | `base.py:21` |

### Informational / Low

| ID | Description | Files |
|---|---|---|
| **F1** | 4 actual agents + 3 support modules, not 7 agents | Registry analysis |
| **F2** | TS kebab-case vs Python snake_case naming convention | `registry.ts:29`, `runner.py:22` |
| **F3** | Python `agent_name` includes `_agent` suffix (cosmetic) | `bas_agent.py:25` |
| **F5** | Dependencies version-range pinned, no lockfile | `requirements.txt` |
| **F12** | No concurrency limit on subprocess spawning | `orchestrator.ts:35` |
| **F27** | Python truncates description to 20 chars for duplicate detection | `reconciliation_agent.py:56` |
| **F30** | `@trace_operation` decorator defined but unused | `observability.py:130` |

---

## Architectural Assessment

The Python agent subsystem represents an **alternative implementation** to the primary Claude (TS) agent system. The two systems are:

1. **Not connected:** The subprocess orchestrator (`orchestrator/orchestrator.ts`) is not used by any route
2. **Not compatible:** Input/output protocols don't match between TS spawner and Python agents
3. **Not consistent:** GST classification rules diverge between the two systems

The Claude TS agents are the **production system** (connected to routes, using Anthropic SDK). The Python Pydantic AI agents appear to be a **parallel prototype** that was never fully integrated.

If the intent is to use both systems, the following must be addressed:
1. Add `pydantic-ai` to `requirements.txt`
2. Add `__main__` blocks to Python agents that read from stdin/env and output JSON
3. Align response schemas (Python `message` → TS `content`)
4. Integrate circuit breaker with orchestrator
5. Unify GST classification rules into a shared source of truth
6. Connect Python orchestrator routes or remove dead code
