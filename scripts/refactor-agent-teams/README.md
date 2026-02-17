# GoldLedger Refactoring Agent Teams

Orchestrate Claude Code agent teams to execute the GoldLedger refactoring plan with planning-first, atomic task assignments, and delegate mode.

## Prerequisites

1. **Claude Code CLI** installed and authenticated
   - Install: https://code.claude.com/docs/en/setup
   - Must be available in your WSL2 `PATH` as `claude`

2. **WSL2** with a Linux distribution (Ubuntu recommended)

3. **tmux** (installed automatically by the scripts, or manually):
   ```bash
   sudo apt-get update && sudo apt-get install -y tmux
   ```

4. **Agent teams enabled** in Claude Code settings:
   - Add to `.claude/settings.json` or `.claude/settings.local.json`:
   ```json
   {
     "env": {
       "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
     },
     "teammateMode": "tmux"
   }
   ```
   Or copy from `.claude/agent-teams.example.json`.

## Workflow

### Two-Phase Approach

1. **Phase 1: Planning** — Achieve planning perfection before coding
   - Agent team reviews the refactoring plan
   - Audits current codebase state
   - Improves plan with atomic subtasks
   - Produces `docs/REFACTORING_PLAN_REFINED.md`

2. **Phase 2: Execution** — Execute the refined plan
   - Agent team implements REFACTOR-001 through REFACTOR-063
   - Plan approval required for each task
   - Atomic commits, verification after every change

### Launch from Windows (External Terminal)

**Option A: Double-click (easiest)**
- Double-click **`RUN_AGENT_TEAMS.bat`** in the project root
- Or double-click **`scripts/refactor-agent-teams/agent-teams-startup.bat`**
- Opens a new CMD window and runs the Phase 1 launcher

**Option B: PowerShell (opens external window)**
```powershell
cd "c:\Users\Danie\Desktop\CBA Statements Parse"
powershell -ExecutionPolicy Bypass -File scripts\refactor-agent-teams\agent-teams-startup.ps1
```

**Option C: Run in-place (from project root)**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\refactor-agent-teams\run-phase1-from-windows.ps1
```

**Option B: Manual WSL command**

```powershell
# Replace /path/to/tca with your project path in WSL (e.g. /mnt/c/Users/Danie/.cursor/worktrees/CBA_Statements_Parse/tca)
wsl -e bash -c "cd /path/to/tca && chmod +x scripts/refactor-agent-teams/*.sh && ./scripts/refactor-agent-teams/launch-planning-team.sh"
```

**Option C: From a WSL2 terminal** (Ubuntu, etc.):

```bash
cd /path/to/tca  # or your project path in WSL
chmod +x scripts/refactor-agent-teams/*.sh
./scripts/refactor-agent-teams/launch-planning-team.sh
```

### Launch Phase 2 (after Phase 1 completes)

```bash
./scripts/refactor-agent-teams/launch-execution-team.sh
```

## What Happens When You Run

1. Script ensures tmux is installed
2. Exports `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
3. Starts Claude Code with `--teammate-mode tmux`
4. Displays the prompt — **copy and paste it into Claude** when it starts
5. Claude creates the agent team and spawns teammates
6. Each teammate gets a split pane in tmux

## Key Controls

| Action | How |
|--------|-----|
| Delegate mode (lead coordinates only) | Shift+Tab |
| Select teammate (in-process) | Shift+Up / Shift+Down |
| Message teammate directly | Select then type |
| Toggle task list | Ctrl+T |
| Clean up team | Ask lead: "Clean up the team" |
| Shut down teammate | Ask lead: "Ask [teammate name] to shut down" |

## Plan Approval

Teammates work in **read-only plan mode** until the lead approves:

- Teammate produces a written plan
- Lead reviews (approve or reject with feedback)
- If approved, teammate proceeds with implementation
- Reject plans that: lack test coverage, skip verification, or exceed 500 lines/PR

## File Layout

```
project root/
├── RUN_AGENT_TEAMS.bat          # Double-click to launch (easiest)
scripts/refactor-agent-teams/
├── README.md                    # This file
├── agent-teams-startup.bat      # Main launcher (double-click or run from CMD)
├── agent-teams-startup.ps1      # Opens external window, runs .bat
├── ensure-tmux.sh               # Ensures tmux is installed
├── launch-planning-team.sh      # Phase 1 launcher (bash)
├── launch-execution-team.sh     # Phase 2 launcher (bash)
├── run-phase1-from-windows.ps1  # Phase 1 (PowerShell → WSL)
├── run-phase2-from-windows.ps1  # Phase 2 (PowerShell → WSL)
└── prompts/
    ├── phase1-planning.txt      # Prompt for planning team
    └── phase2-execution.txt    # Prompt for execution team
```

## Troubleshooting

### Startup script does nothing / window doesn't appear

- **Run the .bat directly from File Explorer**: Navigate to the project folder, double-click `RUN_AGENT_TEAMS.bat`
- **Run from CMD**: Open CMD (Win+R, type `cmd`), then:
  ```
  cd /d "C:\Users\Danie\Desktop\CBA Statements Parse"
  scripts\refactor-agent-teams\agent-teams-startup.bat
  ```
- **Check WSL**: In CMD, run `wsl --status` to verify WSL is installed and running
- **Check Claude**: In CMD, run `wsl which claude` — should show `/usr/local/bin/claude`

### Teammates not appearing

- Press **Shift+Down** to cycle through teammates (in-process mode)
- Ensure tmux is in PATH: `which tmux`
- Try `--teammate-mode in-process` if tmux has issues

### Claude Code not found in WSL2

- Install Claude Code in WSL2 or ensure it's in your Windows PATH and callable from WSL
- Some setups require running Claude from Windows; adjust the script to run `claude` from the Windows side if needed

### Split panes not working

- tmux has known limitations on some platforms
- Use `teammateMode: "in-process"` and Shift+Up/Down to switch between teammates
- Or run without tmux: `claude --teammate-mode in-process`

### Permission prompts

- Pre-approve common operations in `.claude/settings.json` permissions to reduce friction
- Agent teammates inherit the lead's permission mode

## References

- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Plan Approval for Teammates](https://code.claude.com/docs/en/agent-teams#require-plan-approval-for-teammates)
- [Delegate Mode](https://code.claude.com/docs/en/agent-teams#use-delegate-mode)
- [Best Practices](https://code.claude.com/docs/en/agent-teams#best-practices)
- [Limitations](https://code.claude.com/docs/en/agent-teams#limitations)
