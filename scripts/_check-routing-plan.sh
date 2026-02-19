#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
echo "=== gl-routing-plan panes ==="
tmux list-panes -t gl-routing-plan 2>/dev/null

echo ""
echo "=== lead pane (last 20 lines) ==="
tmux capture-pane -t gl-routing-plan -p 2>/dev/null | grep -v "^$" | tail -20
