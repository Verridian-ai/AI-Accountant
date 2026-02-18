#!/bin/bash
cd "/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

echo "=============================================="
echo " FULL CODEBASE SPLIT AUDIT"
echo " $(date)"
echo "=============================================="

echo ""
echo "=== GIT STATUS ==="
git log --oneline -15
echo ""
git status --short | wc -l
echo " uncommitted files"
git status --short | head -10

echo ""
echo "=== TYPESCRIPT ERRORS ==="
echo "Server:"
cd server && npx tsc --noEmit 2>&1 | tail -3
cd ..
echo "Client:"
cd client && npx tsc --noEmit 2>&1 | tail -3
cd ..

echo ""
echo "=== FILES STILL > 500 LINES ==="
find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; 2>/dev/null | sort -rn | awk '$1 > 500'

echo ""
echo "=== COUNT SUMMARY ==="
over500=$(find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; 2>/dev/null | awk '$1 > 500' | wc -l)
over300=$(find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; 2>/dev/null | awk '$1 > 300' | wc -l)
total=$(find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" | wc -l)
echo "Total .ts/.tsx files: $total"
echo "Files > 500 lines: $over500"
echo "Files > 300 lines: $over300"

echo ""
echo "=== RE-EXPORT SHIMS (files < 10 lines, likely thin re-exports) ==="
find server/src/services -maxdepth 1 -name "*.ts" -exec wc -l {} \; 2>/dev/null | sort -n | awk '$1 < 10' | head -20

echo ""
echo "=== SPLIT DIRECTORIES (service dirs with multiple files) ==="
for d in server/src/services/*/; do
  count=$(find "$d" -name "*.ts" 2>/dev/null | wc -l)
  if [ "$count" -gt 1 ]; then
    echo "  $d ($count files)"
  fi
done

echo ""
echo "=== CLIENT SPLIT DIRECTORIES ==="
find client/src -type d -name "*" | while read d; do
  count=$(find "$d" -maxdepth 1 \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l)
  if [ "$count" -gt 3 ]; then
    parent=$(basename "$d")
    echo "  $d ($count files)"
  fi
done

echo ""
echo "=== TMUX SESSIONS ==="
tmux list-sessions 2>/dev/null || echo "None"
echo ""
echo "=== CLAUDE PROCESSES ==="
ps aux 2>/dev/null | grep "claude" | grep -v grep | grep -v chrome | grep -v "cli.js" | wc -l
echo " claude instances"

echo ""
echo "=== AUDIT COMPLETE ==="
