#!/bin/bash
# Post-edit hook: run tsc after any .ts/.tsx file edit
# Prints error count so Claude knows immediately if it broke something
# Reads JSON from stdin (Claude Code hook convention)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const i=JSON.parse(d);console.log(i.tool_input?.file_path||'')}catch(e){console.log('')}})")

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  PROJECT='/mnt/c/Users/Danie/Desktop/CBA Statements Parse'

  if [[ "$FILE_PATH" == *"/server/"* ]]; then
    cd "$PROJECT/server" 2>/dev/null
    TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
    ERRORS=$(echo "$TSC_OUTPUT" | grep "error TS" | wc -l)
    if [ "$ERRORS" -gt "0" ]; then
      echo "[HOOK] TSC: $ERRORS errors after editing $FILE_PATH — fix before continuing" >&2
      echo "$TSC_OUTPUT" | grep "error TS" | head -5 >&2
    else
      echo "[HOOK] TSC: 0 errors — server clean" >&2
    fi
  fi

  if [[ "$FILE_PATH" == *"/client/"* ]]; then
    cd "$PROJECT/client" 2>/dev/null
    TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
    ERRORS=$(echo "$TSC_OUTPUT" | grep "error TS" | wc -l)
    if [ "$ERRORS" -gt "0" ]; then
      echo "[HOOK] TSC: $ERRORS errors after editing $FILE_PATH — fix before continuing" >&2
      echo "$TSC_OUTPUT" | grep "error TS" | head -5 >&2
    else
      echo "[HOOK] TSC: 0 errors — client clean" >&2
    fi
  fi
fi

echo "$INPUT"
exit 0
