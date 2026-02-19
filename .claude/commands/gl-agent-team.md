---
description: Scaffold and launch a new GoldLedger agent team
argument-hint: team-name "mission description" num-agents
allowed-tools: ["Read", "Write", "Bash", "TodoWrite"]
---

# Launch New GoldLedger Agent Team

Arguments: $ARGUMENTS
(Format: team-name "mission" num-agents — e.g.: my-team "fix the auth flow" 4)

## Step 1: Parse arguments
Extract: TEAM_NAME, MISSION, NUM_AGENTS from $ARGUMENTS

## Step 2: Create team directory
```bash
mkdir -p "agent-team-N/tasks"  # use next available number
```

## Step 3: Create orchestration-prompt.md
Use the standard GoldLedger team template with:
- Session name: TEAM_NAME
- NUM_AGENTS teammates
- Sonnet for workers, Opus for reviewer
- Standard global rules (tsc gate, commit pattern, no @ts-ignore)

## Step 4: Create task files for each agent
Create agent-01 through agent-N task files based on the mission.

## Step 5: Launch
```bash
bash '/mnt/c/Users/Danie/Desktop/claude-agent-teams/scripts/launch-team.sh' \
  '/mnt/c/Users/Danie/Desktop/CBA Statements Parse' \
  "agent-team-N/orchestration-prompt.md" \
  "TEAM_NAME" \
  "NUM_AGENTS"
```
