#!/bin/bash
# Pre-edit hook: warn if editing a .ts/.tsx file that currently has tsc errors
# Runs BEFORE Claude edits a TypeScript file
# Reads JSON from stdin (Claude Code hook convention)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const i=JSON.parse(d);console.log(i.tool_input?.file_path||'')}catch(e){console.log('')}})")

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  PROJECT='/mnt/c/Users/Danie/Desktop/CBA Statements Parse'

  if [[ "$FILE_PATH" == *"/server/"* ]]; then
    cd "$PROJECT/server" 2>/dev/null
    ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
    if [ "$ERRORS" -gt "0" ]; then
      echo "[HOOK] WARNING: $ERRORS existing tsc errors in server before this edit. Fix them after." >&2
    fi
  fi

  if [[ "$FILE_PATH" == *"/client/"* ]]; then
    cd "$PROJECT/client" 2>/dev/null
    ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
    if [ "$ERRORS" -gt "0" ]; then
      echo "[HOOK] WARNING: $ERRORS existing tsc errors in client before this edit. Fix them after." >&2
    fi
  fi
fi

echo "$INPUT"
exit 0
