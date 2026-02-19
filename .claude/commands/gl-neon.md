---
description: Run a diagnostic query against the Neon PostgreSQL database
argument-hint: SQL query or table name to inspect
allowed-tools: ["Bash", "Read"]
---

# GoldLedger Neon Database Query

Query/table: $ARGUMENTS

```bash
cd server && node --input-type=module << 'SCRIPT'
import { db } from './src/schema/connection.js';
import { sql } from 'drizzle-orm';

// If argument is a table name, do SELECT COUNT(*) and LIMIT 5
// If argument is SQL, run it directly
const query = process.env.GL_QUERY || 'SELECT COUNT(*) FROM transactions';
const result = await db.execute(sql.raw(query));
console.log(JSON.stringify(result.rows, null, 2));
process.exit(0);
SCRIPT
```

Show results formatted as a table. Flag any anomalies (0 rows, unexpected nulls, etc).
