# Plugin Inventory — All Slash Commands, Agents, Skills & Capabilities

> Generated: 2026-02-19 by plugin-activator agent
> Project: GoldLedger (CBA Statements Parse)
> Total Enabled: **29 plugins** (28 installed + 1 local marketplace)

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Plugins Enabled** | 29 |
| **Slash Commands** | 58+ |
| **Subagents** | 40+ |
| **Skills** | 75+ |
| **Hooks** | 5 plugins with hooks |
| **MCP Servers** | 7 (Context7, GitHub, Greptile, Sonatype, Serena, Playwright, Circleback) |
| **Language Servers** | 2 (TypeScript LSP, Pyright LSP) |

---

## Newly Enabled (This Session)

| Plugin | Status | Notes |
|--------|--------|-------|
| `claude-code-setup` | **ENABLED** | Was only installed for Vox app project |
| `claude-md-management` | **ENABLED** | Was only installed for Vox app project |
| `playground` | **ENABLED** | Was only installed for Vox app project |

---

## Complete Plugin Catalog

### 1. ORCHESTRATION & CORE FRAMEWORKS

#### superpowers `v4.3.0` — claude-plugins-official
> Core skills library for Claude Code: TDD, debugging, collaboration patterns, and proven techniques

| Type | Items |
|------|-------|
| **Commands** | `/write-plan`, `/execute-plan`, `/brainstorm` |
| **Agents** | `code-reviewer` |
| **Skills** | `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills` (14 total) |
| **Hooks** | `session-start.sh` (SessionStart hook) |

#### everything-claude-code `v1.4.1` — everything-claude-code marketplace
> Complete battle-tested collection from Anthropic hackathon winner — agents, skills, hooks, rules from 10+ months daily use

| Type | Items |
|------|-------|
| **Commands** | `/build-fix`, `/checkpoint`, `/code-review`, `/e2e`, `/eval`, `/evolve`, `/go-build`, `/go-review`, `/go-test`, `/instinct-export`, `/instinct-import`, `/instinct-status`, `/learn`, `/multi-backend`, `/multi-execute`, `/multi-frontend`, `/multi-plan`, `/multi-workflow`, `/orchestrate`, `/plan`, `/pm2`, `/python-review`, `/refactor-clean`, `/sessions`, `/setup-pm`, `/skill-create`, `/tdd`, `/test-coverage`, `/update-codemaps`, `/update-docs`, `/verify` (31 total) |
| **Agents** | `architect`, `build-error-resolver`, `code-reviewer`, `database-reviewer`, `doc-updater`, `e2e-runner`, `go-build-resolver`, `go-reviewer`, `planner`, `python-reviewer`, `refactor-cleaner`, `security-reviewer`, `tdd-guide` (13 total) |
| **Skills** | `backend-patterns`, `clickhouse-io`, `coding-standards`, `configure-ecc`, `continuous-learning`, `continuous-learning-v2`, `django-patterns`, `django-security`, `django-tdd`, `django-verification`, `eval-harness`, `frontend-patterns`, `golang-patterns`, `golang-testing`, `iterative-retrieval`, `java-coding-standards`, `jpa-patterns`, `nutrient-document-processing`, `postgres-patterns`, `project-guidelines-example`, `python-patterns`, `python-testing`, `security-review`, `springboot-patterns`, `springboot-security`, `springboot-tdd`, `springboot-verification`, `strategic-compact`, `tdd-workflow`, `verification-loop` (30 total) |
| **Hooks** | `hooks.json` (session lifecycle) |

#### ralph-loop `v8deab846` — claude-plugins-official
> Continuous self-referential AI loops for interactive iterative development (Ralph Wiggum technique)

| Type | Items |
|------|-------|
| **Commands** | `/ralph-loop`, `/cancel-ralph`, `/help` |
| **Hooks** | `stop-hook.sh` (loop termination) |

---

### 2. CODE REVIEW & QUALITY

#### pr-review-toolkit `v8deab846` — claude-plugins-official
> Comprehensive PR review agents specializing in comments, tests, error handling, type design, code quality, and simplification

| Type | Items |
|------|-------|
| **Commands** | `/review-pr` |
| **Agents** | `code-reviewer`, `code-simplifier`, `comment-analyzer`, `pr-test-analyzer`, `silent-failure-hunter`, `type-design-analyzer` (6 total) |

#### coderabbit `v1.0.0` — claude-plugins-official
> AI-powered code review in Claude Code, powered by CodeRabbit

| Type | Items |
|------|-------|
| **Commands** | `/review` |
| **Agents** | `code-reviewer` |
| **Skills** | `code-review` |

#### code-simplifier `v1.0.0` — claude-plugins-official
> Agent that simplifies and refines code for clarity, consistency, and maintainability while preserving functionality

| Type | Items |
|------|-------|
| **Agents** | `code-simplifier` |

#### security-guidance `v8deab846` — claude-plugins-official
> Security reminder hook that warns about potential security issues when editing files (command injection, XSS, unsafe patterns)

| Type | Items |
|------|-------|
| **Hooks** | `security_reminder_hook.py` (PreToolUse — triggers on file edits) |

---

### 3. DEVELOPMENT WORKFLOWS

#### commit-commands `v8deab846` — claude-plugins-official
> Streamline git workflow with simple commands for committing, pushing, and creating pull requests

| Type | Items |
|------|-------|
| **Commands** | `/commit`, `/commit-push-pr`, `/clean-gone` |

#### feature-dev `v8deab846` — claude-plugins-official
> Comprehensive feature development workflow with specialized agents for codebase exploration, architecture design, and quality review

| Type | Items |
|------|-------|
| **Commands** | `/feature-dev` |
| **Agents** | `code-architect`, `code-explorer`, `code-reviewer` |

#### hookify `v8deab846` — claude-plugins-official
> Easily create hooks to prevent unwanted behaviors by analyzing conversation patterns

| Type | Items |
|------|-------|
| **Commands** | `/hookify`, `/configure`, `/list`, `/help` |
| **Agents** | `conversation-analyzer` |
| **Skills** | `writing-rules` |
| **Hooks** | `posttooluse.py`, `pretooluse.py`, `stop.py`, `userpromptsubmit.py` (4 hook handlers) |

---

### 4. PLUGIN & AGENT DEVELOPMENT

#### plugin-dev `v8deab846` — claude-plugins-official
> Plugin development framework for creating custom Claude Code plugins

| Type | Items |
|------|-------|
| **Commands** | `/create-plugin` |
| **Agents** | `agent-creator`, `plugin-validator`, `skill-reviewer` |
| **Skills** | `agent-development`, `command-development`, `hook-development`, `mcp-integration`, `plugin-settings`, `plugin-structure`, `skill-development` (7 total) |

#### agent-sdk-dev `v8deab846` — claude-plugins-official
> Claude Agent SDK Development Plugin

| Type | Items |
|------|-------|
| **Commands** | `/new-sdk-app` |
| **Agents** | `agent-sdk-verifier-py`, `agent-sdk-verifier-ts` |

---

### 5. LANGUAGE SERVERS & CODE ANALYSIS

#### typescript-lsp `v1.0.0` — claude-plugins-official
> TypeScript language server protocol integration for enhanced type checking and code intelligence

| Type | Items |
|------|-------|
| **MCP** | TypeScript LSP server |

#### pyright-lsp `v1.0.0` — claude-plugins-official
> Python type checking via Pyright language server

| Type | Items |
|------|-------|
| **MCP** | Pyright LSP server |

#### serena `v8deab846` — claude-plugins-official
> Semantic code analysis MCP server — intelligent code understanding, refactoring suggestions, codebase navigation via LSP

| Type | Items |
|------|-------|
| **MCP** | Serena semantic analysis server |

---

### 6. WEB, DATA & DOCUMENTATION

#### firecrawl `v1.0.3` — claude-plugins-official
> Web scraping and crawling — turn any website into clean, LLM-ready markdown or structured data

| Type | Items |
|------|-------|
| **Skills** | `firecrawl-cli` |

#### context7 `v8deab846` — claude-plugins-official
> Upstash Context7 MCP server — pull version-specific documentation and code examples from source repos

| Type | Items |
|------|-------|
| **MCP** | Context7 documentation lookup server |

#### playwright `v8deab846` — claude-plugins-official
> Browser automation and end-to-end testing MCP server by Microsoft

| Type | Items |
|------|-------|
| **MCP** | Playwright browser automation server |

---

### 7. GITHUB & CI/CD INTEGRATIONS

#### github `v8deab846` — claude-plugins-official
> Official GitHub MCP server — create issues, manage PRs, review code, search repos

| Type | Items |
|------|-------|
| **MCP** | GitHub API server |

#### greptile `v8deab846` — claude-plugins-official
> AI code review agent for GitHub and GitLab — view and resolve PR review comments

| Type | Items |
|------|-------|
| **MCP** | Greptile PR review server |

#### sonatype-guide `v1.0.0` — claude-plugins-official
> Software supply chain intelligence — scan dependencies for vulnerabilities, version recommendations

| Type | Items |
|------|-------|
| **MCP** | Sonatype dependency analysis server |

#### circleback `v1.0.0` — claude-plugins-official
> Meeting notes and discussion tracking — search and access meetings, emails, calendar events

| Type | Items |
|------|-------|
| **MCP** | Circleback conversational context server |

---

### 8. AI/ML & SPECIALIZED

#### huggingface-skills `v1.0.0` — claude-plugins-official
> Agent Skills for AI/ML tasks — dataset creation, model training, evaluation, paper publishing on HF Hub

| Type | Items |
|------|-------|
| **Agents** | `AGENTS` (HuggingFace agent) |
| **Skills** | `hugging-face-cli`, `hugging-face-datasets`, `hugging-face-evaluation`, `hugging-face-jobs`, `hugging-face-model-trainer`, `hugging-face-paper-publisher`, `hugging-face-tool-builder`, `hugging-face-trackio` (8 total) |

#### cognee-expert `local` — cognee-expert marketplace
> Cognee AI knowledge graph integration — data ingestion, cognification, search, structured output

| Type | Items |
|------|-------|
| **Commands** | `/add-data`, `/codify`, `/cognify`, `/datapoints`, `/deploy`, `/feedback`, `/ingest-docs`, `/memify`, `/search`, `/setup`, `/structured-output`, `/test`, `/user-manage` (13 total) |
| **Agents** | `cognee-engineer` |
| **Skills** | `cognee-api-reference`, `cognee-cloud`, `cognee-core-concepts`, `cognee-deployment`, `cognee-guides`, `cognee-integrations`, `cognee-mcp`, `cognee-setup-config` (8 total) |

---

### 9. OUTPUT STYLES & PROJECT MANAGEMENT

#### explanatory-output-style `v8deab846` — claude-plugins-official
> Adds educational insights about implementation choices and codebase patterns

| Type | Items |
|------|-------|
| **Hooks** | SessionStart hook (output style injection) |

#### frontend-design `v8deab846` — claude-plugins-official
> Frontend design skill for UI/UX implementation with high design quality

| Type | Items |
|------|-------|
| **Skills** | `frontend-design` |

#### claude-code-setup `v1.0.0` — claude-plugins-official (**NEW**)
> Analyze codebases and recommend tailored Claude Code automations (hooks, skills, MCP servers, subagents)

| Type | Items |
|------|-------|
| **Skills** | `claude-automation-recommender` |

#### claude-md-management `v1.0.0` — claude-plugins-official (**NEW**)
> Tools to maintain and improve CLAUDE.md files — audit quality, capture session learnings

| Type | Items |
|------|-------|
| **Commands** | `/revise-claude-md` |
| **Skills** | `claude-md-improver` |

#### playground `v8deab846` — claude-plugins-official (**NEW**)
> Creates interactive HTML playgrounds — self-contained single-file explorers with visual controls and live preview

| Type | Items |
|------|-------|
| **Skills** | `playground` |

---

## Quick Reference: All Slash Commands

| Command | Plugin | Purpose |
|---------|--------|---------|
| `/brainstorm` | superpowers | Structured ideation sessions |
| `/write-plan` | superpowers | Create implementation plans |
| `/execute-plan` | superpowers | Execute a written plan |
| `/plan` | everything-claude-code | Restate requirements + step-by-step plan |
| `/orchestrate` | everything-claude-code | Multi-agent orchestration |
| `/tdd` | everything-claude-code | Test-driven development workflow |
| `/build-fix` | everything-claude-code | Fix build errors |
| `/code-review` | everything-claude-code | Review code quality |
| `/verify` | everything-claude-code | Verification loop |
| `/e2e` | everything-claude-code | End-to-end testing |
| `/eval` | everything-claude-code | Evaluation harness |
| `/evolve` | everything-claude-code | Cluster instincts into skills |
| `/checkpoint` | everything-claude-code | Save session checkpoint |
| `/sessions` | everything-claude-code | Manage sessions |
| `/skill-create` | everything-claude-code | Create skills from git history |
| `/refactor-clean` | everything-claude-code | Dead code cleanup |
| `/update-codemaps` | everything-claude-code | Update code maps |
| `/update-docs` | everything-claude-code | Update documentation |
| `/go-build` | everything-claude-code | Fix Go build errors |
| `/go-review` | everything-claude-code | Go code review |
| `/go-test` | everything-claude-code | Go TDD workflow |
| `/python-review` | everything-claude-code | Python code review |
| `/test-coverage` | everything-claude-code | Check test coverage |
| `/instinct-status` | everything-claude-code | Show learned instincts |
| `/instinct-export` | everything-claude-code | Export instincts |
| `/instinct-import` | everything-claude-code | Import instincts |
| `/learn` | everything-claude-code | Trigger learning |
| `/multi-plan` | everything-claude-code | Multi-agent planning |
| `/multi-execute` | everything-claude-code | Multi-agent execution |
| `/multi-backend` | everything-claude-code | Multi-agent backend |
| `/multi-frontend` | everything-claude-code | Multi-agent frontend |
| `/multi-workflow` | everything-claude-code | Multi-agent workflow |
| `/pm2` | everything-claude-code | PM2 process management |
| `/setup-pm` | everything-claude-code | Setup PM2 |
| `/ralph-loop` | ralph-loop | Start iterative AI loop |
| `/cancel-ralph` | ralph-loop | Cancel running loop |
| `/review-pr` | pr-review-toolkit | Comprehensive PR review |
| `/review` | coderabbit | CodeRabbit AI review |
| `/commit` | commit-commands | Create git commit |
| `/commit-push-pr` | commit-commands | Commit, push, and create PR |
| `/clean-gone` | commit-commands | Clean deleted remote branches |
| `/feature-dev` | feature-dev | Guided feature development |
| `/hookify` | hookify | Create hooks from conversation |
| `/configure` | hookify | Configure hookify rules |
| `/list` | hookify | List hookify rules |
| `/create-plugin` | plugin-dev | Create new plugin |
| `/new-sdk-app` | agent-sdk-dev | New Agent SDK app |
| `/revise-claude-md` | claude-md-management | Improve CLAUDE.md |
| `/add-data` | cognee-expert | Add data to Cognee |
| `/codify` | cognee-expert | Codify knowledge |
| `/cognify` | cognee-expert | Run cognification |
| `/datapoints` | cognee-expert | Manage datapoints |
| `/deploy` | cognee-expert | Deploy Cognee |
| `/feedback` | cognee-expert | Submit feedback |
| `/ingest-docs` | cognee-expert | Ingest documents |
| `/memify` | cognee-expert | Create memories |
| `/search` | cognee-expert | Search knowledge |
| `/setup` | cognee-expert | Setup Cognee |
| `/structured-output` | cognee-expert | Structured output |
| `/test` | cognee-expert | Test Cognee |
| `/user-manage` | cognee-expert | User management |

---

## Quick Reference: All Subagents

| Agent | Plugin | Specialty |
|-------|--------|-----------|
| `architect` | everything-claude-code | System design & architecture |
| `build-error-resolver` | everything-claude-code | Fix build/type errors |
| `code-reviewer` | everything-claude-code | Code quality review |
| `database-reviewer` | everything-claude-code | PostgreSQL/Supabase review |
| `doc-updater` | everything-claude-code | Documentation updates |
| `e2e-runner` | everything-claude-code | End-to-end testing |
| `go-build-resolver` | everything-claude-code | Go compilation fixes |
| `go-reviewer` | everything-claude-code | Go code review |
| `planner` | everything-claude-code | Feature planning |
| `python-reviewer` | everything-claude-code | Python code review |
| `refactor-cleaner` | everything-claude-code | Dead code cleanup |
| `security-reviewer` | everything-claude-code | Security vulnerability detection |
| `tdd-guide` | everything-claude-code | TDD methodology |
| `code-reviewer` | superpowers | Code review |
| `code-reviewer` | pr-review-toolkit | PR code review |
| `code-simplifier` | pr-review-toolkit | Code simplification |
| `comment-analyzer` | pr-review-toolkit | Comment accuracy analysis |
| `pr-test-analyzer` | pr-review-toolkit | Test coverage analysis |
| `silent-failure-hunter` | pr-review-toolkit | Error handling detection |
| `type-design-analyzer` | pr-review-toolkit | Type design review |
| `code-architect` | feature-dev | Feature architecture design |
| `code-explorer` | feature-dev | Codebase exploration |
| `code-reviewer` | feature-dev | Feature code review |
| `code-reviewer` | coderabbit | CodeRabbit AI review |
| `code-simplifier` | code-simplifier | Code simplification |
| `conversation-analyzer` | hookify | Conversation pattern analysis |
| `agent-creator` | plugin-dev | Create new agents |
| `plugin-validator` | plugin-dev | Validate plugins |
| `skill-reviewer` | plugin-dev | Review skills |
| `agent-sdk-verifier-py` | agent-sdk-dev | Verify Python SDK apps |
| `agent-sdk-verifier-ts` | agent-sdk-dev | Verify TypeScript SDK apps |
| `AGENTS` | huggingface-skills | HuggingFace operations |
| `cognee-engineer` | cognee-expert | Cognee integration engineering |

---

## Plugins by Category for GoldLedger

### Most Relevant to This Project
| Plugin | Why |
|--------|-----|
| `everything-claude-code` | TDD, build-fix, code-review, orchestration — daily driver |
| `superpowers` | Planning, debugging, parallel agents |
| `pr-review-toolkit` | 6 specialized review agents |
| `commit-commands` | Fast git workflow |
| `hookify` | Custom behavior rules |
| `security-guidance` | Automatic security warnings |
| `context7` | Up-to-date Hono/Drizzle/React docs |
| `playwright` | Browser testing |
| `cognee-expert` | Cognee knowledge graph operations |
| `sonatype-guide` | Dependency security scanning |
| `greptile` | PR review comments |
| `claude-md-management` | Keep CLAUDE.md current |

### New Installs Attempted (Not Available in Marketplace)
- `tdd` — already covered by everything-claude-code `/tdd`
- `drizzle` — use context7 for Drizzle docs
- `neon` — use context7 for Neon docs
- `react-patterns` — use context7 + frontend-design skill
- `hono` — use context7 for Hono docs
- `perf` — not available
- `zod` — not available

---

## Version Summary

| Plugin | Version | Marketplace |
|--------|---------|-------------|
| agent-sdk-dev | 8deab846 | claude-plugins-official |
| circleback | 1.0.0 | claude-plugins-official |
| claude-code-setup | 1.0.0 | claude-plugins-official |
| claude-md-management | 1.0.0 | claude-plugins-official |
| code-simplifier | 1.0.0 | claude-plugins-official |
| coderabbit | 1.0.0 | claude-plugins-official |
| cognee-expert | local | cognee-expert (local) |
| commit-commands | 8deab846 | claude-plugins-official |
| context7 | 8deab846 | claude-plugins-official |
| everything-claude-code | 1.4.1 | everything-claude-code |
| explanatory-output-style | 8deab846 | claude-plugins-official |
| feature-dev | 8deab846 | claude-plugins-official |
| firecrawl | 1.0.3 | claude-plugins-official |
| frontend-design | 8deab846 | claude-plugins-official |
| github | 8deab846 | claude-plugins-official |
| greptile | 8deab846 | claude-plugins-official |
| hookify | 8deab846 | claude-plugins-official |
| huggingface-skills | 1.0.0 | claude-plugins-official |
| playground | 8deab846 | claude-plugins-official |
| playwright | 8deab846 | claude-plugins-official |
| plugin-dev | 8deab846 | claude-plugins-official |
| pr-review-toolkit | 8deab846 | claude-plugins-official |
| pyright-lsp | 1.0.0 | claude-plugins-official |
| ralph-loop | 8deab846 | claude-plugins-official |
| security-guidance | 8deab846 | claude-plugins-official |
| serena | 8deab846 | claude-plugins-official |
| sonatype-guide | 1.0.0 | claude-plugins-official |
| superpowers | 4.3.0 | claude-plugins-official |
| typescript-lsp | 1.0.0 | claude-plugins-official |
