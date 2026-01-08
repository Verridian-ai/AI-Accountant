import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { rateLimiter } from 'hono-rate-limiter'
import { jwt } from 'hono/jwt'
import { stream } from 'hono/streaming'
import { db, transactions, statements, users } from './schema.js'
import { desc, eq, and } from 'drizzle-orm'
import { pipeline } from './services/pipeline.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { hashPassword, comparePassword, generateToken } from './auth.js';
import { events } from './events.js';

const app = new Hono()
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

// Apply body limit to all API routes (except uploads)
app.use(
    '/api/chat',
    bodyLimit({
        maxSize: 100 * 1024, // 100kb limit for chat requests
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

// Auth routes
app.post('/auth/register', async (c) => {
    const { username, password } = await c.req.json();
    if (!username || !password) return c.json({ error: 'Missing username or password' }, 400);

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();

    try {
        await db.insert(users).values({ id, username, passwordHash });
        const token = await generateToken(id);
        return c.json({ token, user: { id, username } });
    } catch (err) {
        return c.json({ error: 'Username already exists' }, 400);
    }
});

app.post('/auth/login', async (c) => {
    const { username, password } = await c.req.json();
    const user = await db.select().from(users).where(eq(users.username, username)).get();

    if (!user || !(await comparePassword(password, user.passwordHash))) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await generateToken(user.id);
    return c.json({ token, user: { id: user.id, username: user.username } });
});

// Protect all /api routes
app.use('/api/*', jwt({ secret: JWT_SECRET }));

app.get('/', (c) => {
    return c.text('CBA Statement Parser API is running!')
})

app.get('/api/transactions', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const result = await db.select().from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.date))
        .limit(100);
    return c.json(result);
});

app.get('/api/statements', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const result = await db.select().from(statements)
        .where(eq(statements.userId, userId))
        .orderBy(desc(statements.uploadDate));
    return c.json(result);
});

// Authenticated Upload Endpoint
app.post('/api/statements/upload', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file uploaded' }, 400);
    }

    const filename = file.name;
    const fileBuffer = await file.arrayBuffer();
    const hash = crypto.createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

    // Check if duplicate
    const existing = await db.select().from(statements).where(eq(statements.hash, hash)).get();
    if (existing) {
        return c.json({ error: 'File already exists', id: existing.id }, 409);
    }

    const id = crypto.randomUUID();
    const uploadDir = path.resolve(process.cwd(), '../statements');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));

    await db.insert(statements).values({
        id,
        filename,
        hash,
        uploadDate: new Date().toISOString(),
        parsingStatus: 'PENDING',
        userId
    });

    events.emit('update', { type: 'statement_added', id });

    // Trigger pipeline in background
    pipeline.processStatement(id, filePath);

    return c.json({ message: 'File uploaded and processing started', id });
});

import { aiService } from './services/ai.js';

app.post('/api/chat', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const { query } = await c.req.json();
        // Fetch recent context (last 50 transactions for THIS user)
        const context = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date))
            .limit(50);

        const answer = await aiService.generateInsight(query, context);
        return c.json({ answer });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed' }, 500);
    }
});

app.post('/api/statements/:id/reprocess', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const id = c.req.param('id');

        // 1. Fetch statement and verify ownership
        const stmt = await db.select().from(statements).where(and(eq(statements.id, id), eq(statements.userId, userId))).get();
        if (!stmt) return c.json({ error: 'Statement not found' }, 404);

        // 2. Clear existing transactions for this statement
        await db.delete(transactions).where(eq(transactions.statementId, id));

        // 3. Reset status to PENDING
        await db.update(statements)
            .set({ parsingStatus: 'PENDING' })
            .where(eq(statements.id, id));

        // 4. Trigger pipeline
        const filePath = path.resolve(process.cwd(), '../statements', stmt.filename);

        // Run in background
        pipeline.processStatement(id, filePath);

        return c.json({ message: 'Reprocessing started' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to trigger reprocessing' }, 500);
    }
});

app.get('/api/events', (c) => {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (stream) => {
        const listener = (data: any) => {
            stream.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        events.on('update', listener);

        const keepAlive = setInterval(() => {
            stream.write(': keep-alive\n\n');
        }, 30000);

        stream.onAbort(() => {
            events.off('update', listener);
            clearInterval(keepAlive);
        });

        // Loop to keep the stream open
        while (true) {
            await stream.sleep(1000);
        }
    });
});

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
    fetch: app.fetch,
    port
})
