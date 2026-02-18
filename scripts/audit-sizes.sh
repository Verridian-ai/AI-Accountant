#!/bin/bash
cd "/mnt/c/Users/Danie/Desktop/CBA Statements Parse"
echo "=== FILES > 500 LINES ==="
find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; | sort -rn | awk '$1 > 500' | head -40
echo ""
echo "=== COUNT ==="
find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; | awk '$1 > 500' | wc -l
echo "files over 500 lines"
