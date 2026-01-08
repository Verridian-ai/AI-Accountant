import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { rateLimiter } from 'hono-rate-limiter'
import { db, transactions, statements } from './db.js'
import { desc, eq } from 'drizzle-orm'
import './watcher.js' // Start watcher side-effect
import { pipeline } from './services/pipeline.js';
import path from 'path';

const app = new Hono()

// Apply body limit to all API routes
app.use(
    '/api/*',
    bodyLimit({
        maxSize: 100 * 1024, // 100kb limit for API requests
        onError: (c) => {
            return c.json({ error: 'Payload Too Large' }, 413)
        },
    })
)

// General API rate limiter: 30 requests per minute
const generalLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
    message: { error: 'Too many requests, please try again later.' },
})

// Strict limiter for expensive AI endpoints: 5 requests per minute
const chatLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
    message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
})

app.use('/*', cors())
app.use('/api/*', generalLimiter)
app.use('/api/chat', chatLimiter)

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

app.post('/api/statements/:id/reprocess', async (c) => {
    try {
        const id = c.req.param('id');

        // 1. Fetch statement to get filename
        const stmt = await db.select().from(statements).where(eq(statements.id, id)).get();
        if (!stmt) return c.json({ error: 'Statement not found' }, 404);

        // 2. Clear existing transactions for this statement
        await db.delete(transactions).where(eq(transactions.statementId, id));

        // 3. Reset status to PENDING
        await db.update(statements)
            .set({ parsingStatus: 'PENDING' })
            .where(eq(statements.id, id));

        // 4. Trigger pipeline
        // Use WATCH_DIR from watcher or resolve manually. Watcher.ts uses ../statements
        const filePath = path.resolve(process.cwd(), '../statements', stmt.filename);

        // Run in background
        pipeline.processStatement(id, filePath);

        return c.json({ message: 'Reprocessing started' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to trigger reprocessing' }, 500);
    }
});

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})
