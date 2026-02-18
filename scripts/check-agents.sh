#!/bin/bash
S="gl-split"

echo "=== Windows ==="
tmux list-windows -t "$S" 2>/dev/null
echo ""

echo "=== Claude Processes ==="
ps aux 2>/dev/null | grep "claude" | grep -v grep | grep -v chrome | grep -v "cli.js"
echo ""

echo "=== Per-Agent Last Lines ==="
for win in A0-index A1-schema A2-svc-big A3-svc-med A4-api A5-comp-big A6-comp-med A7-verify; do
  echo "--- $win ---"
  tmux capture-pane -t "$S:$win" -p -S -500 2>/dev/null | grep -v '^$' | tail -5
  echo ""
done
