#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
tmux send-keys -t gl-audit "" Enter
sleep 2
tmux capture-pane -t gl-audit -p
