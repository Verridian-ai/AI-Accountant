#!/bin/bash
# Post-write hook: block dangerous patterns after they're written to disk
# Checks written content for known bad patterns
# Reads JSON from stdin (Claude Code hook convention)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const i=JSON.parse(d);console.log(i.tool_input?.file_path||'')}catch(e){console.log('')}})")
CONTENT=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const i=JSON.parse(d);console.log(i.tool_input?.content||'')}catch(e){console.log('')}})")

BLOCKED=0

# Block @ts-ignore in TypeScript files
if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  if echo "$CONTENT" | grep -q "@ts-ignore\|@ts-expect-error"; then
    echo "[HOOK] BLOCKED: @ts-ignore/@ts-expect-error detected in $FILE_PATH — fix the type properly" >&2
    BLOCKED=1
  fi

  # Warn on as any (don't block, just warn)
  if echo "$CONTENT" | grep -q " as any"; then
    echo "[HOOK] WARNING: 'as any' detected in $FILE_PATH — consider using proper types" >&2
  fi

  # Warn on hardcoded localhost
  if echo "$CONTENT" | grep -qE "localhost:[0-9]{4}"; then
    echo "[HOOK] WARNING: hardcoded localhost URL in $FILE_PATH — use BASE_URL or API_URL constants" >&2
  fi
fi

# Block secrets in any file
if echo "$CONTENT" | grep -qiE "password\s*=\s*['\"][^'\"]{3,}|secret\s*=\s*['\"][^'\"]{3,}|api_key\s*=\s*['\"][^'\"]{3,}"; then
  echo "[HOOK] BLOCKED: Possible hardcoded secret detected in $FILE_PATH — use environment variables" >&2
  BLOCKED=1
fi

echo "$INPUT"

if [ "$BLOCKED" -eq "1" ]; then
  exit 1
fi
exit 0
