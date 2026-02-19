# GoldLedger Plugin Power Guide

**Generated**: 2026-02-19
**Total Plugins**: 29 enabled
**Slash Commands**: 58+
**Subagents**: 40+
**MCP Servers**: 7
**Custom Commands**: 8 (gl-fix, gl-audit, gl-migrate, gl-agent-team, gl-tsc, gl-neon, gl-ralph, gl-hive)
**Custom Agents**: 5 (gl-ts-expert, gl-security, gl-schema, gl-reviewer, gl-hive-memory)

---

## Quick Reference — Most Powerful Combos

### Combo 1: Feature Development (Full Cycle)
```
/plan "Add X feature"          → get approved plan
/feature-dev "Add X feature"   → guided implementation
/review-pr                     → 6-agent PR review
/commit-push-pr                → commit, push, PR
```

### Combo 2: Bug Fix (Fast)
```
/gl-fix "bug description"      → diagnose, fix, verify, commit
```

### Combo 3: Bug Fix (Iterative, Complex)
```
/gl-ralph "fix all tsc errors" → Ralph loop until 0 errors
```

### Combo 4: Audit & Sweep
```
/gl-audit all                  → full codebase audit
/gl-tsc                        → TypeScript check
/orchestrate security "audit"  → security-focused agent chain
```

### Combo 5: Schema Change
```
/gl-migrate "add-column-name"  → generate, review, push migration
/gl-neon "SELECT COUNT(*) FROM transactions" → verify data
```

### Combo 6: New Agent Team
```
/gl-agent-team "my-team" "fix the auth flow" 4  → scaffold + launch
```

### Combo 7: Prevent Bad Behaviors
```
/hookify "stop adding console.log to route handlers"  → create hook
/hookify "never use @ts-ignore"                       → create hook
```

---

## Active Hooks on This Project

| Hook | Trigger | Action |
|------|---------|--------|
| **pre-commit-gate** | `git commit` (PreToolUse Bash) | Blocks @ts-ignore/@ts-expect-error in staged changes |
| **block-dangerous-patterns** | Write .ts/.tsx (PreToolUse Write) | Blocks @ts-ignore, hardcoded secrets; warns on `as any`, localhost |
| **post-edit-tsc** | Edit/Write .ts/.tsx (PostToolUse) | Runs tsc, shows error count + first 5 errors |

---

## Per-Agent Plugin/MCP Matrix

### Architect / Planner Agents
- **MCPs**: context7 (library docs), serena (codebase analysis), github (PR creation)
- **Commands**: `/plan`, `/write-plan`, `/brainstorm`, `/feature-dev`
- **Agents**: architect (everything-claude-code), planner (everything-claude-code)
- **Prompt hint**: "Use context7 to look up Hono/Drizzle docs. Use serena to navigate the codebase."

### Code Review Agents
- **MCPs**: serena (code nav), greptile (PR comments), sonatype-guide (dep security)
- **Commands**: `/review-pr`, `/code-review`, `/verify`
- **Agents**: code-reviewer, silent-failure-hunter, type-design-analyzer, pr-test-analyzer, comment-analyzer, gl-reviewer
- **Prompt hint**: "Use serena to navigate code. Use greptile to post review comments."

### TypeScript / Build Fix Agents
- **MCPs**: context7 (TS/Hono docs), serena (symbol lookup)
- **Commands**: `/gl-tsc`, `/gl-fix`, `/build-fix`
- **Agents**: gl-ts-expert (custom), build-error-resolver (everything-claude-code)
- **Prompt hint**: "Use context7 to look up TypeScript errors. Use serena to find symbol definitions."

### Security Agents
- **MCPs**: sonatype-guide (dependency CVEs), serena (code analysis), github (security advisories)
- **Commands**: `/gl-audit security`, `/orchestrate security`
- **Agents**: gl-security (custom), security-reviewer (everything-claude-code)
- **Prompt hint**: "Use sonatype-guide to check all dependencies. Use serena to trace auth middleware."

### Database / Schema Agents
- **MCPs**: context7 (Drizzle ORM docs), serena (schema navigation)
- **Commands**: `/gl-migrate`, `/gl-neon`
- **Agents**: gl-schema (custom), database-reviewer (everything-claude-code)
- **Prompt hint**: "Use context7 to look up Drizzle ORM migration docs."

### Testing / QA Agents
- **MCPs**: playwright (browser automation), context7 (testing library docs)
- **Commands**: `/tdd`, `/e2e`, `/verify`
- **Agents**: tdd-guide, e2e-runner (everything-claude-code)
- **Prompt hint**: "Use playwright MCP for browser-based E2E tests."

### Documentation Agents
- **MCPs**: context7 (library docs for accurate docstrings), github (PR descriptions)
- **Commands**: `/revise-claude-md`, `/update-codemaps`, `/update-docs`
- **Agents**: doc-updater (everything-claude-code)
- **Prompt hint**: "Use context7 to verify API signatures before documenting."

### Git / Release Agents
- **MCPs**: github (PR/issue management), greptile (code review automation)
- **Commands**: `/commit`, `/commit-push-pr`, `/clean-gone`, `/gl-commit`
- **Agents**: (use built-in commit-commands plugin)
- **Prompt hint**: "Use github MCP to create PRs. Use greptile to trigger automated code review."

### Full-Stack Feature Dev Agents
- **MCPs**: context7 + serena + github (all three)
- **Commands**: `/feature-dev`, `/orchestrate`, `/ralph-loop`
- **Agents**: code-architect (feature-dev), code-explorer (feature-dev)
- **Prompt hint**: "Use context7 for library docs, serena for codebase nav, github for PR workflow."

### Knowledge Graph Agents
- **MCPs**: cognee-hive-local (Cognee knowledge graph)
- **Commands**: `/gl-hive search`, `/gl-hive store`, `/gl-hive codify`, `/gl-hive rules`
- **Agents**: gl-hive-memory (custom)
- **Prompt hint**: "Use gl-hive to query and store agent team learnings in the shared knowledge graph."

---

## All Active Slash Commands

### GoldLedger Custom Commands
| Command | Purpose |
|---------|---------|
| `/gl-fix "issue"` | Full fix workflow: diagnose, plan, fix, verify, commit |
| `/gl-audit area` | Targeted audit: routes, schema, services, client, security, all |
| `/gl-migrate "name"` | Generate and review Drizzle migration |
| `/gl-agent-team "name" "mission" N` | Scaffold and launch agent team |
| `/gl-tsc` | Full TypeScript check (server + client) |
| `/gl-neon "SQL"` | Query Neon database directly |
| `/gl-ralph "problem"` | Start iterative Ralph loop |
| `/gl-hive action` | Query/write to Hive Memory knowledge graph |

### Plugin Commands (see PLUGIN-INVENTORY.md for full list)
| Command | Plugin | Purpose |
|---------|--------|---------|
| `/plan` | everything-claude-code | Step-by-step planning |
| `/write-plan` | superpowers | Detailed implementation plan |
| `/execute-plan` | superpowers | Execute a written plan |
| `/orchestrate` | everything-claude-code | Multi-agent orchestration |
| `/feature-dev` | feature-dev | Guided feature development |
| `/tdd` | everything-claude-code | Test-driven development |
| `/build-fix` | everything-claude-code | Fix build errors |
| `/code-review` | everything-claude-code | Review code quality |
| `/review-pr` | pr-review-toolkit | 6-agent PR review |
| `/verify` | everything-claude-code | Verification loop |
| `/commit` | commit-commands | Smart git commit |
| `/commit-push-pr` | commit-commands | Commit, push, create PR |
| `/ralph-loop` | ralph-loop | Iterative AI loop |
| `/hookify` | hookify | Create behavior hooks |
| `/revise-claude-md` | claude-md-management | Update CLAUDE.md |

---

## Tips for Agent Teams

1. Always include `/write-plan` or `/plan` at the start of complex tasks
2. Use `/orchestrate` to chain specialist agents for multi-step workflows
3. Use `/ralph-loop` for problems that need iterative refinement
4. Use `/checkpoint` before risky operations
5. Use `/gl-audit` after every agent team run to catch regressions
6. The Opus reviewer agent should always run `/gl-tsc` as final verification
7. Use `/gl-hive search` at the START of any task to check prior knowledge
8. Use `/gl-hive store` at the END of any task to record learnings
9. Include MCP hints in agent team prompts to enable real-time doc lookup
10. Use context7 MCP for Hono, Drizzle, React, and Neon documentation
