#!/bin/bash
# Pre-bash hook: intercept git commit and run quality checks first
# Reads JSON from stdin (Claude Code hook convention)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const i=JSON.parse(d);console.log(i.tool_input?.command||'')}catch(e){console.log('')}})")

if echo "$COMMAND" | grep -q "git commit"; then
  PROJECT='/mnt/c/Users/Danie/Desktop/CBA Statements Parse'
  cd "$PROJECT" 2>/dev/null

  echo "[HOOK] Running pre-commit quality gate..." >&2

  # Check for @ts-ignore in staged changes
  TS_IGNORE=$(git diff --cached 2>/dev/null | grep "^+" | grep -c "@ts-ignore" || echo "0")
  if [ "$TS_IGNORE" -gt "0" ]; then
    echo "[HOOK] COMMIT BLOCKED: @ts-ignore found in staged changes" >&2
    echo "$INPUT"
    exit 1
  fi

  # Check for @ts-expect-error in staged changes
  TS_EXPECT=$(git diff --cached 2>/dev/null | grep "^+" | grep -c "@ts-expect-error" || echo "0")
  if [ "$TS_EXPECT" -gt "0" ]; then
    echo "[HOOK] COMMIT BLOCKED: @ts-expect-error found in staged changes" >&2
    echo "$INPUT"
    exit 1
  fi

  # Check for console.log in server routes
  CONSOLE_LOG=$(git diff --cached -- "server/src/routes/*.ts" 2>/dev/null | grep "^+" | grep -c "console\.log" || echo "0")
  if [ "$CONSOLE_LOG" -gt "0" ]; then
    echo "[HOOK] WARNING: console.log in staged route files — consider removing" >&2
  fi

  echo "[HOOK] Pre-commit gate passed" >&2
fi

echo "$INPUT"
exit 0
