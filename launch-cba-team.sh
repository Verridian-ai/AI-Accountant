#!/bin/bash
tmux kill-session -t cba-overhaul 2>/dev/null
export CLOUDSDK_CONFIG=/mnt/c/Users/Danie/AppData/Roaming/gcloud
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

tmux new-session -d -s cba-overhaul -c "/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
tmux send-keys -t cba-overhaul "export CLOUDSDK_CONFIG=/mnt/c/Users/Danie/AppData/Roaming/gcloud" Enter
tmux send-keys -t cba-overhaul "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" Enter
tmux send-keys -t cba-overhaul "cd '/mnt/c/Users/Danie/Desktop/CBA Statements Parse'" Enter
tmux send-keys -t cba-overhaul "claude" Enter

echo "cba-overhaul session created. Attach with: tmux attach -t cba-overhaul"
