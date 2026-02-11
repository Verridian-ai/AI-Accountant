# CBA Statements Parse - Agent Team Setup

## Prerequisites ✅ (Verified)
- [x] WSL (Ubuntu) installed
- [x] tmux 3.4
- [x] Claude Code CLI 2.1.33
- [x] Node.js v18.19.1
- [x] npm 9.2.0

## Quick Start (One Command)

### Option A: From PowerShell (Windows Terminal)
```powershell
cd "C:\Users\Danie\Desktop\CBA Statements Parse\cba-statements"
powershell -ExecutionPolicy Bypass -File .\agent-team\launch-team.ps1
```

### Option B: From WSL directly
```bash
cd "/mnt/c/Users/Danie/Desktop/CBA Statements Parse/cba-statements"
chmod +x agent-team/launch-team.sh
./agent-team/launch-team.sh
```

### Option C: Manual step-by-step
```bash
# In WSL terminal:
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
tmux new-session -s cba-agent-team
cd "/mnt/c/Users/Danie/Desktop/CBA Statements Parse/cba-statements"
claude --dangerously-skip-permissions
# Then paste contents of agent-team/orchestration-prompt.md
```

## Agent Team Structure (8 Agents)

| # | Agent Name | Role | Priority |
|---|-----------|------|----------|
| 1 | ideation-researcher | Competitor analysis & research | Background |
| 2 | ideation-brainstorm | Feature brainstorming & scoring | Background |
| 3 | scaffolder | Next.js project setup & structure | **CRITICAL PATH** |
| 4 | invoice-builder | Invoicing system with GST/ABN | High |
| 5 | gmail-integrator | Gmail auto-import pipeline | High |
| 6 | parsing-feedback | Real-time SSE progress indicators | High |
| 7 | pdf-viewer | PDF viewer & verification workflow | High |
| 8 | ideation-documenter | Architecture docs & API specs | Ongoing |

## Monitoring the Team

### tmux Controls
| Key | Action |
|-----|--------|
| `Ctrl+B, D` | Detach (team keeps running in background) |
| `Shift+Up/Down` | Navigate between agent panes |
| `Enter` | View selected agent's session |
| `Escape` | Interrupt current agent |
| `Ctrl+T` | Toggle shared task list |

### Reattach to Session
```bash
# From WSL:
tmux attach -t cba-agent-team

# List all sessions:
tmux list-sessions
```

### Kill the Team
```bash
tmux kill-session -t cba-agent-team
```

## Directory Structure
```
agent-team/
├── launch-team.sh          # Main launcher (WSL/bash)
├── launch-team.ps1         # Windows PowerShell launcher
├── manual-setup.sh         # Step-by-step setup guide
├── orchestration-prompt.md # The prompt that coordinates all agents
├── .tmux.conf              # tmux styling configuration
├── tasks/                  # Detailed task specs per agent
│   ├── 04-invoice-builder.md
│   ├── 05-gmail-integrator.md
│   ├── 06-parsing-feedback.md
│   └── 07-pdf-viewer.md
├── research/               # Agent 1 & 2 output directory
├── docs/                   # Agent 8 documentation output
└── logs/                   # Agent activity logs
```

## Features Being Built

### 1. Invoicing System (Agent 4)
- Generate invoices from parsed transactions
- GST calculation (10%) and ABN validation
- Status tracking: draft → sent → paid → overdue
- PDF export with professional template
- Australian tax compliance

### 2. Gmail Integration (Agent 5)
- OAuth connection to Gmail
- Auto-detect bank statement emails (CBA, ANZ, Westpac, NAB, etc.)
- Download PDF attachments automatically
- Trigger parsing pipeline on import
- Scheduled and on-demand import

### 3. Enhanced Parsing Feedback (Agent 6)
- Server-Sent Events for real-time progress
- Stage indicators: PDF extraction → bank detection → parsing → categorization
- Transaction counter, confidence scores, warnings
- Estimated time remaining
- Detailed error reporting

### 4. PDF Viewer & Verification (Agent 7)
- In-browser PDF viewer (PDF.js)
- Side-by-side: original PDF ↔ parsed transactions
- Line-by-line verification checklist
- Manual transaction entry for missing items
- Coverage percentage and verification status

### 5. Ideation & Research (Agents 1, 2, 8)
- Competitor analysis matrix
- 20+ feature proposals with scoring
- Architecture documentation
- API specifications
