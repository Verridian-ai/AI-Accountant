# Skill: Orchestrator & Agent Teams — Complete Reference

> How to design, launch, and run high-performance Claude Code agent teams.
> Covers wave structure, task assignment, hive memory integration, auto-approve,
> haiku research agents, and the full orchestration lifecycle.

---

## ORCHESTRATOR ROLE

The orchestrator is the **lead agent** — it does NOT write code itself.
It plans, assigns, monitors, unblocks, and synthesises.

### Orchestrator Responsibilities
1. Query hive memory FIRST — understand what previous teams did
2. Decompose the task into non-overlapping file ownership domains
3. Assign each domain to a specialist agent with a clear task file
4. Monitor wave completion via DONE signals
5. Unblock agents that are stuck
6. Run final quality gate (tsc 0 errors)
7. Store session learnings to hive memory
8. Commit and signal TEAM COMPLETE

---

## WAVE STRUCTURE

```
Wave 1 (parallel — start immediately):
  → Independent domain workers
  → Each owns non-overlapping files
  → Each queries hive memory at start
  → Each commits after each logical fix
  → Each stores learnings before DONE
  → Signal: "DONE: agent-name"

Wave 2 (start after ALL Wave 1 DONE):
  → Dependent workers that need Wave 1 output
  → Read Wave 1 results from hive memory
  → Same protocol as Wave 1

Wave 3 / Final (Opus model):
  → Reviewer — verifies all work
  → Runs final tsc check (0 errors required)
  → Stores session summary to hive memory
  → Commits to main
  → Signals: "TEAM COMPLETE: [summary]"
```

---

## TASK FILE TEMPLATE

Every agent gets a task file. Structure:

```markdown
# AGENT-NN: agent-name
# Wave N — Description
# Model: claude-sonnet-4-6 | claude-haiku-4-6 | claude-opus-4-6

## MISSION
[1-2 sentence clear mission statement]

## FILES YOU OWN
- path/to/file1.ts
- path/to/directory/ (all files)
- DO NOT touch: [files owned by other agents]

## STEP 1: QUERY HIVE MEMORY (mandatory — do before reading any files)
mcp__cognee-agent-teams__get_developer_rules()
mcp__cognee-agent-teams__search(search_query="[task area]", search_type="GRAPH_COMPLETION")
mcp__cognee-agent-teams__search(search_query="[task area]", search_type="CHUNKS")

## STEP 2: [Main work steps]
[Specific, numbered, actionable steps]

## STEP 3: QUALITY GATE
cd server && npx tsc --noEmit   # must be 0 errors

## STEP 4: STORE LEARNINGS
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [decisions, root causes, fixes, patterns]"
)

## DONE
Message: "DONE: agent-name"
```

---

## MODEL SELECTION GUIDE

| Model | Use For | Cost |
|-------|---------|------|
| `claude-haiku-4-6` | Research, data gathering, simple transforms, internet scraping | Cheapest |
| `claude-sonnet-4-6` | Main implementation, bug fixing, code writing | Mid |
| `claude-opus-4-6` | Final review, complex architecture, critical decisions | Most expensive |

**Rule**: Use Haiku for research/gather tasks, Sonnet for implementation, Opus only for final review.

---

## HAIKU RESEARCH AGENTS

Haiku agents are cheap, fast sub-agents for gathering knowledge.
Use them to research internet content, read docs, and seed hive memory.

### Research Agent Task Template
```markdown
# AGENT-NN: research-[topic]
# Wave 1 — Internet Research
# Model: claude-haiku-4-6

## MISSION
Research [topic] from the internet and store structured knowledge in hive memory.

## TOOLS AVAILABLE
- /firecrawl [url] — scrape and extract content from URLs
- /context7 [library] [topic] — get current library documentation
- mcp__cognee-agent-teams__cognify — store findings to hive memory

## RESEARCH TARGETS
1. [URL or topic 1]
2. [URL or topic 2]
3. [URL or topic 3]

## STEP 1: GATHER
For each target:
/firecrawl [url]
OR
/context7 [library] [topic]

## STEP 2: SYNTHESISE & STORE
After gathering, store structured knowledge:
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [structured summary of findings]"
)

## DONE
Message: "DONE: research-[topic]"
```

---

## AUTO-APPROVE CONFIGURATION

To run teams without human intervention, configure `settings.json`:

```json
{
  "skipDangerousModePermissionPrompt": true,
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)",
      "mcp__cognee-agent-teams__*"
    ],
    "deny": []
  }
}
```

**Also**: Use the approve-loop script:
```bash
bash /mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/approve-loop.sh [session-name]
```

This auto-approves all permission prompts in the tmux session.

---

## LAUNCHING A TEAM

### Method 1: Universal Launcher Script
```bash
bash /mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/launch-team.sh \
  "/mnt/c/Users/Danie/Desktop/CBA Statements Parse" \
  "agent-team-N/orchestration-prompt.md" \
  "session-name" \
  "N"  # number of agents
```

### Method 2: Direct tmux
```bash
# Create session
tmux new-session -d -s "team-name" -x 220 -y 50

# Launch Claude in session
tmux send-keys -t "team-name" "claude" Enter
sleep 5

# Inject orchestration prompt
tmux send-keys -t "team-name" "$(cat agent-team-N/orchestration-prompt.md)" Enter
```

### Method 3: Windows Terminal
```powershell
wt new-tab --title "team-name" -- wsl -e bash -c "tmux attach -t team-name"
```

---

## TMUX NAVIGATION

```
tmux attach -t [session-name]    # attach to session
Shift+Up/Down                    # cycle between teammates
Shift+Tab                        # toggle delegate mode on lead
Ctrl+T                           # show/hide task list
Escape                           # interrupt current turn
Ctrl+B d                         # detach (leave running)
```

---

## MONITORING

```bash
# Check session status
bash /mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/check-status.sh [session-name]

# Monitor live
bash /mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/monitor-team.sh [session-name]

# Auto-approve permissions
bash /mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/approve-loop.sh [session-name]

# Kill session
tmux kill-session -t [session-name]
```

---

## FILE OWNERSHIP RULES

1. **Declare ownership** at session start — list exact files/directories
2. **Never edit** files owned by another agent
3. **If you need** a file owned by another agent, ask the lead
4. **Orchestrator** can edit any file if no agent owns it
5. **Reviewer** can edit any file to fix stragglers

### Ownership Declaration Format
```
MY FILES:
- server/src/routes/transactions.ts
- server/src/routes/accounts.ts
- server/src/services/transaction-service.ts

NOT MY FILES (owned by other agents):
- server/src/schema/ → agent-02
- client/src/ → agent-03
```

---

## COMMIT PROTOCOL

```bash
# After each logical fix (not at the end — after EACH fix)
git add -A && git commit -m "fix(TEAM9-NNN): description"

# Commit format
fix(AREA): description          # bug fixes
feat(AREA): description         # new features
refactor(AREA): description     # refactoring
fix(TEAM9-001): description     # team-specific fixes

# Never use --no-verify unless hooks are broken
# Never commit with @ts-ignore in staged files
```

---

## QUALITY GATES

### TypeScript (mandatory after every change)
```bash
cd server && npx tsc --noEmit   # 0 errors required
cd client && npx tsc --noEmit   # 0 errors required
```

### Code Rules (non-negotiable)
1. NEVER `@ts-ignore` or `@ts-expect-error`
2. NEVER `as any` — use `as unknown as T` or proper types
3. NEVER hardcode URLs — use env vars
4. NEVER store secrets in code
5. All POST/PATCH/PUT routes MUST use `zValidator`
6. All JWT access MUST have null guard
7. All `parseInt()` MUST have radix 10
8. No file >300 lines (except tests/generated)
9. Integer money — ALL currency in cents, NEVER float

---

## HIVE MEMORY INTEGRATION IN TEAMS

### Every agent MUST follow this protocol:

**SESSION START** (before reading any files):
```
mcp__cognee-agent-teams__get_developer_rules()
mcp__cognee-agent-teams__search(search_query="[task area]", search_type="GRAPH_COMPLETION")
mcp__cognee-agent-teams__search(search_query="[task area]", search_type="CHUNKS")
```

**WHEN YOU FIND A BUG** (immediately, not at end):
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] Bug: [description]. Root cause: [cause]. Fix: [fix]. File: [path]"
)
```

**WHEN YOU MAKE A DECISION** (immediately):
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] Decision: [what and why]. Alternatives considered: [list]. Chosen because: [reason]"
)
```

**SESSION END** (before DONE signal):
```
mcp__cognee-agent-teams__cognify(
  data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [Full session summary: what was done, decisions, bugs found, fixes applied, patterns]"
)
```

---

## ORCHESTRATION PROMPT TEMPLATE

```markdown
# AGENT-TEAM-N — [Mission Name]

## MISSION
[Clear 2-3 sentence mission statement]

## MODELS
- Wave 1 agents: claude-haiku-4-6 (research) / claude-sonnet-4-6 (implementation)
- Final reviewer: claude-opus-4-6

## PROJECT ROOT
/mnt/c/Users/Danie/Desktop/CBA Statements Parse

## HIVE MEMORY — MANDATORY FOR ALL AGENTS
MCP Server: cognee-agent-teams → http://localhost:9021/mcp

EVERY AGENT MUST AT SESSION START:
1. mcp__cognee-agent-teams__get_developer_rules()
2. mcp__cognee-agent-teams__search(search_query="[task]", search_type="GRAPH_COMPLETION")
3. mcp__cognee-agent-teams__search(search_query="[task]", search_type="CHUNKS")

EVERY AGENT MUST BEFORE DONE:
mcp__cognee-agent-teams__cognify(data="[PROJECT: goldledger-v1] [TEAM_SESSION: team-N-session-YYYY-MM-DD-NNN] [AGENT_SESSION: agent-NN-ROLE-YYYY-MM-DD-NNN] [summary]")

## GLOBAL RULES
[paste from CLAUDE.md quality rules]

## WAVE STRUCTURE
### WAVE 1 (parallel — start immediately)
- agent-01-[name]: [brief description]
- agent-02-[name]: [brief description]

### WAVE 2 (after Wave 1 DONE)
- agent-03-[name]: [brief description]

## WAVE 1 ASSIGNMENTS
### AGENT-01: [name] (model: claude-sonnet-4-6)
Task file: agent-team-N/tasks/agent-01-[name].md

### AGENT-02: [name] (model: claude-haiku-4-6)
Task file: agent-team-N/tasks/agent-02-[name].md

## DONE SIGNALS
- DONE: agent-01-[name]
- DONE: agent-02-[name]
- DONE: reviewer — TEAM COMPLETE
```

---

## ANTI-PATTERNS TO AVOID

1. **Starting without hive memory query** — always query first
2. **Editing other agents' files** — causes merge conflicts
3. **Committing at the end** — commit after each logical fix
4. **Storing learnings at the end** — store immediately when found
5. **Using Opus for everything** — expensive, use Haiku for research
6. **No DONE signal** — orchestrator can't advance waves
7. **Ignoring tsc errors** — fix before committing
8. **Large commits** — one logical change per commit
9. **Waiting for human approval** — configure auto-approve
10. **Not using plugins** — `/context7`, `/firecrawl`, `/write-plan` save hours

---

## EXAMPLE: 4-AGENT TEAM STRUCTURE

```
ORCHESTRATOR (Sonnet) — lead, no code
  ├── Wave 1 (parallel):
  │   ├── agent-01 (Haiku) — internet research, seeds hive memory
  │   ├── agent-02 (Sonnet) — server-side implementation
  │   └── agent-03 (Sonnet) — client-side implementation
  └── Wave 2:
      └── agent-04 (Opus) — review, verify, final commit
```

Each agent:
- Reads task file from `agent-team-N/tasks/`
- Queries hive memory before starting
- Owns non-overlapping files
- Commits after each fix
- Stores learnings to hive memory
- Signals DONE when complete
