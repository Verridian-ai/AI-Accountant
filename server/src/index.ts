import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { rateLimiter } from 'hono-rate-limiter'
import { jwt, verify } from 'hono/jwt'
import { stream } from 'hono/streaming'
import { db, transactions, statements, users, userSettings, transactionHistory } from './schema.js'
import { desc, eq, and, gte, lte, like } from 'drizzle-orm'
import * as XLSX from 'xlsx';
import { pipeline } from './services/pipeline.js';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import crypto from 'crypto';
import { hashPassword, comparePassword, generateToken } from './auth.js';
import { events } from './events.js';
import { aiService } from './services/ai.js';
import { ragService } from './services/rag.js';

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
    } catch (_err) {
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
app.use('/api/*', async (c, next) => {
    // For SSE, standard EventSource doesn't support headers, so we allow query param
    const token = c.req.query('token');
    if (token && c.req.path === '/api/events') {
        try {
            const payload = await verify(token, JWT_SECRET);
            c.set('jwtPayload', payload);
            return next();
        } catch (_e) {
            // If query token is invalid, let jwt middleware handle it (will likely 401)
        }
    }
    const middleware = jwt({ secret: JWT_SECRET });
    return middleware(c, next);
});

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

app.patch('/api/transactions/:id', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const id = c.req.param('id');
        const body = await c.req.json();

        const oldData = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
            .get();

        if (!oldData) return c.json({ error: 'Not found' }, 404);

        const updateData = {
            description: body.description ?? oldData.description,
            amount: body.amount ?? oldData.amount,
            category: body.category ?? oldData.category,
            gstApplicable: body.gstApplicable ?? oldData.gstApplicable,
            isEdited: true
        };

        await db.update(transactions)
            .set(updateData)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

        await db.insert(transactionHistory).values({
            id: crypto.randomUUID(),
            transactionId: id,
            changeType: 'EDIT',
            oldData: JSON.stringify(oldData),
            newData: JSON.stringify(updateData),
            timestamp: new Date().toISOString()
        });

        return c.json({ success: true });
    } catch (err) {
        console.error('Update failed:', err);
        return c.json({ error: 'Update failed' }, 500);
    }
});

app.post('/api/transactions/:id/split', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const id = c.req.param('id');
        const { splits } = await c.req.json();

        const original = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
            .get();

        if (!original) return c.json({ error: 'Not found' }, 404);

        const newTransactions = splits.map((split: any) => ({
            id: crypto.randomUUID(),
            date: original.date,
            description: split.description || original.description,
            amount: split.amount,
            balance: original.balance,
            category: split.category,
            gstApplicable: split.gst,
            parentTransactionId: original.id,
            userId: userId,
            isEdited: true
        }));

        await db.insert(transactions).values(newTransactions);

        // Zero out the original to effectively "hide" it from totals but keep it for reference
        await db.update(transactions)
            .set({ amount: 0, isEdited: true, aiReasoningNotes: 'Split into multiple transactions' })
            .where(eq(transactions.id, id));

        await db.insert(transactionHistory).values({
            id: crypto.randomUUID(),
            transactionId: id,
            changeType: 'SPLIT',
            oldData: JSON.stringify(original),
            newData: JSON.stringify(newTransactions),
            timestamp: new Date().toISOString()
        });

        return c.json({ success: true });
    } catch (err) {
        console.error('Split failed:', err);
        return c.json({ error: 'Split failed' }, 500);
    }
});

app.get('/api/transactions/export', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const format = c.req.query('format') || 'csv';
        const startDate = c.req.query('startDate');
        const endDate = c.req.query('endDate');
        const category = c.req.query('category');
        const search = c.req.query('search');

        let filters = [eq(transactions.userId, userId)];

        if (startDate) {
            filters.push(gte(transactions.date, startDate));
        }
        if (endDate) {
            filters.push(lte(transactions.date, endDate));
        }
        if (category && category !== 'All') {
            filters.push(eq(transactions.category, category));
        }
        if (search) {
            filters.push(like(transactions.description, `%${search}%`));
        }

        const data = await db.select().from(transactions)
            .where(and(...filters))
            .orderBy(desc(transactions.date));

        const exportData = data.map(t => {
            // Ensure date is in DD/MM/YYYY format for Australia
            const dateParts = t.date.split('-'); // Assuming YYYY-MM-DD
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : t.date;

            return {
                Date: formattedDate,
                Description: t.description,
                Amount: (t.amount / 100).toFixed(2),
                Category: t.category || 'Uncategorized',
                'GST Applicable': t.gstApplicable ? 'Yes' : 'No',
                'AI Reasoning': t.aiReasoningNotes || ''
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        if (format === 'xlsx') {
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            c.header('Content-Disposition', 'attachment; filename="transactions.xlsx"');
            return c.body(buf);
        } else {
            const csv = XLSX.utils.sheet_to_csv(ws);
            c.header('Content-Type', 'text/csv; charset=utf-8');
            c.header('Content-Disposition', 'attachment; filename="transactions.csv"');
            return c.body(csv);
        }
    } catch (err) {
        console.error('Export failed:', err);
        return c.json({ error: 'Export failed' }, 500);
    }
});

app.get('/api/statements', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const result = await db.select().from(statements)
        .where(eq(statements.userId, userId))
        .orderBy(desc(statements.uploadDate));
    return c.json(result);
});

app.get('/api/settings', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    let settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

    if (!settings) {
        // Create default settings if not exists
        const defaultSettings = {
            userId,
            modelParsingText: 'google/gemini-3-flash-preview',
            modelParsingVision: 'google/gemini-3-flash-preview',
            modelCategorization: 'google/gemini-3-flash-preview',
            modelChat: 'google/gemini-3-flash-preview',
            modelEmbedding: 'openai/text-embedding-3-large',
        };
        await db.insert(userSettings).values(defaultSettings);
        settings = defaultSettings;
    }

    return c.json(settings);
});

app.patch('/api/settings', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();

    await db.update(userSettings)
        .set(body)
        .where(eq(userSettings.userId, userId));

    const updated = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
    return c.json(updated);
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
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, Buffer.from(fileBuffer));

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

        // Fetch user settings for chat model
        let settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
        if (!settings) {
            settings = {
                userId,
                modelParsingText: 'google/gemini-3-flash-preview',
                modelParsingVision: 'google/gemini-3-flash-preview',
                modelCategorization: 'google/gemini-3-flash-preview',
                modelChat: 'google/gemini-3-flash-preview',
                modelEmbedding: 'openai/text-embedding-3-large',
            };
            await db.insert(userSettings).values(settings);
        }

        // 1. Semantic search in Cognee
        let ragContext = '';
        try {
            console.log(`[Chat] Searching Cognee for: ${query}`);
            const ragResults = await ragService.search(query, settings.modelChat);
            if (ragResults && ragResults.status === 'success') {
                ragContext = JSON.stringify(ragResults.results);
            }
        } catch (ragErr) {
            console.error("[Chat Cognee Error]", ragErr);
        }

        // 2. Combine with recent transactions context
        const combinedContext = {
            recentTransactions: context,
            semanticSearchResults: ragContext
        };

        const answer = await aiService.generateInsight(query, combinedContext, settings.modelChat);
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
