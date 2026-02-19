---
description: Run TypeScript check on both server and client, show all errors
allowed-tools: ["Bash", "Write"]
---

# GoldLedger TypeScript Check

Running full tsc check on server and client...

```bash
echo "=== SERVER ===" && cd server && npx tsc --noEmit 2>&1 && echo "✅ Server: 0 errors" || echo "❌ Server has errors above"
echo "=== CLIENT ===" && cd ../client && npx tsc --noEmit 2>&1 && echo "✅ Client: 0 errors" || echo "❌ Client has errors above"
```

If errors found: list them grouped by file, with fix suggestions for each.
