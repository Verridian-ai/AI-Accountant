#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
echo "=== gl-audit pane count ==="
tmux list-panes -t gl-audit 2>/dev/null

for i in 1 2 3 4 5 6 7 8; do
  OUTPUT=$(tmux capture-pane -t "gl-audit:0.$i" -p 2>/dev/null | grep -v '^$' | tail -5)
  if [ -n "$OUTPUT" ]; then
    echo ""
    echo "--- Pane $i ---"
    echo "$OUTPUT"
  fi
done
