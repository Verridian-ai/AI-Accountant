# AGENT-TEAM-9 — Full Skill Armada Build

## MISSION
Build the complete skill armada for Claude Code agent teams. This team will:
1. Research the internet for best practices across all coding domains (Haiku research agents)
2. Build comprehensive skill files covering every major topic
3. Seed all research into hive memory for permanent team intelligence
4. Ensure every future agent team has instant access to world-class knowledge

This is a knowledge-building mission. No source code is modified.

## MODELS
- agent-01 (research): claude-haiku-4-6
- agent-02 (research): claude-haiku-4-6
- agent-03 (skills builder): claude-sonnet-4-6
- agent-04 (reviewer + hive seeder): claude-sonnet-4-6

## PROJECT ROOT
/mnt/c/Users/Danie/Desktop/CBA Statements Parse

## HIVE MEMORY — MANDATORY FOR ALL AGENTS

**MCP Server**: `cognee-agent-teams` → `http://localhost:9021/mcp`

### EVERY AGENT MUST DO AT SESSION START:
```
mcp__cognee-agent-teams__get_developer_rules()
mcp__cognee-agent-teams__search(search_query="skill building agent teams", search_type="GRAPH_COMPLETION")
```

### EVERY AGENT MUST DO BEFORE MESSAGING DONE:
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-9-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [full summary of what was researched/built/stored]"
)
```

---

## GLOBAL RULES

1. NEVER modify any source code files (server/, client/)
2. Only create/edit files in .claude/skills/ and agent-team-9/
3. Use /firecrawl to scrape internet content for research
4. Use /context7 to get current library documentation
5. Store ALL research findings to hive memory via cognify
6. Commit after each skill file is complete
7. No human approval needed — proceed autonomously

---

## WAVE STRUCTURE

### WAVE 1 (parallel — start immediately)
- **agent-01-research-ui**: Haiku research agent — UI/UX, 3D, animations, design systems
- **agent-02-research-backend**: Haiku research agent — backend patterns, APIs, databases, DevOps

### WAVE 2 (after Wave 1 DONE)
- **agent-03-skills-builder**: Sonnet — builds remaining skill files using Wave 1 research from hive memory
- **agent-04-hive-seeder**: Sonnet — seeds all skill content into hive memory + final review

---

## WAVE 1 ASSIGNMENTS

### AGENT-01: research-ui (model: claude-haiku-4-6)
Task file: agent-team-9/tasks/agent-01-research-ui.md

### AGENT-02: research-backend (model: claude-haiku-4-6)
Task file: agent-team-9/tasks/agent-02-research-backend.md

---

## WAVE 2 ASSIGNMENTS

### AGENT-03: skills-builder (model: claude-sonnet-4-6)
Task file: agent-team-9/tasks/agent-03-skills-builder.md
**Start condition**: Both Wave 1 agents have messaged DONE

### AGENT-04: hive-seeder (model: claude-sonnet-4-6)
Task file: agent-team-9/tasks/agent-04-hive-seeder.md
**Start condition**: agent-03 has messaged DONE

---

## DONE SIGNALS
- `DONE: research-ui`
- `DONE: research-backend`
- `DONE: skills-builder`
- `DONE: hive-seeder — TEAM COMPLETE`

---

## SKILLS BUILT BY THIS TEAM (agent-team-9)

All 15 GoldLedger-specific skills are seeded to hive memory. Query via:
`mcp__cognee-agent-teams__search(search_query="...", search_type="CHUNKS")`

### Frontend Skills (Wave 1 — agent-01)
| File | Topics | Lines |
|------|---------|-------|
| `react-component-patterns.md` | React 19 hooks, Radix UI, shadcn/ui, mobile-first Tailwind | ~1100 |
| `animation-motion-design.md` | Motion/Framer Motion, GSAP timelines, SVG animations | ~950 |
| `design-systems-tokens.md` | Design tokens, Storybook, semantic mapping, gold theme | ~1200 |
| `accessibility-a11y.md` | WCAG 2.1, ARIA, keyboard nav, screen reader patterns | ~1300 |
| `ui-design-3d-animations.md` | Award-winning UI, Three.js/R3F, GSAP ScrollTrigger | ~800 |

### Backend Skills (Wave 1 — agent-02)
| File | Topics | Lines |
|------|---------|-------|
| `api-design-hono-patterns.md` | Hono sub-apps, zValidator, middleware, SSE | ~442 |
| `database-drizzle-patterns.md` | Drizzle ORM, schema, migrations, Neon pooling | ~356 |
| `security-auth-patterns.md` | JWT, tenant isolation, RBAC, OWASP headers | ~372 |
| `devops-infrastructure.md` | Docker multi-stage, Compose 5 services, nginx SSE | ~408 |
| `testing-quality-assurance.md` | Vitest, Playwright E2E, Hono route testing, fixtures | ~422 |

### Cross-Cutting Skills (Wave 2 — agent-03)
| File | Topics | Lines |
|------|---------|-------|
| `ai-ml-integration.md` | Claude agent loop, streaming, circuit breaker, Cognee | ~380 |
| `performance-optimization.md` | TanStack Virtual, React.memo, N+1 fix, Redis cache | ~360 |
| `error-handling-patterns.md` | Typed errors, Hono onError, Result types, ?? vs \|\| | ~340 |
| `state-management-patterns.md` | Zustand slices, TanStack Query, SSE invalidation | ~360 |
| `typescript-advanced-patterns.md` | Discriminated unions, template literals, Zod inference | ~350 |

### Hive Memory Query Guide
- Frontend: `search("React hooks patterns")`, `search("Framer Motion animation")`
- Backend: `search("Hono sub-app routing")`, `search("Drizzle ORM migrations")`
- Database: `search("Neon connection pooling")`, `search("PostgreSQL schema")`
- Security: `search("JWT authentication tenant")`, `search("RBAC permissions")`
- AI/ML: `search("Claude agent tool use")`, `search("Cognee knowledge graph")`
- Performance: `search("TanStack Virtual large list")`, `search("Redis caching")`
- TypeScript: `search("discriminated union")`, `search("Zod type inference")`

---

## EXISTING SKILLS (already built — do not duplicate)
- `.claude/skills/cognee-hive-memory.md` ✓
- `.claude/skills/ui-design-3d-animations.md` ✓
- `.claude/skills/plugins-armada.md` ✓
- `.claude/skills/coding-languages-frameworks.md` ✓
- `.claude/skills/orchestrator-agent-teams.md` ✓

## SKILLS TO BUILD (agent-03 builds these)
- `.claude/skills/security-auth-patterns.md`
- `.claude/skills/testing-quality-assurance.md`
- `.claude/skills/devops-infrastructure.md`
- `.claude/skills/ai-ml-integration.md`
- `.claude/skills/database-patterns.md`
- `.claude/skills/performance-optimization.md`
