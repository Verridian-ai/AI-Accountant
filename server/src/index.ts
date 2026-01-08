import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { db, transactions, statements } from './db.js'
import { desc, eq } from 'drizzle-orm'
import './watcher.js' // Start watcher side-effect

const app = new Hono()

app.use('/*', cors())

app.get('/', (c) => {
    return c.text('CBA Statement Parser API is running!')
})

app.get('/api/transactions', async (c) => {
    const result = await db.select().from(transactions).orderBy(desc(transactions.date)).limit(100);
    return c.json(result);
});

app.get('/api/statements', async (c) => {
    const result = await db.select().from(statements).orderBy(desc(statements.uploadDate));
    return c.json(result);
});

import { aiService } from './services/ai.js';

app.post('/api/chat', async (c) => {
    try {
        const { query } = await c.req.json();
        // Fetch recent context (last 50 transactions)
        const context = await db.select().from(transactions).orderBy(desc(transactions.date)).limit(50);

        const answer = await aiService.generateInsight(query, context);
        return c.json({ answer });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed' }, 500);
    }
});

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})
