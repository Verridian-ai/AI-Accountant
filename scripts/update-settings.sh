#!/bin/bash
cat > ~/.claude/settings.json << 'EOF'
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [],
    "deny": []
  },
  "skipDangerousModePermissionPrompt": true,
  "teammateMode": "tmux",
  "model": "claude-sonnet-4-5-20250514"
}
EOF

echo "Updated ~/.claude/settings.json:"
cat ~/.claude/settings.json
