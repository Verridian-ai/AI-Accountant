#!/bin/bash
cd "/mnt/c/Users/Danie/Desktop/CBA Statements Parse"

echo "=============================================="
echo " LARGE FILE AUDIT (> 300 lines)"
echo "=============================================="

echo ""
echo "=== SERVER FILES > 300 lines ==="
find server/src -name "*.ts" ! -path "*/node_modules/*" -exec wc -l {} \; | sort -rn | awk '$1 > 300'

echo ""
echo "=== CLIENT FILES > 300 lines ==="
find client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; | sort -rn | awk '$1 > 300'

echo ""
echo "=== SUMMARY ==="
server_big=$(find server/src -name "*.ts" ! -path "*/node_modules/*" -exec wc -l {} \; | awk '$1 > 300' | wc -l)
client_big=$(find client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; | awk '$1 > 300' | wc -l)
server_total=$(find server/src -name "*.ts" ! -path "*/node_modules/*" | wc -l)
client_total=$(find client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" | wc -l)

echo "Server: $server_big files > 300 lines (of $server_total total)"
echo "Client: $client_big files > 300 lines (of $client_total total)"

echo ""
echo "=== MONSTER FILES > 800 lines ==="
find server/src client/src \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" -exec wc -l {} \; | sort -rn | awk '$1 > 800'
