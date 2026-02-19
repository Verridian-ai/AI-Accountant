#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
echo "=== tmux sessions ==="
tmux ls
echo ""
echo "=== gl-audit panes ==="
tmux list-panes -t gl-audit -F "Pane #{pane_index}: #{pane_width}x#{pane_height} #{pane_active}" 2>/dev/null || echo "no panes info"
echo ""
echo "=== lead pane (last 8 lines) ==="
tmux capture-pane -t gl-audit -p 2>/dev/null | tail -8
