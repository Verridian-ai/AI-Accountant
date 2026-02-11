import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { rateLimiter } from 'hono-rate-limiter'
import { jwt, verify } from 'hono/jwt'
import { stream } from 'hono/streaming'
import { db, transactions, statements, users, userSettings, transactionHistory, accounts, merchantMemory, pendingCategorization, transferLinks, accountBalanceHistory, reconciliationAlerts, statementAccounts, businessProfiles } from './schema.js'
import { validateABN, normalizeABN, formatABN, validateEntityType, validateBasFrequency, validateAnzsicCode, validateTaxAgentNumber, ENTITY_TYPES, BAS_FREQUENCIES, COMMON_ANZSIC_CODES } from './utils/abn.js'
import { desc, eq, and, gte, lte, like, aliasedTable, sql } from 'drizzle-orm'

import { pipeline } from './services/pipeline.js';
import { bulkUploadQueue } from './services/queue.js';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import crypto from 'crypto';
import { hashPassword, comparePassword, generateToken, verifyToken } from './auth.js';
import { events } from './events.js';
import { aiService } from './services/ai.js';
import { ragService } from './services/rag.js';
import { accountService } from './services/accounts.js';
import { agentService, type PythonAgentType } from './services/agents.js';
import type { AgentType } from './services/claude/types.js';
import { getVertexAIClient, VERTEX_AI_MODELS, FINTECH_MODEL_PRESETS } from './services/vertex-ai.js';
import agentRoutes from './routes/agents.js';
import pipelineRoutes from './routes/pipeline.js';
import { securityHeaders } from './middleware/security.js';
import { auditMiddleware } from './middleware/audit.js';
import { validateBody, loginSchema, registerSchema, chatMessageSchema, transactionUpdateSchema, ValidationError } from './validation/index.js';

const app = new Hono()

// Security headers (OWASP)
app.use('*', securityHeaders());

// Audit logging for mutation endpoints
app.use('/api/*', auditMiddleware({ logReads: false }));
app.use('/auth/*', auditMiddleware({ logReads: false }));

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

// Rate limiter key: prefer real IP from trusted proxy, fall back to connection addr
const getRateLimitKey = (c: any) => {
    // x-real-ip is typically set by a trusted reverse proxy (nginx)
    const realIp = c.req.header('x-real-ip');
    // conninfo is set by Hono's node adapter with the socket remote address
    const remoteAddr = c.env?.incoming?.socket?.remoteAddress || 'unknown';
    return realIp || remoteAddr;
};

// General API rate limiter: relaxed for development
const generalLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 1000, // Increased from 30 to 1000 for local development
    standardHeaders: true,
    keyGenerator: getRateLimitKey,
    message: { error: 'Too many requests, please try again later.' },
})

// Strict limiter for expensive AI endpoints: relaxed for development
const chatLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 100, // Increased from 5 to 100 for local development
    standardHeaders: true,
    keyGenerator: getRateLimitKey,
    message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
})

app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3501'],
    credentials: true,
}))

// Apply rate limiting to API routes, but exclude statement upload/processing
app.use('/api/*', async (c, next) => {
    const path = c.req.path;
    // Skip rate limiting for statement upload and processing endpoints
    if (path.includes('/statements/upload') || path.includes('/statements/retry')) {
        return next();
    }
    return generalLimiter(c, next);
})
app.use('/api/chat', chatLimiter)

// Auth routes
app.post('/auth/register', async (c) => {
    let validated;
    try {
        validated = validateBody(registerSchema, await c.req.json());
    } catch (e) {
        if (e instanceof ValidationError) return c.json({ error: e.message, details: e.errors }, 400);
        return c.json({ error: 'Invalid request body' }, 400);
    }
    const { username, password } = validated;

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
    let validated;
    try {
        validated = validateBody(loginSchema, await c.req.json());
    } catch (e) {
        if (e instanceof ValidationError) return c.json({ error: e.message, details: e.errors }, 400);
        return c.json({ error: 'Invalid request body' }, 400);
    }
    const { username, password } = validated;
    const user = await db.select().from(users).where(eq(users.username, username)).get();

    if (!user || !(await comparePassword(password, user.passwordHash))) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await generateToken(user.id);
    return c.json({ token, user: { id: user.id, username: user.username } });
});

app.get('/auth/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'No token' }, 401);

    const token = authHeader.replace('Bearer ', '');
    try {
        const payload = await verifyToken(token);
        if (!payload) return c.json({ error: 'Invalid token' }, 401);

        const user = await db.select().from(users).where(eq(users.id, payload.userId as string)).get();
        if (!user) return c.json({ error: 'User not found' }, 404);

        return c.json({ user: { id: user.id, username: user.username } });
    } catch (_e) {
        return c.json({ error: 'Verification failed' }, 401);
    }
});

// Protect all /api routes (except public endpoints)
app.use('/api/*', async (c, next) => {
    // Public endpoints that don't require auth
    const publicPaths = ['/api/vertex-ai/models', '/api/vertex-ai/test'];
    if (publicPaths.includes(c.req.path)) {
        return next();
    }

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
    return c.text('GoldLedger API is running!')
})

// Health check for Cloud Run
app.get('/health', (c) => {
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Vertex AI test endpoint (public for testing)
app.get('/api/vertex-ai/models', (c) => {
    return c.json({
        models: VERTEX_AI_MODELS,
        presets: FINTECH_MODEL_PRESETS,
        count: VERTEX_AI_MODELS.length
    })
})

app.get('/api/vertex-ai/test', async (c) => {
    try {
        const client = getVertexAIClient();
        const result = await client.testConnection();
        return c.json(result)
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500)
    }
})

app.get('/api/transactions', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const offset = parseInt(c.req.query('offset') || '0');
    const accountId = c.req.query('accountId');

    const whereConditions = accountId
        ? and(eq(transactions.userId, userId), eq(transactions.accountId, accountId))
        : eq(transactions.userId, userId);

    const [result, countResult] = await Promise.all([
        db.select().from(transactions)
            .where(whereConditions)
            .orderBy(desc(transactions.date))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(transactions)
            .where(whereConditions),
    ]);

    const total = countResult[0]?.count ?? 0;
    return c.json({ transactions: result, total });
});

app.patch('/api/transactions/:id', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const id = c.req.param('id');
        let body;
        try {
            body = validateBody(transactionUpdateSchema, await c.req.json());
        } catch (e) {
            if (e instanceof ValidationError) return c.json({ error: e.message, details: e.errors }, 400);
            return c.json({ error: 'Invalid request body' }, 400);
        }

        const oldData = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
            .get();

        if (!oldData) return c.json({ error: 'Not found' }, 404);

        const updateData = {
            description: (body as any).description ?? oldData.description,
            amount: (body as any).amount ?? oldData.amount,
            category: (body as any).category ?? oldData.category,
            gstApplicable: (body as any).gstApplicable ?? oldData.gstApplicable,
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

        events.emit('update', { type: 'transactions_updated' });

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

        events.emit('update', { type: 'transactions_updated' });

        return c.json({ success: true });
    } catch (err) {
        console.error('Split failed:', err);
        return c.json({ error: 'Split failed' }, 500);
    }
});

app.delete('/api/transactions/:id', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const id = c.req.param('id');

        const existing = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
            .get();

        if (!existing) return c.json({ error: 'Not found' }, 404);

        // Record deletion in history
        await db.insert(transactionHistory).values({
            id: crypto.randomUUID(),
            transactionId: id,
            changeType: 'DELETE',
            oldData: JSON.stringify(existing),
            newData: null,
            timestamp: new Date().toISOString()
        });

        // Delete the transaction
        await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

        events.emit('update', { type: 'transactions_updated' });

        return c.json({ success: true });
    } catch (err) {
        console.error('Delete failed:', err);
        return c.json({ error: 'Delete failed' }, 500);
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

        const filters = [eq(transactions.userId, userId)];

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

        const exportData = data.map((t: any) => {
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

        // Native CSV generation to avoid dependencies
        const generateCSV = (data: any[]) => {
            if (data.length === 0) return '';

            const headers = Object.keys(data[0]);
            const headerRow = headers.map(h => `"${h}"`).join(','); // Simple quoting

            const rows = data.map(row => {
                return headers.map(header => {
                    let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
                    // Escape quotes and wrap in quotes if contains comma, quote or newline
                    if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
                        cell = `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                }).join(',');
            });

            return [headerRow, ...rows].join('\n');
        };

        if (format === 'xlsx') {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.default.Workbook();
            const worksheet = workbook.addWorksheet('Transactions');

            if (exportData.length > 0) {
                // Add headers
                worksheet.columns = Object.keys(exportData[0]).map(key => ({
                    header: key,
                    key: key,
                    width: key === 'Description' ? 40 : 15
                }));
                // Add rows
                worksheet.addRows(exportData);
            }

            // Write to buffer
            const buf = await workbook.xlsx.writeBuffer();

            c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            c.header('Content-Disposition', 'attachment; filename="transactions.xlsx"');
            return c.body(buf as any); // Hono types might strictly expect string | ArrayBuffer
        } else {
            const csv = generateCSV(exportData);
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

    const originalFilename = file.name;
    const fileBuffer = await file.arrayBuffer();
    const hash = crypto.createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

    // Check if duplicate based on file content hash
    const existing = await db.select().from(statements).where(eq(statements.hash, hash)).get();
    if (existing) {
        return c.json({
            error: 'Duplicate statement detected',
            id: existing.id,
            existingFilename: existing.filename,
            uploadedOn: existing.uploadDate
        }, 409);
    }

    const id = crypto.randomUUID();
    // Sanitize filename to prevent path traversal
    const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = `${crypto.randomUUID()}_${sanitizedName}`;
    const uploadDir = path.resolve(process.cwd(), '../statements');
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeFilename);
    // Verify resolved path is within the upload directory
    if (!path.resolve(filePath).startsWith(path.resolve(uploadDir))) {
        return c.json({ error: 'Invalid file path' }, 400);
    }
    await writeFile(filePath, Buffer.from(fileBuffer));

    await db.insert(statements).values({
        id,
        filename: originalFilename,
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

// Batch Upload Endpoint - accepts multiple PDFs via queue system
app.post('/api/statements/batch', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const body = await c.req.parseBody({ all: true });
        const files = body['files'];

        if (!files) {
            return c.json({ error: 'No files uploaded' }, 400);
        }

        // Normalize to array
        const fileArray = Array.isArray(files) ? files : [files];
        const validFiles = fileArray.filter((f): f is File => f instanceof File);

        if (validFiles.length === 0) {
            return c.json({ error: 'No valid files found' }, 400);
        }

        if (validFiles.length > 50) {
            return c.json({ error: 'Maximum 50 files per batch' }, 400);
        }

        // Convert File objects to FileInfo for the queue
        const fileInfos = await Promise.all(validFiles.map(async (file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
            buffer: Buffer.from(await file.arrayBuffer()),
        })));

        // Submit to queue
        const job = await bulkUploadQueue.addJob(fileInfos, userId, {
            priority: validFiles.length > 10 ? 'normal' : 'high',
            metadata: { source: 'batch_upload', fileCount: validFiles.length },
        });

        return c.json({
            message: `Batch of ${validFiles.length} files queued for processing`,
            jobId: job.id,
            fileCount: validFiles.length,
            files: job.files.map(f => ({
                id: f.id,
                filename: f.originalName,
                state: f.state,
            })),
        });
    } catch (err: any) {
        console.error('[Batch Upload Error]', err);
        if (err.code === 'BATCH_SIZE_EXCEEDED') {
            return c.json({ error: err.message }, 400);
        }
        return c.json({ error: 'Batch upload failed: ' + (err.message || 'Unknown error') }, 500);
    }
});

// Get batch job status
app.get('/api/statements/batch/:jobId', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const jobId = c.req.param('jobId');

        const job = bulkUploadQueue.getJobStatus(jobId);
        if (!job) {
            return c.json({ error: 'Job not found' }, 404);
        }
        if (job.userId !== userId) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        return c.json({
            id: job.id,
            state: job.state,
            progress: job.progress,
            files: job.files.map(f => ({
                id: f.id,
                filename: f.originalName,
                state: f.state,
                statementId: f.statementId,
                error: f.error,
                retryCount: f.retryCount,
            })),
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            error: job.error,
        });
    } catch (err) {
        console.error('[Batch Status Error]', err);
        return c.json({ error: 'Failed to get batch status' }, 500);
    }
});

// Cancel a batch job
app.post('/api/statements/batch/:jobId/cancel', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const jobId = c.req.param('jobId');

        const job = bulkUploadQueue.getJobStatus(jobId);
        if (!job) {
            return c.json({ error: 'Job not found' }, 404);
        }
        if (job.userId !== userId) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const cancelled = await bulkUploadQueue.cancelJob(jobId);
        return c.json({ cancelled });
    } catch (err) {
        console.error('[Batch Cancel Error]', err);
        return c.json({ error: 'Failed to cancel batch' }, 500);
    }
});

// Retry a failed batch job
app.post('/api/statements/batch/:jobId/retry', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const jobId = c.req.param('jobId');

        const job = bulkUploadQueue.getJobStatus(jobId);
        if (!job) {
            return c.json({ error: 'Job not found' }, 404);
        }
        if (job.userId !== userId) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const retried = await bulkUploadQueue.retryJob(jobId);
        return c.json({ retried });
    } catch (err) {
        console.error('[Batch Retry Error]', err);
        return c.json({ error: 'Failed to retry batch' }, 500);
    }
});

// Get queue stats
app.get('/api/queue/stats', async (c) => {
    try {
        const stats = bulkUploadQueue.getStats();
        return c.json(stats);
    } catch (err) {
        console.error('[Queue Stats Error]', err);
        return c.json({ error: 'Failed to get queue stats' }, 500);
    }
});

// ============================================================================
// BUSINESS PROFILE ENDPOINTS
// ============================================================================

// Get business profile for current user
app.get('/api/business-profile', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        let profile = await db.select().from(businessProfiles)
            .where(eq(businessProfiles.userId, userId))
            .get();

        if (!profile) {
            // Return empty profile structure (not created yet)
            return c.json({
                exists: false,
                profile: null,
                entityTypes: ENTITY_TYPES,
                basFrequencies: BAS_FREQUENCIES,
                commonIndustryCodes: COMMON_ANZSIC_CODES
            });
        }

        return c.json({
            exists: true,
            profile: {
                ...profile,
                abnFormatted: profile.abn ? formatABN(profile.abn) : null
            },
            entityTypes: ENTITY_TYPES,
            basFrequencies: BAS_FREQUENCIES,
            commonIndustryCodes: COMMON_ANZSIC_CODES
        });
    } catch (err) {
        console.error('Error fetching business profile:', err);
        return c.json({ error: 'Failed to fetch business profile' }, 500);
    }
});

// Create or update business profile
app.post('/api/business-profile', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();

        const validationErrors: string[] = [];

        // Validate ABN if provided
        let normalizedABN: string | null = null;
        if (body.abn && body.abn.trim() !== '') {
            const abnValidation = validateABN(body.abn);
            if (!abnValidation.isValid) {
                validationErrors.push(abnValidation.error || 'Invalid ABN');
            } else {
                normalizedABN = normalizeABN(body.abn);
            }
        }

        // Validate entity type
        if (body.entityType && !validateEntityType(body.entityType)) {
            validationErrors.push(`Invalid entity type. Must be one of: ${Object.keys(ENTITY_TYPES).join(', ')}`);
        }

        // Validate BAS frequency
        if (body.basFrequency && !validateBasFrequency(body.basFrequency)) {
            validationErrors.push(`Invalid BAS frequency. Must be one of: ${Object.keys(BAS_FREQUENCIES).join(', ')}`);
        }

        // Validate industry code if provided
        if (body.industryCode && !validateAnzsicCode(body.industryCode)) {
            validationErrors.push('Industry code must be a 4-digit ANZSIC code');
        }

        // Validate tax agent number if provided
        if (body.taxAgentNumber && !validateTaxAgentNumber(body.taxAgentNumber)) {
            validationErrors.push('Tax Agent Number must be 7-8 digits');
        }

        // Return validation errors if any
        if (validationErrors.length > 0) {
            return c.json({
                error: 'Validation failed',
                validationErrors
            }, 400);
        }

        const now = new Date().toISOString();

        // Check if profile exists
        const existing = await db.select().from(businessProfiles)
            .where(eq(businessProfiles.userId, userId))
            .get();

        const profileData = {
            abn: normalizedABN,
            entityType: body.entityType || 'individual',
            businessName: body.businessName || null,
            legalName: body.legalName || null,
            gstRegistered: body.gstRegistered ?? false,
            gstRegistrationDate: body.gstRegistrationDate || null,
            basFrequency: body.basFrequency || 'quarterly',
            accountingMethod: body.accountingMethod || 'cash',
            taxAgentNumber: body.taxAgentNumber?.replace(/\s+/g, '') || null,
            taxAgentName: body.taxAgentName || null,
            industryCode: body.industryCode || null,
            industryDescription: body.industryDescription || null,
            businessAddress: body.businessAddress ? JSON.stringify(body.businessAddress) : null,
            businessPhone: body.businessPhone || null,
            businessEmail: body.businessEmail || null,
            financialYearEnd: body.financialYearEnd || '06-30',
            updatedAt: now
        };

        if (existing) {
            // Update existing profile
            await db.update(businessProfiles)
                .set(profileData)
                .where(eq(businessProfiles.userId, userId));
        } else {
            // Create new profile
            await db.insert(businessProfiles).values({
                id: crypto.randomUUID(),
                userId,
                ...profileData,
                createdAt: now
            });
        }

        // Fetch and return updated profile
        const updatedProfile = await db.select().from(businessProfiles)
            .where(eq(businessProfiles.userId, userId))
            .get();

        return c.json({
            success: true,
            profile: {
                ...updatedProfile,
                abnFormatted: updatedProfile?.abn ? formatABN(updatedProfile.abn) : null
            }
        });
    } catch (err) {
        console.error('Error saving business profile:', err);
        return c.json({ error: 'Failed to save business profile' }, 500);
    }
});

// Validate ABN endpoint (for real-time validation in UI)
app.post('/api/validate-abn', async (c) => {
    try {
        const { abn } = await c.req.json();

        if (!abn) {
            return c.json({ isValid: false, error: 'ABN is required' });
        }

        const result = validateABN(abn);
        return c.json(result);
    } catch (err) {
        console.error('Error validating ABN:', err);
        return c.json({ error: 'Validation failed' }, 500);
    }
});

// Get reference data (entity types, BAS frequencies, industry codes)
app.get('/api/business-profile/reference-data', async (c) => {
    return c.json({
        entityTypes: ENTITY_TYPES,
        basFrequencies: BAS_FREQUENCIES,
        commonIndustryCodes: COMMON_ANZSIC_CODES
    });
});

app.post('/api/chat', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        let chatBody;
        try {
            chatBody = validateBody(chatMessageSchema, await c.req.json());
        } catch (e) {
            if (e instanceof ValidationError) return c.json({ answer: e.errors.map(err => err.message).join('; ') }, 400);
            return c.json({ answer: 'Invalid request body' }, 400);
        }
        const { query } = chatBody;
        if (!query.trim()) {
            return c.json({ answer: 'Please enter a question about your finances.' }, 400);
        }
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

        // 1. Multi-type semantic search in Cognee
        //    CHUNKS: direct transaction matches | GRAPH_SUMMARY_COMPLETION: contextual analysis
        let ragContext = '';
        try {
            console.log(`[Chat] Searching Cognee for: ${query}`);
            const multiResults = await ragService.searchMulti(query);
            const allResults = [...multiResults.chunks, ...multiResults.summary];
            if (allResults.length > 0) {
                ragContext = JSON.stringify({
                    directMatches: multiResults.chunks,
                    contextualAnalysis: multiResults.summary,
                });
                console.log(`[Chat] Cognee returned ${multiResults.chunks.length} chunks + ${multiResults.summary.length} summaries`);
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
        console.error('[Chat Error]', err);
        return c.json({ answer: 'I encountered an error processing your request. Please try again.' }, 500);
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

        // 3. Reset status to PENDING and clear all metadata
        await db.update(statements)
            .set({
                parsingStatus: 'PENDING',
                errorType: null,
                errorMessage: null,
                errorDetails: null,
                transactionCount: 0,
                periodStartDate: null,
                periodEndDate: null,
                openingBalance: null,
                closingBalance: null,
            })
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
            const payload = JSON.stringify(data);
            // Always send on 'update' channel for legacy listeners
            stream.write(`event: update\ndata: ${payload}\n\n`);
            // Also send on typed channel so clients can filter by event type
            if (data?.type && data.type !== 'update') {
                stream.write(`event: ${data.type}\ndata: ${payload}\n\n`);
            }
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

// ============ STATEMENT GAP DETECTION ============

// Get statement gap analysis for the current user
app.get('/api/statements/gap-analysis', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    try {
        // Get all completed statements with period info, grouped by account
        const stmts = await db.select({
            id: statements.id,
            filename: statements.filename,
            periodStartDate: statements.periodStartDate,
            periodEndDate: statements.periodEndDate,
            openingBalance: statements.openingBalance,
            closingBalance: statements.closingBalance,
            transactionCount: statements.transactionCount,
            parsingStatus: statements.parsingStatus,
        })
            .from(statements)
            .where(and(
                eq(statements.userId, userId),
                eq(statements.parsingStatus, 'COMPLETED')
            ))
            .orderBy(statements.periodStartDate)
            .all();

        // Get statements linked to accounts
        const stmtAccounts = await db.select({
            statementId: statementAccounts.statementId,
            accountId: statementAccounts.accountId,
        }).from(statementAccounts).all();

        const stmtAccountMap = new Map(stmtAccounts.map((sa: any) => [sa.statementId, sa.accountId]));

        // Group statements by account
        const accountStatements = new Map<string, typeof stmts>();
        const unlinkedStatements: typeof stmts = [];

        for (const stmt of stmts) {
            const accountId = stmtAccountMap.get(stmt.id) as string | undefined;
            if (accountId) {
                if (!accountStatements.has(accountId)) {
                    accountStatements.set(accountId, []);
                }
                accountStatements.get(accountId)!.push(stmt);
            } else {
                unlinkedStatements.push(stmt);
            }
        }

        // Analyze gaps for each account
        const gaps: Array<{
            accountId: string | null;
            gapStart: string;
            gapEnd: string;
            gapDays: number;
            beforeStatement: string | null;
            afterStatement: string | null;
        }> = [];

        const overlaps: Array<{
            accountId: string | null;
            statement1: string;
            statement2: string;
            overlapStart: string;
            overlapEnd: string;
            overlapDays: number;
        }> = [];

        const balanceMismatches: Array<{
            accountId: string | null;
            statement1: string;
            statement2: string;
            expectedBalance: number;
            actualBalance: number;
            difference: number;
        }> = [];

        const analyzeStatementGroup = (stmtGroup: typeof stmts, accountId: string | null) => {
            // Sort by start date
            const sorted = [...stmtGroup].sort((a, b) =>
                (a.periodStartDate || '').localeCompare(b.periodStartDate || '')
            );

            for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i];
                const next = sorted[i + 1];

                if (!current.periodEndDate || !next.periodStartDate) continue;

                const currentEnd = new Date(current.periodEndDate);
                const nextStart = new Date(next.periodStartDate);
                const daysDiff = Math.floor((nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24));

                // Check for gaps (more than 1 day between statements)
                if (daysDiff > 1) {
                    const gapStart = new Date(currentEnd);
                    gapStart.setDate(gapStart.getDate() + 1);
                    const gapEnd = new Date(nextStart);
                    gapEnd.setDate(gapEnd.getDate() - 1);

                    gaps.push({
                        accountId,
                        gapStart: gapStart.toISOString().split('T')[0],
                        gapEnd: gapEnd.toISOString().split('T')[0],
                        gapDays: daysDiff - 1,
                        beforeStatement: current.filename,
                        afterStatement: next.filename,
                    });
                }

                // Check for overlaps (negative days difference)
                if (daysDiff < 0) {
                    overlaps.push({
                        accountId,
                        statement1: current.filename,
                        statement2: next.filename,
                        overlapStart: next.periodStartDate!,
                        overlapEnd: current.periodEndDate!,
                        overlapDays: Math.abs(daysDiff),
                    });
                }

                // Check for balance continuity
                if (current.closingBalance !== null && next.openingBalance !== null) {
                    if (current.closingBalance !== next.openingBalance) {
                        balanceMismatches.push({
                            accountId,
                            statement1: current.filename,
                            statement2: next.filename,
                            expectedBalance: current.closingBalance,
                            actualBalance: next.openingBalance,
                            difference: next.openingBalance - current.closingBalance,
                        });
                    }
                }
            }
        };

        // Analyze each account's statements
        for (const [accountId, stmtGroup] of accountStatements) {
            analyzeStatementGroup(stmtGroup, accountId);
        }

        // Analyze unlinked statements as a group
        if (unlinkedStatements.length > 0) {
            analyzeStatementGroup(unlinkedStatements, null);
        }

        // Calculate coverage summary
        const allDates = stmts
            .filter((s: any) => s.periodStartDate && s.periodEndDate)
            .flatMap((s: any) => [s.periodStartDate!, s.periodEndDate!])
            .sort();

        const coverage = {
            earliestDate: allDates[0] || null,
            latestDate: allDates[allDates.length - 1] || null,
            totalStatements: stmts.length,
            totalGaps: gaps.length,
            totalOverlaps: overlaps.length,
            totalBalanceMismatches: balanceMismatches.length,
            hasIssues: gaps.length > 0 || overlaps.length > 0 || balanceMismatches.length > 0,
        };

        return c.json({
            coverage,
            gaps,
            overlaps,
            balanceMismatches,
            statements: stmts.map((s: any) => ({
                ...s,
                accountId: stmtAccountMap.get(s.id) || null,
            })),
        });
    } catch (err) {
        console.error('Gap analysis error:', err);
        return c.json({ error: 'Failed to analyze statement gaps' }, 500);
    }
});

// ============ ACCOUNT MANAGEMENT ENDPOINTS ============

// Get all accounts for the current user (with optional ownershipTag filter)
app.get('/api/accounts', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const ownershipTag = c.req.query('ownershipTag'); // 'personal' | 'business' | undefined

    let userAccounts = await accountService.getUserAccounts(userId);

    if (ownershipTag) {
        userAccounts = userAccounts.filter((a: any) => a.ownershipTag === ownershipTag);
    }

    return c.json(userAccounts);
});

// Create a new account
app.post('/api/accounts', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();

    const { accountNumber, accountName, accountType, bankName, interestRate, creditLimit, minimumPayment, paymentDueDay } = body;

    if (!accountNumber || !accountName || !accountType) {
        return c.json({ error: 'accountNumber, accountName, and accountType are required' }, 400);
    }

    try {
        const result = await accountService.createAccount({
            userId,
            accountNumber,
            accountName,
            accountType,
            bankName,
            interestRate,
            creditLimit,
            minimumPayment,
            paymentDueDay,
        });

        events.emit('update', { type: 'accounts_updated' });

        return c.json(result, 201);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Update an account
app.patch('/api/accounts/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const accountId = c.req.param('id');
    const body = await c.req.json();

    // Verify ownership
    const existing = await db.select().from(accounts).where(and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId)
    )).get();

    if (!existing) {
        return c.json({ error: 'Account not found' }, 404);
    }

    await db.update(accounts)
        .set({
            accountName: body.accountName ?? existing.accountName,
            accountType: body.accountType ?? existing.accountType,
            bankName: body.bankName ?? existing.bankName,
            interestRate: body.interestRate ?? existing.interestRate,
            creditLimit: body.creditLimit ?? existing.creditLimit,
            minimumPayment: body.minimumPayment ?? existing.minimumPayment,
            paymentDueDay: body.paymentDueDay ?? existing.paymentDueDay,
            linkedPaymentAccountId: body.linkedPaymentAccountId ?? existing.linkedPaymentAccountId,
            ownershipTag: body.ownershipTag ?? existing.ownershipTag,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, accountId));

    events.emit('update', { type: 'accounts_updated' });

    return c.json({ success: true });
});

// Get pending categorizations for review
app.get('/api/pending-categorizations', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    const rows = await db.select()
        .from(pendingCategorization)
        .leftJoin(transactions, eq(pendingCategorization.transactionId, transactions.id))
        .where(and(
            eq(pendingCategorization.userId, userId),
            eq(pendingCategorization.status, 'pending')
        ))
        .all();

    const results = rows.map((row: any) => ({
        ...row.pending_categorization,
        transaction: row.transactions
    }));

    return c.json(results);
});

// Resolve a pending categorization
app.post('/api/pending-categorizations/:id/resolve', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const pendingId = c.req.param('id');
    const body = await c.req.json();

    const { action, category, gstApplicable } = body; // action: 'approve', 'reject', 'modify'

    const pending = await db.select()
        .from(pendingCategorization)
        .where(and(
            eq(pendingCategorization.id, pendingId),
            eq(pendingCategorization.userId, userId)
        ))
        .get();

    if (!pending) {
        return c.json({ error: 'Pending categorization not found' }, 404);
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
        // Use the suggested category
        await db.update(transactions)
            .set({
                category: pending.suggestedCategory,
                confidenceScore: 1.0 // User confirmed
            })
            .where(eq(transactions.id, pending.transactionId));
    } else if (action === 'modify' && category) {
        // Use the user's modified category
        await db.update(transactions)
            .set({
                category,
                gstApplicable: gstApplicable ?? false,
                confidenceScore: 1.0
            })
            .where(eq(transactions.id, pending.transactionId));

        // Update merchant memory with user's correction
        const tx = await db.select().from(transactions).where(eq(transactions.id, pending.transactionId)).get();
        if (tx?.merchantNormalized) {
            await accountService.updateMerchantMemory({
                userId,
                merchantPattern: tx.merchantNormalized,
                merchantDisplayName: tx.description,
                category,
                gstApplicable: gstApplicable ?? false,
                isUserConfirmed: true,
            });
        }
    }

    // Mark as resolved
    await db.update(pendingCategorization)
        .set({
            status: action,
            userSelectedCategory: action === 'modify' ? category : pending.suggestedCategory,
            resolvedAt: now,
        })
        .where(eq(pendingCategorization.id, pendingId));

    events.emit('update', { type: 'transactions_updated' });

    return c.json({ success: true });
});

// Get merchant memory (learned patterns)
app.get('/api/merchant-memory', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const memory = await accountService.getMerchantMemory(userId);
    return c.json(memory);
});

// Update merchant memory entry
app.patch('/api/merchant-memory/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const memoryId = c.req.param('id');
    const body = await c.req.json();

    const existing = await db.select()
        .from(merchantMemory)
        .where(and(
            eq(merchantMemory.id, memoryId),
            eq(merchantMemory.userId, userId)
        ))
        .get();

    if (!existing) {
        return c.json({ error: 'Merchant memory entry not found' }, 404);
    }

    await db.update(merchantMemory)
        .set({
            category: body.category ?? existing.category,
            gstApplicable: body.gstApplicable ?? existing.gstApplicable,
            merchantDisplayName: body.merchantDisplayName ?? existing.merchantDisplayName,
            isUserConfirmed: true,
        })
        .where(eq(merchantMemory.id, memoryId));

    events.emit('update', { type: 'merchant_memory_updated' });

    return c.json({ success: true });
});

// Delete merchant memory entry
app.delete('/api/merchant-memory/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const memoryId = c.req.param('id');

    const existing = await db.select()
        .from(merchantMemory)
        .where(and(
            eq(merchantMemory.id, memoryId),
            eq(merchantMemory.userId, userId)
        ))
        .get();

    if (!existing) {
        return c.json({ error: 'Merchant memory entry not found' }, 404);
    }

    await db.delete(merchantMemory).where(eq(merchantMemory.id, memoryId));

    events.emit('update', { type: 'merchant_memory_updated' });

    return c.json({ success: true });
});

// Get transfer links
app.get('/api/transfers', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    const sourceTx = aliasedTable(transactions, 'source_tx');
    const destTx = aliasedTable(transactions, 'dest_tx');

    const rows = await db.select()
        .from(transferLinks)
        .leftJoin(sourceTx, eq(transferLinks.sourceTransactionId, sourceTx.id))
        .leftJoin(destTx, eq(transferLinks.destinationTransactionId, destTx.id))
        .where(eq(transferLinks.userId, userId))
        .all();

    const results = rows.map((row: any) => {
        const r = row as any;
        return {
            ...r.transfer_links,
            sourceTransaction: r.source_tx,
            destinationTransaction: r.dest_tx,
        };
    });

    return c.json(results);
});

// Manually link two transactions as a transfer
app.post('/api/transfers', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();

    const { sourceTransactionId, destinationTransactionId } = body;

    // Verify both transactions exist and belong to user
    const sourceTx = await db.select().from(transactions)
        .where(and(eq(transactions.id, sourceTransactionId), eq(transactions.userId, userId))).get();
    const destTx = await db.select().from(transactions)
        .where(and(eq(transactions.id, destinationTransactionId), eq(transactions.userId, userId))).get();

    if (!sourceTx || !destTx) {
        return c.json({ error: 'One or both transactions not found' }, 404);
    }

    const linkId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(transferLinks).values({
        id: linkId,
        userId,
        sourceTransactionId,
        destinationTransactionId,
        sourceAccountId: sourceTx.accountId,
        destinationAccountId: destTx.accountId,
        amount: Math.abs(sourceTx.amount),
        transferDate: sourceTx.date,
        confidence: 1.0,
        isUserConfirmed: true,
        createdAt: now,
    });

    // Mark both transactions as transfers
    await db.update(transactions)
        .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
        .where(eq(transactions.id, sourceTransactionId));
    await db.update(transactions)
        .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
        .where(eq(transactions.id, destinationTransactionId));

    events.emit('update', { type: 'transactions_updated' });

    return c.json({ id: linkId, success: true });
});

// Delete a transfer link
app.delete('/api/transfers/:id', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const linkId = c.req.param('id');

    const link = await db.select()
        .from(transferLinks)
        .where(and(eq(transferLinks.id, linkId), eq(transferLinks.userId, userId)))
        .get();

    if (!link) {
        return c.json({ error: 'Transfer link not found' }, 404);
    }

    // Unmark transactions as transfers
    await db.update(transactions)
        .set({ isTransfer: false, transferLinkId: null })
        .where(eq(transactions.id, link.sourceTransactionId));
    await db.update(transactions)
        .set({ isTransfer: false, transferLinkId: null })
        .where(eq(transactions.id, link.destinationTransactionId));

    await db.delete(transferLinks).where(eq(transferLinks.id, linkId));

    events.emit('update', { type: 'transactions_updated' });

    return c.json({ success: true });
});

// Get account balance history
app.get('/api/accounts/:id/balance-history', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const accountId = c.req.param('id');

    // Verify account belongs to user
    const account = await db.select().from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).get();
    if (!account) {
        return c.json({ error: 'Account not found' }, 404);
    }

    const history = await db.select()
        .from(accountBalanceHistory)
        .where(eq(accountBalanceHistory.accountId, accountId))
        .orderBy(desc(accountBalanceHistory.balanceDate))
        .all();

    return c.json(history);
});

// Get reconciliation alerts
app.get('/api/reconciliation-alerts', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const showResolved = c.req.query('showResolved') === 'true';

    const alerts = await db.select()
        .from(reconciliationAlerts)
        .where(and(
            eq(reconciliationAlerts.userId, userId),
            showResolved ? undefined : eq(reconciliationAlerts.isResolved, false)
        ))
        .orderBy(desc(reconciliationAlerts.createdAt))
        .all();

    return c.json(alerts);
});

// Resolve a reconciliation alert
app.post('/api/reconciliation-alerts/:id/resolve', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const alertId = c.req.param('id');
    const body = await c.req.json();

    const alert = await db.select()
        .from(reconciliationAlerts)
        .where(and(eq(reconciliationAlerts.id, alertId), eq(reconciliationAlerts.userId, userId)))
        .get();

    if (!alert) {
        return c.json({ error: 'Alert not found' }, 404);
    }

    await db.update(reconciliationAlerts)
        .set({
            isResolved: true,
            resolvedAt: new Date().toISOString(),
            resolutionNotes: body.notes || null,
        })
        .where(eq(reconciliationAlerts.id, alertId));

    return c.json({ success: true });
});

// Get credit card analytics
app.get('/api/accounts/:id/credit-analytics', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const accountId = c.req.param('id');

    // Verify account belongs to user and is a credit card
    const account = await db.select().from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).get();
    if (!account) {
        return c.json({ error: 'Account not found' }, 404);
    }
    if (account.accountType !== 'credit_card') {
        return c.json({ error: 'Account is not a credit card' }, 400);
    }

    // Get all transactions for this account
    const txs = await db.select().from(transactions)
        .where(and(eq(transactions.accountId, accountId), eq(transactions.userId, userId)))
        .orderBy(desc(transactions.date))
        .all();

    // Calculate interest and fees
    const interestTransactions = txs.filter((t: any) =>
        t.category === 'Interest & Fees' ||
        t.description.toLowerCase().includes('interest') ||
        t.description.toLowerCase().includes('fee')
    );
    const totalInterestPaid = interestTransactions.reduce((sum: any, t: any) => sum + Math.abs(t.amount), 0);

    // Find payment transactions (credits to the card)
    const payments = txs.filter((t: any) => t.amount > 0 && !t.isTransfer);
    const totalPayments = payments.reduce((sum: any, t: any) => sum + t.amount, 0);

    // Calculate average monthly spending
    const purchases = txs.filter((t: any) => t.amount < 0 && !t.isTransfer);
    const totalSpending = purchases.reduce((sum: any, t: any) => sum + Math.abs(t.amount), 0);

    // Get unique months
    const months = new Set(txs.map((t: any) => t.date.substring(0, 7)));
    const avgMonthlySpending = months.size > 0 ? totalSpending / months.size : 0;

    // Calculate utilization if credit limit is set
    const utilization = account.creditLimit && account.currentBalance
        ? Math.abs(account.currentBalance) / account.creditLimit * 100
        : null;

    return c.json({
        accountId,
        accountName: account.accountName,
        creditLimit: account.creditLimit,
        currentBalance: account.currentBalance,
        interestRate: account.interestRate,
        minimumPayment: account.minimumPayment,
        totalInterestPaid,
        totalPayments,
        totalSpending,
        avgMonthlySpending: Math.round(avgMonthlySpending),
        utilization: utilization ? Math.round(utilization * 10) / 10 : null,
        transactionCount: txs.length,
        interestTransactionCount: interestTransactions.length,
        recentInterestCharges: interestTransactions.slice(0, 5).map((t: any) => ({
            date: t.date,
            amount: t.amount,
            description: t.description
        }))
    });
});

// Get debt reduction recommendations
app.post('/api/debt-recommendations', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const body = await c.req.json();
    const { monthlyBudget } = body;

    if (!monthlyBudget || monthlyBudget <= 0) {
        return c.json({ error: 'Monthly budget is required and must be positive' }, 400);
    }

    // Get all accounts with debt (credit cards and loans)
    const debtAccounts = await db.select().from(accounts)
        .where(and(
            eq(accounts.userId, userId),
            eq(accounts.isActive, true)
        ))
        .all();

    // Filter to only accounts with debt (negative balance or credit cards/loans)
    const accountsWithDebt = debtAccounts.filter((a: any) =>
        (a.accountType === 'credit_card' || a.accountType === 'loan') &&
        a.currentBalance !== null && a.currentBalance < 0
    );

    if (accountsWithDebt.length === 0) {
        return c.json({
            message: 'No debt accounts found',
            aggressive: null,
            moderate: null,
            minimum: null
        });
    }

    // Create a map of account IDs to account info for easy lookup
    const accountMap = new Map(accountsWithDebt.map((a: any) => [a.id, a]));

    // Prepare accounts for AI analysis
    const accountsForAnalysis = accountsWithDebt.map((a: any) => ({
        id: a.id,
        name: a.accountName,
        type: a.accountType,
        balance: Math.abs(a.currentBalance || 0),
        interestRate: a.interestRate || 0,
        minimumPayment: a.minimumPayment || 0
    }));

    try {
        const aiResult = await aiService.analyzeDebtPayoff(
            accountsForAnalysis,
            monthlyBudget * 100 // Convert to cents
        );

        // Transform AI response to client-expected format
        const transformStrategy = (
            strategy: typeof aiResult.aggressive,
            name: string,
            description: string
        ) => {
            if (!strategy) return null;

            // Calculate total monthly payment from all accounts
            const totalMonthlyPayment = strategy.monthlyPayments.reduce(
                (sum, p) => sum + (p.payment_cents || 0), 0
            );

            // Build payoff order from monthly payments
            const payoffOrder = strategy.monthlyPayments.map(p => {
                const account = accountMap.get(p.account_id) as any;
                return {
                    accountId: p.account_id,
                    accountName: account?.accountName || 'Unknown Account',
                    monthsToPayoff: strategy.totalMonths, // Simplified - AI could provide per-account
                    interestPaid: 0 // Would need per-account interest from AI
                };
            });

            // Build projections from monthly breakdown
            const projections = (strategy.monthlyBreakdown || []).slice(0, 24).map(m => {
                // Sum all balances for total debt
                const totalDebt = Object.values(m.balances || {}).reduce(
                    (sum: number, bal) => sum + (typeof bal === 'number' ? bal : 0), 0
                );
                return {
                    month: m.month,
                    totalDebt,
                    interestPaid: m.interest_paid || 0
                };
            });

            return {
                name,
                description,
                totalMonths: strategy.totalMonths,
                totalInterestPaid: strategy.totalInterestCents,
                monthlyPayment: totalMonthlyPayment,
                payoffOrder,
                projections
            };
        };

        const result = {
            aggressive: transformStrategy(
                aiResult.aggressive,
                'Aggressive',
                'Maximum debt payoff - avalanche method'
            ),
            moderate: transformStrategy(
                aiResult.moderate,
                'Moderate',
                'Balanced approach with savings buffer'
            ),
            minimum: transformStrategy(
                aiResult.minimum,
                'Minimum',
                'Minimum payments only'
            )
        };

        return c.json(result);
    } catch (err) {
        console.error('Failed to analyze debt:', err);
        return c.json({ error: 'Failed to analyze debt' }, 500);
    }
});

// ============ AI AGENT ENDPOINTS ============

// Get available agents info
app.get('/api/agents', async (c) => {
    try {
        const info = await agentService.getAgentInfo();
        return c.json(info);
    } catch (err) {
        console.error('Failed to get agent info:', err);
        return c.json({ error: 'Failed to get agent info' }, 500);
    }
});

// Get specific agent info
app.get('/api/agents/:type', async (c) => {
    try {
        const agentType = c.req.param('type') as PythonAgentType;
        const info = await agentService.getAgentInfo(agentType);
        return c.json(info);
    } catch (err) {
        console.error('Failed to get agent info:', err);
        return c.json({ error: 'Failed to get agent info' }, 500);
    }
});

// Run an agent with a query
app.post('/api/agents/:type/run', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const agentType = c.req.param('type') as PythonAgentType;
        const body = await c.req.json();
        const { query } = body;

        if (!query) {
            return c.json({ error: 'Query is required' }, 400);
        }

        // Get user's transactions and accounts for context
        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date));

        const userAccounts = await db.select().from(accounts)
            .where(eq(accounts.userId, userId));

        const userStatements = await db.select().from(statements)
            .where(eq(statements.userId, userId));

        const result = await agentService.runAgent(agentType, query, {
            transactions: userTransactions,
            accounts: userAccounts,
            statements: userStatements,
        });

        return c.json(result);
    } catch (err) {
        console.error('Agent execution failed:', err);
        return c.json({ error: 'Agent execution failed', details: String(err) }, 500);
    }
});

// Execute Python code in sandbox
app.post('/api/agents/code/execute', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { code, context } = body;

        if (!code) {
            return c.json({ error: 'Code is required' }, 400);
        }

        // Optionally include user's transaction data in context
        const codeContext = context || {};
        if (body.includeTransactions) {
            const userTransactions = await db.select().from(transactions)
                .where(eq(transactions.userId, userId));
            codeContext.transactions = userTransactions;
        }

        const result = await agentService.executeCode(code, codeContext);
        return c.json(result);
    } catch (err) {
        console.error('Code execution failed:', err);
        return c.json({ error: 'Code execution failed', details: String(err) }, 500);
    }
});

// Financial analysis endpoint
app.post('/api/agents/analyze-finances', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { query } = body;

        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date));

        const userAccounts = await db.select().from(accounts)
            .where(eq(accounts.userId, userId));

        const result = await agentService.analyzeFinances(
            query || 'Analyze my spending patterns and provide insights',
            { transactions: userTransactions, accounts: userAccounts }
        );

        return c.json(result);
    } catch (err) {
        console.error('Financial analysis failed:', err);
        return c.json({ error: 'Financial analysis failed' }, 500);
    }
});

// BAS calculation endpoint
app.post('/api/agents/calculate-bas', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { query, quarter } = body;

        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date));

        const result = await agentService.calculateBAS(
            query || `Calculate BAS for ${quarter || 'the current period'}`,
            { transactions: userTransactions }
        );

        return c.json(result);
    } catch (err) {
        console.error('BAS calculation failed:', err);
        return c.json({ error: 'BAS calculation failed' }, 500);
    }
});

// Tax calculation endpoint
app.post('/api/agents/calculate-tax', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { query, grossIncome, taxWithheld } = body;

        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date));

        const result = await agentService.calculateTax(
            query || `Calculate my tax liability. Gross income: $${grossIncome || 'unknown'}, Tax withheld: $${taxWithheld || 'unknown'}`,
            { transactions: userTransactions }
        );

        return c.json(result);
    } catch (err) {
        console.error('Tax calculation failed:', err);
        return c.json({ error: 'Tax calculation failed' }, 500);
    }
});

// Reconciliation endpoint
app.post('/api/agents/reconcile', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { query } = body;

        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date));

        const userStatements = await db.select().from(statements)
            .where(eq(statements.userId, userId));

        const result = await agentService.reconcileTransactions(
            query || 'Find duplicate transactions and verify statement balances',
            { transactions: userTransactions, statements: userStatements }
        );

        return c.json(result);
    } catch (err) {
        console.error('Reconciliation failed:', err);
        return c.json({ error: 'Reconciliation failed' }, 500);
    }
});

// ============ BAS ENDPOINTS ============

import { BASService } from './services/bas.js';
import { TaxService } from './services/tax.js';
import { parserRegistry, detectBank, getSupportedBanks, analyzeStatement } from './services/parsers/index.js';
import { TransferDetector, detectTransfers, excludeTransfers, persistTransferMatches, markOwnerContributions } from './services/transfers/index.js';
import {
  basPeriods, basCalculations, taxCodes, taxBrackets, deductions,
  cgtAssets, cgtEvents, depreciableAssets, depreciationSchedule, taxYearSummary
} from './schema.js';

const basService = new BASService();
const taxService = new TaxService();

// Get available BAS quarters
app.get('/api/bas/quarters', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const quarters = await basService.getAvailableQuarters(userId);
        return c.json(quarters);
    } catch (err) {
        console.error('Failed to get quarters:', err);
        return c.json({ error: 'Failed to get quarters' }, 500);
    }
});

// Get BAS calculation for a quarter
app.get('/api/bas/:quarter/calculate', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const quarter = c.req.param('quarter');
        const method = c.req.query('method') || 'accrual';

        // Parse quarter (format: YYYY-Q1, YYYY-Q2, etc.)
        const [year, q] = quarter.split('-Q');
        const quarterNum = parseInt(q);

        if (!year || isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
            return c.json({ error: 'Invalid quarter format. Use YYYY-Q1, YYYY-Q2, etc.' }, 400);
        }

        // Convert year to financial year format (e.g., 2024-25)
        const fyStartYear = parseInt(year);
        const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;

        const result = await basService.calculateBAS(
            userId,
            financialYear,
            quarterNum,
            method
        );

        // Map server BASResult to client BASCalculation format
        const g5 = result.labels.G2 + result.labels.G3;
        const g6 = result.labels.G1 - g5;
        const g9 = result.labels['1A'];
        const g12 = result.labels.G10 + result.labels.G11;
        const g19 = result.labels['1B'];
        const g20 = g9 - g19;
        const netPayable = result.totalPayable;

        const mapped = {
            periodId: `${financialYear}-Q${quarterNum}`,
            g1_total_sales: result.labels.G1,
            g2_export_sales: result.labels.G2,
            g3_gst_free_sales: result.labels.G3,
            g4_input_taxed_sales: 0,
            g5_g2_to_g4: g5,
            g6_total_taxable_sales: g6,
            g7_adjustments: 0,
            g8_total_sales_subject_gst: g6,
            g9_gst_on_sales: g9,
            g10_capital_purchases: result.labels.G10,
            g11_non_capital_purchases: result.labels.G11,
            g12_g10_plus_g11: g12,
            g13_purchases_no_gst_credit: 0,
            g14_estimated_purchases: 0,
            g15_total_purchases: g12,
            g16_g12_minus_g15: g12,
            g17_adjustments: 0,
            g18_total_purchases_credit: g12,
            g19_gst_credits: g19,
            g20_net_gst: g20,
            w1_gross_wages: result.labels.W1,
            w2_amounts_withheld: result.labels.W2,
            payg_instalment_5a: result.labels['5A'],
            fuel_tax_credits_7c: result.labels['7C'],
            wine_equalisation_7d: result.labels['7D'],
            net_amount_payable: netPayable > 0 ? netPayable : 0,
            net_refund: netPayable < 0 ? Math.abs(netPayable) : 0,
            // Include raw data for pipeline use
            _raw: result,
        };

        return c.json(mapped);
    } catch (err) {
        console.error('BAS calculation failed:', err);
        return c.json({ error: 'BAS calculation failed' }, 500);
    }
});

// Save BAS calculation
app.post('/api/bas/:quarter/save', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const quarter = c.req.param('quarter');
        const body = await c.req.json();

        // Parse quarter
        const [year, q] = quarter.split('-Q');
        const quarterNum = parseInt(q);

        // Convert year to financial year format
        const fyStartYear = parseInt(year);
        const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;

        // Save calculation
        const result = await basService.saveBASCalculation(userId, financialYear, quarterNum, body);

        events.emit('update', { type: 'bas_updated' });

        return c.json(result);
    } catch (err) {
        console.error('Failed to save BAS:', err);
        return c.json({ error: 'Failed to save BAS' }, 500);
    }
});

// Get BAS history
app.get('/api/bas/history', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const periods = await basService.getUserPeriods(userId);
        return c.json(periods);
    } catch (err) {
        console.error('Failed to get BAS history:', err);
        return c.json({ error: 'Failed to get BAS history' }, 500);
    }
});

// Get tax codes
app.get('/api/bas/tax-codes', async (c) => {
    try {
        const codes = await db.select().from(taxCodes).all();
        return c.json(codes);
    } catch (err) {
        console.error('Failed to get tax codes:', err);
        return c.json({ error: 'Failed to get tax codes' }, 500);
    }
});

// Batch update GST categories
app.post('/api/transactions/categorize-gst', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { updates } = body; // Array of { transactionId, gstCategory, gstAmount }

        if (!Array.isArray(updates)) {
            return c.json({ error: 'Updates must be an array' }, 400);
        }

        for (const update of updates) {
            // Verify ownership
            const tx = await db.select().from(transactions)
                .where(and(eq(transactions.id, update.transactionId), eq(transactions.userId, userId)))
                .get();

            if (tx) {
                await db.update(transactions)
                    .set({
                        gstCategory: update.gstCategory,
                        gstAmount: update.gstAmount,
                    })
                    .where(eq(transactions.id, update.transactionId));
            }
        }

        events.emit('update', { type: 'transactions_updated' });

        return c.json({ success: true, updated: updates.length });
    } catch (err) {
        console.error('GST categorization failed:', err);
        return c.json({ error: 'GST categorization failed' }, 500);
    }
});

// ============ GST ENDPOINTS (for GSTPage: Overview, Review Queue, Input Credits) ============

// Helper: resolve period string to quarter dates
function resolvePeriod(period: string): { financialYear: string; quarter: number } {
    if (period === 'current') {
        return basService.constructor.prototype.constructor ?
            (() => {
                const today = new Date();
                const month = today.getMonth() + 1;
                const year = today.getFullYear();
                const fy = month >= 7 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`;
                let q: number;
                if (month >= 7 && month <= 9) q = 1;
                else if (month >= 10 && month <= 12) q = 2;
                else if (month >= 1 && month <= 3) q = 3;
                else q = 4;
                return { financialYear: fy, quarter: q };
            })() : { financialYear: '2024-25', quarter: 1 };
    }
    // Format: YYYY-QN (e.g., 2024-Q1)
    const [year, q] = period.split('-Q');
    const quarterNum = parseInt(q);
    const fyStartYear = parseInt(year);
    const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
    return { financialYear, quarter: quarterNum };
}

// GST Summary endpoint (Overview tab)
app.get('/api/gst/summary', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const period = c.req.query('period') || 'current';

        const { financialYear, quarter } = resolvePeriod(period);
        const result = await basService.calculateBAS(userId, financialYear, quarter);

        // Calculate breakdown by GST category
        const dates = (await import('./services/bas.js')).getQuarterDates(financialYear, quarter);
        const quarterTxns = await db.select().from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                gte(transactions.date, dates.startDate),
                lte(transactions.date, dates.endDate),
                eq(transactions.isTransfer, false)
            )).all();

        let taxableSales = 0, taxablePurchases = 0;
        let gstFreeSales = 0, gstFreePurchases = 0;
        let inputTaxed = 0, capital = 0, privateTx = 0;
        let classifiedCount = 0, needReviewCount = 0;

        for (const tx of quarterTxns) {
            const cat = tx.gstCategory || 'taxable_10';
            const amt = Math.abs(tx.amount);

            if (!tx.gstCategory) {
                needReviewCount++;
            } else {
                classifiedCount++;
            }

            if (tx.amount > 0) {
                // Sales
                if (cat === 'gst_free') gstFreeSales += amt;
                else if (cat === 'input_taxed') inputTaxed += amt;
                else if (cat === 'private') privateTx += amt;
                else taxableSales += amt;
            } else {
                // Purchases
                if (cat === 'gst_free') gstFreePurchases += amt;
                else if (cat === 'capital') capital += amt;
                else if (cat === 'private') privateTx += amt;
                else if (cat === 'input_taxed') inputTaxed += amt;
                else taxablePurchases += amt;
            }
        }

        // Try to get previous period's net GST
        let previousPeriodNetGST: number | undefined;
        try {
            const prevQ = quarter > 1 ? quarter - 1 : 4;
            const prevFY = quarter > 1 ? financialYear : (() => {
                const y = parseInt(financialYear.split('-')[0]) - 1;
                return `${y}-${(y + 1).toString().slice(2)}`;
            })();
            const prevResult = await basService.calculateBAS(userId, prevFY, prevQ);
            previousPeriodNetGST = prevResult.netGst;
        } catch { /* no previous data */ }

        const summary = {
            gstCollected: result.labels['1A'],
            gstCredits: result.labels['1B'],
            netGST: result.netGst,
            breakdown: {
                taxable: { sales: taxableSales, purchases: taxablePurchases },
                gstFree: { sales: gstFreeSales, purchases: gstFreePurchases },
                inputTaxed,
                capital,
                private: privateTx,
            },
            transactionsClassified: classifiedCount,
            transactionsNeedReview: needReviewCount,
            previousPeriodNetGST,
        };

        return c.json(summary);
    } catch (err) {
        console.error('Failed to fetch GST summary:', err);
        return c.json({
            gstCollected: 0, gstCredits: 0, netGST: 0,
            breakdown: { taxable: { sales: 0, purchases: 0 }, gstFree: { sales: 0, purchases: 0 }, inputTaxed: 0, capital: 0, private: 0 },
            transactionsClassified: 0, transactionsNeedReview: 0,
        });
    }
});

// GST Review Queue endpoint
app.get('/api/gst/review-queue', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        // Find transactions without GST classification or with low confidence
        const reviewItems = await db.select().from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.isTransfer, false),
                sql`(${transactions.gstCategory} IS NULL OR ${transactions.gstCategory} = '')`
            ))
            .limit(50)
            .all();

        const items = reviewItems.map((tx: any) => {
            const absAmount = Math.abs(tx.amount);
            // Auto-suggest category based on amount direction and category
            let suggestedCategory = 'taxable_10';
            let confidence = 0.3;

            const cat = (tx.category || '').toLowerCase();
            if (cat.includes('medical') || cat.includes('health') || cat.includes('education')) {
                suggestedCategory = 'gst_free';
                confidence = 0.7;
            } else if (cat.includes('investment') || cat.includes('interest') || cat.includes('dividend')) {
                suggestedCategory = 'input_taxed';
                confidence = 0.6;
            } else if (cat.includes('personal') || cat.includes('entertainment')) {
                suggestedCategory = 'private';
                confidence = 0.5;
            } else if (tx.amount < 0 && absAmount > 100000) { // >$1000 expense
                suggestedCategory = 'capital';
                confidence = 0.4;
            } else if (tx.amount > 0) {
                suggestedCategory = 'taxable_10';
                confidence = 0.6;
            } else {
                suggestedCategory = 'taxable_10';
                confidence = 0.5;
            }

            const suggestedGstAmount = suggestedCategory === 'taxable_10'
                ? Math.round(absAmount / 11)  // GST = amount / 11 for inclusive
                : 0;

            return {
                id: typeof tx.id === 'string' ? parseInt(tx.id) || 0 : tx.id,
                date: tx.date,
                description: tx.description,
                amount: tx.amount,
                suggestedCategory,
                suggestedGstAmount,
                confidence,
                currentCategory: tx.category || 'Uncategorized',
            };
        });

        return c.json(items);
    } catch (err) {
        console.error('Failed to fetch GST review queue:', err);
        return c.json([]);
    }
});

// GST Classify (approve/change classification)
app.post('/api/gst/classify/:id', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const id = c.req.param('id');
        const { gstCategory } = await c.req.json();

        // Calculate GST amount based on category
        const tx = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
            .get();

        if (!tx) return c.json({ error: 'Transaction not found' }, 404);

        const gstAmount = gstCategory === 'taxable_10'
            ? Math.round(Math.abs(tx.amount) / 11)
            : 0;

        await db.update(transactions)
            .set({ gstCategory, gstAmount, isEdited: true })
            .where(eq(transactions.id, id));

        return c.json({ success: true });
    } catch (err) {
        console.error('GST classify failed:', err);
        return c.json({ error: 'Failed to classify GST' }, 500);
    }
});

// GST Bulk Approve
app.post('/api/gst/bulk-approve', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const { ids } = await c.req.json();

        if (!Array.isArray(ids)) return c.json({ error: 'ids must be an array' }, 400);

        for (const id of ids) {
            const tx = await db.select().from(transactions)
                .where(and(eq(transactions.id, String(id)), eq(transactions.userId, userId)))
                .get();

            if (tx) {
                const gstCategory = 'taxable_10'; // Default approval
                const gstAmount = Math.round(Math.abs(tx.amount) / 11);
                await db.update(transactions)
                    .set({ gstCategory, gstAmount, isEdited: true })
                    .where(eq(transactions.id, String(id)));
            }
        }

        events.emit('update', { type: 'transactions_updated' });
        return c.json({ success: true, updated: ids.length });
    } catch (err) {
        console.error('GST bulk approve failed:', err);
        return c.json({ error: 'Failed to bulk approve' }, 500);
    }
});

// GST Input Tax Credits
app.get('/api/gst/input-tax-credits', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const period = c.req.query('period') || 'current';

        const { financialYear, quarter } = resolvePeriod(period);
        const dates = (await import('./services/bas.js')).getQuarterDates(financialYear, quarter);

        // Get expense transactions with GST credits for the period
        const txns = await db.select().from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                gte(transactions.date, dates.startDate),
                lte(transactions.date, dates.endDate),
                eq(transactions.isTransfer, false),
                sql`${transactions.amount} < 0`  // Expenses only
            )).all();

        // Group by category
        const creditsByCategory: Record<string, { gstCredits: number; transactionCount: number }> = {};

        for (const tx of txns) {
            const cat = tx.gstCategory || 'taxable_10';
            if (cat === 'private' || cat === 'input_taxed') continue; // No credits for these

            const category = tx.category || 'Uncategorized';
            const gstAmount = tx.gstAmount || (cat === 'taxable_10' ? Math.round(Math.abs(tx.amount) / 11) : 0);

            if (gstAmount > 0) {
                if (!creditsByCategory[category]) {
                    creditsByCategory[category] = { gstCredits: 0, transactionCount: 0 };
                }
                creditsByCategory[category].gstCredits += gstAmount;
                creditsByCategory[category].transactionCount++;
            }
        }

        const credits = Object.entries(creditsByCategory).map(([category, data]) => ({
            category,
            gstCredits: data.gstCredits,
            hasInvoice: data.gstCredits <= 8250, // Auto-true for amounts ≤$82.50
            transactionCount: data.transactionCount,
        }));

        return c.json(credits);
    } catch (err) {
        console.error('Failed to fetch input tax credits:', err);
        return c.json([]);
    }
});

// ============ BAS ENHANCED ENDPOINTS (for BASPage: Pre-Fill Report, Compare) ============

// BAS Calculate (query param format for gstApi — returns BASCalculationEnhanced format)
app.get('/api/bas/calculate', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const quarter = c.req.query('quarter') || 'current';
        const method = c.req.query('method') || 'full';

        const { financialYear, quarter: quarterNum } = resolvePeriod(quarter);
        const result = await basService.calculateBAS(userId, financialYear, quarterNum, method === 'cash' ? 'cash' : 'accrual');
        const dates = (await import('./services/bas.js')).getQuarterDates(financialYear, quarterNum);

        // Check for existing saved status
        const saved = await basService.getSavedBASCalculation(userId, financialYear, quarterNum);
        const status = saved?.period?.status || 'draft';

        // Generate warnings
        const warnings: string[] = [];
        if (result.transactionCount === 0) {
            warnings.push('No transactions found for this period');
        }
        if (result.labels['1B'] > result.labels['1A'] * 2) {
            warnings.push('GST credits are unusually high relative to GST collected — review for accuracy');
        }
        if (result.labels.G1 === 0 && result.labels.G10 + result.labels.G11 > 0) {
            warnings.push('No sales recorded but purchases exist — check if all income is captured');
        }

        const enhanced = {
            quarter: { year: parseInt(financialYear.split('-')[0]), quarter: quarterNum },
            method: method === 'simpler' ? 'simpler' : 'full',
            labels: {
                G1: result.labels.G1,
                G2: result.labels.G2,
                G3: result.labels.G3,
                G4: 0,
                G5: result.labels.G2 + result.labels.G3,
                G6: result.labels.G1 - (result.labels.G2 + result.labels.G3),
                G7: 0,
                G8: result.labels.G1 - (result.labels.G2 + result.labels.G3),
                G9: result.labels['1A'],
                G10: result.labels.G10,
                G11: result.labels.G11,
                G12: result.labels.G10 + result.labels.G11,
                '1A': result.labels['1A'],
                '1B': result.labels['1B'],
                W1: result.labels.W1,
                W2: result.labels.W2,
                '5A': result.labels['5A'],
                '7C': result.labels['7C'],
                '7D': result.labels['7D'],
            },
            netGST: result.netGst,
            totalPayable: result.totalPayable,
            status,
            dueDate: dates.lodgementDue,
            warnings,
            transactionCounts: {
                total: result.transactionCount,
            },
        };

        return c.json(enhanced);
    } catch (err) {
        console.error('BAS enhanced calculation failed:', err);
        return c.json({ error: 'BAS calculation failed' }, 500);
    }
});

// BAS Status Update
app.patch('/api/bas/:quarter/status', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const quarter = c.req.param('quarter');
        const { status } = await c.req.json();

        const [year, q] = quarter.split('-Q');
        const quarterNum = parseInt(q);
        const fyStartYear = parseInt(year);
        const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;

        // Get or create the period
        const period = await basService.getOrCreatePeriod(userId, financialYear, quarterNum);

        await basService.updatePeriodStatus(
            period.id,
            status,
            status === 'lodged' ? new Date().toISOString() : undefined
        );

        return c.json({ success: true });
    } catch (err) {
        console.error('Failed to update BAS status:', err);
        return c.json({ error: 'Failed to update BAS status' }, 500);
    }
});

// BAS Comparison
app.get('/api/bas/compare', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const q1 = c.req.query('q1') || '';
        const q2 = c.req.query('q2') || '';

        if (!q1 || !q2) return c.json({ error: 'Both q1 and q2 are required' }, 400);

        const period1 = resolvePeriod(q1);
        const period2 = resolvePeriod(q2);

        const [result1, result2] = await Promise.all([
            basService.calculateBAS(userId, period1.financialYear, period1.quarter),
            basService.calculateBAS(userId, period2.financialYear, period2.quarter),
        ]);

        const comparison = {
            periodA: {
                quarter: q1,
                labels: {
                    G1: result1.labels.G1,
                    G2: result1.labels.G2,
                    G3: result1.labels.G3,
                    G10: result1.labels.G10,
                    G11: result1.labels.G11,
                    '1A': result1.labels['1A'],
                    '1B': result1.labels['1B'],
                    W1: result1.labels.W1,
                    W2: result1.labels.W2,
                    netGST: result1.netGst,
                    totalPayable: result1.totalPayable,
                },
            },
            periodB: {
                quarter: q2,
                labels: {
                    G1: result2.labels.G1,
                    G2: result2.labels.G2,
                    G3: result2.labels.G3,
                    G10: result2.labels.G10,
                    G11: result2.labels.G11,
                    '1A': result2.labels['1A'],
                    '1B': result2.labels['1B'],
                    W1: result2.labels.W1,
                    W2: result2.labels.W2,
                    netGST: result2.netGst,
                    totalPayable: result2.totalPayable,
                },
            },
        };

        return c.json(comparison);
    } catch (err) {
        console.error('BAS comparison failed:', err);
        return c.json({ error: 'BAS comparison failed' }, 500);
    }
});

// BAS Drill-Down (transactions for a specific BAS label)
app.get('/api/bas/:quarter/drill-down/:label', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const quarter = c.req.param('quarter');
        const label = c.req.param('label');

        const [year, q] = quarter.split('-Q');
        const quarterNum = parseInt(q);
        const fyStartYear = parseInt(year);
        const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
        const dates = (await import('./services/bas.js')).getQuarterDates(financialYear, quarterNum);

        // Get transactions for the quarter
        const txns = await db.select().from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                gte(transactions.date, dates.startDate),
                lte(transactions.date, dates.endDate),
                eq(transactions.isTransfer, false)
            )).all();

        // Filter by BAS label
        const filtered = txns.filter((tx: any) => {
            const cat = tx.gstCategory || 'taxable_10';
            switch (label) {
                case 'G1': return tx.amount > 0 && cat === 'taxable_10';
                case 'G2': return tx.amount > 0 && cat === 'export';
                case 'G3': return tx.amount > 0 && cat === 'gst_free';
                case 'G10': return tx.amount < 0 && cat === 'capital';
                case 'G11': return tx.amount < 0 && cat === 'taxable_10';
                case '1A': return tx.amount > 0 && cat === 'taxable_10';
                case '1B': return tx.amount < 0 && (cat === 'taxable_10' || cat === 'capital');
                default: return false;
            }
        });

        return c.json(filtered.map((tx: any) => ({
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            gstCategory: tx.gstCategory,
            gstAmount: tx.gstAmount,
            category: tx.category,
        })));
    } catch (err) {
        console.error('BAS drill-down failed:', err);
        return c.json([]);
    }
});

// ============ TAX ENDPOINTS ============

// Get tax calculation for a year
app.get('/api/tax/calculate/:year', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const taxYear = c.req.param('year');
        const body = c.req.query();

        const grossIncome = parseInt(body.grossIncome || '0');
        const totalDeductions = parseInt(body.totalDeductions || '0');
        const hasPrivateHealth = body.hasPrivateHealth === 'true';
        const applyLITO = body.applyLITO !== 'false';

        const result = taxService.calculateFullTax(grossIncome / 100, totalDeductions / 100, hasPrivateHealth, applyLITO);

        // Map to client's expected snake_case TaxCalculationResult format (values in cents)
        const taxableIncome = result.taxableIncome;
        const brackets = [];
        for (const bracket of [
            { min: 0, max: 18200, rate: 0 },
            { min: 18201, max: 45000, rate: 0.16 },
            { min: 45001, max: 135000, rate: 0.30 },
            { min: 135001, max: 190000, rate: 0.37 },
            { min: 190001, max: Infinity, rate: 0.45 },
        ]) {
            if (taxableIncome > bracket.min) {
                const incomeInBracket = Math.min(taxableIncome, bracket.max) - bracket.min + 1;
                const taxForBracket = incomeInBracket * bracket.rate;
                brackets.push({
                    bracket: bracket.max === Infinity ? `$${bracket.min.toLocaleString()}+` : `$${bracket.min.toLocaleString()} - $${bracket.max.toLocaleString()}`,
                    income_in_bracket: Math.round(incomeInBracket * 100),
                    tax_for_bracket: Math.round(taxForBracket * 100),
                });
            }
        }

        // Determine marginal rate
        let marginalRate = 0;
        if (taxableIncome > 190000) marginalRate = 0.45;
        else if (taxableIncome > 135000) marginalRate = 0.37;
        else if (taxableIncome > 45000) marginalRate = 0.30;
        else if (taxableIncome > 18200) marginalRate = 0.16;

        return c.json({
            taxYear,
            gross_income: grossIncome,
            taxable_income: Math.round(result.taxableIncome * 100),
            income_tax: Math.round(result.incomeTax * 100),
            medicare_levy: Math.round(result.medicareLevy * 100),
            medicare_surcharge: Math.round(result.medicareSurcharge * 100),
            lito: Math.round(result.taxOffsets * 100),
            total_tax: Math.round(result.totalTax * 100),
            effective_rate: result.effectiveTaxRate / 100,
            marginal_rate: marginalRate,
            brackets_breakdown: brackets,
        });
    } catch (err) {
        console.error('Tax calculation failed:', err);
        return c.json({ error: 'Tax calculation failed' }, 500);
    }
});

// Get tax brackets for a year
app.get('/api/tax/brackets/:year', async (c) => {
    try {
        const taxYear = c.req.param('year');
        const brackets = await db.select().from(taxBrackets)
            .where(eq(taxBrackets.taxYear, taxYear))
            .all();
        return c.json(brackets);
    } catch (err) {
        console.error('Failed to get tax brackets:', err);
        return c.json({ error: 'Failed to get tax brackets' }, 500);
    }
});

// Get deductions for a year
app.get('/api/tax/deductions/:year', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const taxYear = c.req.param('year');

        const userDeductions = await db.select().from(deductions)
            .where(and(eq(deductions.userId, userId), eq(deductions.taxYear, taxYear)))
            .all();

        return c.json(userDeductions);
    } catch (err) {
        console.error('Failed to get deductions:', err);
        return c.json({ error: 'Failed to get deductions' }, 500);
    }
});

// Add a deduction
app.post('/api/tax/deductions', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();

        const deductionId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(deductions).values({
            id: deductionId,
            userId,
            taxYear: body.taxYear,
            category: body.category,
            subcategory: body.subcategory,
            description: body.description,
            amount: body.amount,
            calculationMethod: body.calculationMethod,
            calculationDetails: body.calculationDetails,
            supportingDocs: body.supportingDocs,
            isSubstantiated: body.isSubstantiated,
            linkedTransactionIds: body.linkedTransactionIds,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ id: deductionId, success: true });
    } catch (err) {
        console.error('Failed to add deduction:', err);
        return c.json({ error: 'Failed to add deduction' }, 500);
    }
});

// Get CGT assets
app.get('/api/tax/assets', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const assets = await db.select().from(cgtAssets)
            .where(eq(cgtAssets.userId, userId))
            .all();

        return c.json(assets);
    } catch (err) {
        console.error('Failed to get assets:', err);
        return c.json({ error: 'Failed to get assets' }, 500);
    }
});

// Add a CGT asset
app.post('/api/tax/assets', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();

        const assetId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(cgtAssets).values({
            id: assetId,
            userId,
            assetName: body.assetName,
            assetType: body.assetType,
            acquisitionDate: body.acquisitionDate,
            acquisitionCost: body.acquisitionCost,
            acquisitionCostsIncidental: body.acquisitionCostsIncidental || 0,
            improvementsCost: body.improvementsCost || 0,
            quantity: body.quantity || 1,
            unitCost: body.unitCost,
            status: body.status || 'held',
            notes: body.notes,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ id: assetId, success: true });
    } catch (err) {
        console.error('Failed to add asset:', err);
        return c.json({ error: 'Failed to add asset' }, 500);
    }
});

// Get CGT events
app.get('/api/tax/cgt', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const taxYear = c.req.query('taxYear');

        const events_list = await db.select().from(cgtEvents)
            .where(and(
                eq(cgtEvents.userId, userId),
                taxYear ? eq(cgtEvents.taxYear, taxYear) : undefined
            ))
            .all();

        return c.json(events_list);
    } catch (err) {
        console.error('Failed to get CGT events:', err);
        return c.json({ error: 'Failed to get CGT events' }, 500);
    }
});

// Record a CGT disposal
app.post('/api/tax/cgt/disposal', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();

        // Calculate CGT
        const cgtResult = taxService.calculateCapitalGain(
            body.acquisitionDate,
            body.acquisitionCost,
            body.disposalDate,
            body.disposalProceeds,
            body.incidentalCosts || 0,
            body.disposalCosts || 0,
            body.carriedForwardLosses || 0
        );

        const eventId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Determine tax year from disposal date
        const dispDate = new Date(body.disposalDate);
        const month = dispDate.getMonth() + 1;
        const year = dispDate.getFullYear();
        const taxYear = month >= 7 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`;

        await db.insert(cgtEvents).values({
            id: eventId,
            userId,
            assetId: body.assetId,
            taxYear,
            disposalDate: body.disposalDate,
            disposalProceeds: body.disposalProceeds,
            disposalCosts: body.disposalCosts || 0,
            quantityDisposed: body.quantityDisposed || 1,
            costBaseUsed: cgtResult.costBase,
            capitalGainGross: cgtResult.grossGain,
            discountApplied: cgtResult.discountEligible,
            discountAmount: cgtResult.discountAmount,
            capitalGainNet: cgtResult.netGain,
            capitalLoss: cgtResult.capitalLoss,
            calculationDetails: JSON.stringify(cgtResult),
            createdAt: now,
        });

        return c.json({ id: eventId, taxYear, ...cgtResult });
    } catch (err) {
        console.error('Failed to record disposal:', err);
        return c.json({ error: 'Failed to record disposal' }, 500);
    }
});

// Get depreciable assets
app.get('/api/tax/depreciation/assets', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const assets = await db.select().from(depreciableAssets)
            .where(eq(depreciableAssets.userId, userId))
            .all();

        return c.json(assets);
    } catch (err) {
        console.error('Failed to get depreciable assets:', err);
        return c.json({ error: 'Failed to get depreciable assets' }, 500);
    }
});

// Add depreciable asset
app.post('/api/tax/depreciation/assets', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();

        const assetId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(depreciableAssets).values({
            id: assetId,
            userId,
            assetName: body.assetName,
            assetCategory: body.assetCategory,
            purchaseDate: body.purchaseDate,
            purchaseCost: body.purchaseCost,
            effectiveLifeYears: body.effectiveLifeYears,
            depreciationMethod: body.depreciationMethod || 'diminishing',
            businessUsePercentage: body.businessUsePercentage || 100,
            openingWrittenDownValue: body.purchaseCost,
            currentWrittenDownValue: body.purchaseCost,
            isInstantWriteOff: body.isInstantWriteOff || false,
            status: 'active',
            linkedTransactionId: body.linkedTransactionId,
            notes: body.notes,
            createdAt: now,
            updatedAt: now,
        });

        return c.json({ id: assetId, success: true });
    } catch (err) {
        console.error('Failed to add depreciable asset:', err);
        return c.json({ error: 'Failed to add depreciable asset' }, 500);
    }
});

// Calculate depreciation for an asset
app.get('/api/tax/depreciation/calculate/:assetId', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const assetId = c.req.param('assetId');

        const asset = await db.select().from(depreciableAssets)
            .where(and(eq(depreciableAssets.id, assetId), eq(depreciableAssets.userId, userId)))
            .get();

        if (!asset) {
            return c.json({ error: 'Asset not found' }, 404);
        }

        const result = taxService.calculateDepreciation(
            asset.purchaseCost,
            asset.effectiveLifeYears,
            asset.openingWrittenDownValue || asset.purchaseCost,
            asset.depreciationMethod as 'diminishing' | 'prime_cost',
            asset.businessUsePercentage || 100
        );

        return c.json(result);
    } catch (err) {
        console.error('Depreciation calculation failed:', err);
        return c.json({ error: 'Depreciation calculation failed' }, 500);
    }
});

// Get tax year summary
app.get('/api/tax/summary/:year', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const taxYear = c.req.param('year');

        // Get existing summary from DB
        const existingSummary = await db.select().from(taxYearSummary)
            .where(and(eq(taxYearSummary.userId, userId), eq(taxYearSummary.taxYear, taxYear)))
            .get();

        if (existingSummary) {
            // Map DB fields to client TaxSummary format
            return c.json({
                id: existingSummary.id,
                userId: existingSummary.userId,
                taxYear: existingSummary.taxYear,
                grossIncomeCents: existingSummary.grossIncome || 0,
                totalDeductionsCents: existingSummary.totalDeductions || 0,
                taxableIncomeCents: existingSummary.taxableIncome || 0,
                netCapitalGainCents: existingSummary.netCapitalGain || 0,
                carriedForwardLossesCents: 0,
                taxPayableCents: existingSummary.taxPayable || 0,
                taxWithheldCents: existingSummary.taxWithheld || 0,
                taxRefundCents: 0,
                medicareLevy: existingSummary.medicareLevy || 0,
                medicareSurcharge: 0,
                isFinalized: false,
            });
        }

        // Calculate summary from transactions
        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .all();

        const userDeductions = await db.select().from(deductions)
            .where(and(eq(deductions.userId, userId), eq(deductions.taxYear, taxYear)))
            .all();

        const cgtEventsList = await db.select().from(cgtEvents)
            .where(and(eq(cgtEvents.userId, userId), eq(cgtEvents.taxYear, taxYear)))
            .all();

        // Sum up values
        const totalIncome = userTransactions
            .filter((t: any) => t.amount > 0 && !t.isTransfer)
            .reduce((sum: any, t: any) => sum + t.amount, 0);

        const totalDeductionsAmount = userDeductions
            .reduce((sum: any, d: any) => sum + d.amount, 0);

        const netCGT = cgtEventsList
            .reduce((sum: any, e: any) => sum + ((e.capitalGainNet || 0) - (e.capitalLoss || 0)), 0);

        // Calculate tax using the tax service (expects dollars, not cents)
        const taxCalc = taxService.calculateFullTax(totalIncome / 100, totalDeductionsAmount / 100, false, true);

        // Map to client's expected TaxSummary format (values in cents)
        const taxableIncomeCents = totalIncome - totalDeductionsAmount + Math.max(0, netCGT);
        const totalTaxPayableCents = Math.round(taxCalc.totalTax * 100);
        const totalCapitalLosses = cgtEventsList.reduce((sum: any, e: any) => sum + (e.capitalLoss || 0), 0);

        const calculatedSummary = {
            id: crypto.randomUUID(),
            userId,
            taxYear,
            grossIncomeCents: totalIncome,
            totalDeductionsCents: totalDeductionsAmount,
            taxableIncomeCents,
            netCapitalGainCents: Math.max(0, netCGT),
            carriedForwardLossesCents: totalCapitalLosses,
            taxPayableCents: totalTaxPayableCents,
            taxWithheldCents: 0,
            taxRefundCents: 0,
            medicareLevy: Math.round(taxCalc.medicareLevy * 100),
            medicareSurcharge: Math.round(taxCalc.medicareSurcharge * 100),
            isFinalized: false,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        return c.json(calculatedSummary);
    } catch (err) {
        console.error('Failed to get tax summary:', err);
        return c.json({ error: 'Failed to get tax summary' }, 500);
    }
});

// ============ MULTI-BANK ENDPOINTS ============

// Get supported banks
app.get('/api/banks', async (c) => {
    try {
        const banks = getSupportedBanks();
        return c.json(banks);
    } catch (err) {
        console.error('Failed to get banks:', err);
        return c.json({ error: 'Failed to get banks' }, 500);
    }
});

// Detect bank from PDF text
app.post('/api/statements/detect-bank', async (c) => {
    try {
        const body = await c.req.json();
        const { pdfText } = body;

        if (!pdfText) {
            return c.json({ error: 'pdfText is required' }, 400);
        }

        const analysis = analyzeStatement(pdfText);
        return c.json(analysis);
    } catch (err) {
        console.error('Bank detection failed:', err);
        return c.json({ error: 'Bank detection failed' }, 500);
    }
});

// Get consolidated account summary
app.get('/api/accounts/consolidated', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const userAccounts = await db.select().from(accounts)
            .where(eq(accounts.userId, userId))
            .all();

        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .all();

        // Calculate totals per account
        const accountSummaries = userAccounts.map((account: any) => {
            const accountTxs = userTransactions.filter((t: any) => t.accountId === account.id);
            const totalIncome = accountTxs
                .filter((t: any) => t.amount > 0 && !t.isTransfer)
                .reduce((sum: any, t: any) => sum + t.amount, 0);
            const totalExpenses = accountTxs
                .filter((t: any) => t.amount < 0 && !t.isTransfer)
                .reduce((sum: any, t: any) => sum + Math.abs(t.amount), 0);
            const transfersIn = accountTxs
                .filter((t: any) => t.amount > 0 && t.isTransfer)
                .reduce((sum: any, t: any) => sum + t.amount, 0);
            const transfersOut = accountTxs
                .filter((t: any) => t.amount < 0 && t.isTransfer)
                .reduce((sum: any, t: any) => sum + Math.abs(t.amount), 0);

            return {
                ...account,
                transactionCount: accountTxs.length,
                totalIncome,
                totalExpenses,
                netFlow: totalIncome - totalExpenses,
                transfersIn,
                transfersOut,
            };
        });

        // Calculate overall totals (excluding transfers to avoid double-counting)
        const overallTotals = {
            totalAccounts: userAccounts.length,
            totalTransactions: userTransactions.filter((t: any) => !t.isTransfer).length,
            totalIncome: accountSummaries.reduce((sum: any, a: any) => sum + a.totalIncome, 0),
            totalExpenses: accountSummaries.reduce((sum: any, a: any) => sum + a.totalExpenses, 0),
            netWorth: userAccounts.reduce((sum: any, a: any) => sum + (a.currentBalance || 0), 0),
        };

        return c.json({
            accounts: accountSummaries,
            totals: overallTotals,
        });
    } catch (err) {
        console.error('Failed to get consolidated summary:', err);
        return c.json({ error: 'Failed to get consolidated summary' }, 500);
    }
});

// Auto-detect transfers between accounts (with optional persist)
app.post('/api/transfers/auto-detect', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json().catch(() => ({}));
        const persist = body.persist === true;

        const userTransactions = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .all();

        const userAccounts = await db.select().from(accounts)
            .where(eq(accounts.userId, userId))
            .all();

        const existingLinks = await db.select().from(transferLinks)
            .where(eq(transferLinks.userId, userId))
            .all();

        // Convert to transfer candidate format
        const candidates = userTransactions.map((t: any) => ({
            id: parseInt(t.id) || 0,
            accountId: parseInt(t.accountId || '0') || 0,
            date: t.date,
            description: t.description,
            amount: t.amount,
            isLinked: t.isTransfer ?? undefined,
            linkedTransactionId: t.transferLinkId ? parseInt(t.transferLinkId) : undefined,
        }));

        const accountContexts = userAccounts.map((a: any) => ({
            id: parseInt(a.id) || 0,
            accountNumber: a.accountNumber,
            bankId: a.bankName || 'unknown',
            accountName: a.accountName,
            accountType: a.accountType,
            ownershipTag: (a as any).ownershipTag || 'business',
        }));

        const existingLinkPairs = existingLinks.map((l: any) => ({
            sourceId: parseInt(l.sourceTransactionId) || 0,
            targetId: parseInt(l.destinationTransactionId) || 0,
        }));

        const matches = detectTransfers(candidates, accountContexts, existingLinkPairs);

        // Optionally persist matches to DB
        let persistResult = null;
        if (persist && matches.length > 0) {
            persistResult = await persistTransferMatches(matches, { userId });

            // Detect owner contributions (personal → business)
            const ownerContribIds: string[] = [];
            for (const match of matches) {
                const srcAcct = userAccounts.find((a: any) => (parseInt(a.id) || 0) === match.sourceTransaction.accountId);
                const dstAcct = userAccounts.find((a: any) => (parseInt(a.id) || 0) === match.targetTransaction.accountId);
                if ((srcAcct as any)?.ownershipTag === 'personal' && (dstAcct as any)?.ownershipTag === 'business') {
                    ownerContribIds.push(String(match.targetTransaction.id));
                }
            }
            if (ownerContribIds.length > 0) {
                await markOwnerContributions(ownerContribIds);
            }

            events.emit('update', { type: 'transfers_updated' });
        }

        return c.json({
            matchesFound: matches.length,
            persisted: persist ? (persistResult?.created || 0) : 0,
            matches: matches.map(m => ({
                sourceTransaction: m.sourceTransaction,
                targetTransaction: m.targetTransaction,
                confidence: m.confidence,
                reasons: m.matchReasons,
            })),
        });
    } catch (err) {
        console.error('Transfer detection failed:', err);
        return c.json({ error: 'Transfer detection failed' }, 500);
    }
});

// Bulk link transfers
app.post('/api/transfers/bulk-link', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { pairs } = body; // Array of { sourceTransactionId, destinationTransactionId }

        if (!Array.isArray(pairs)) {
            return c.json({ error: 'Pairs must be an array' }, 400);
        }

        const now = new Date().toISOString();
        const created: string[] = [];

        for (const pair of pairs) {
            const { sourceTransactionId, destinationTransactionId, confidence } = pair;

            // Verify both transactions exist and belong to user
            const sourceTx = await db.select().from(transactions)
                .where(and(eq(transactions.id, sourceTransactionId), eq(transactions.userId, userId))).get();
            const destTx = await db.select().from(transactions)
                .where(and(eq(transactions.id, destinationTransactionId), eq(transactions.userId, userId))).get();

            if (!sourceTx || !destTx) continue;

            const linkId = crypto.randomUUID();

            await db.insert(transferLinks).values({
                id: linkId,
                userId,
                sourceTransactionId,
                destinationTransactionId,
                sourceAccountId: sourceTx.accountId,
                destinationAccountId: destTx.accountId,
                amount: Math.abs(sourceTx.amount),
                transferDate: sourceTx.date,
                confidence: confidence || 0.8,
                isUserConfirmed: false,
                createdAt: now,
            });

            // Mark both transactions as transfers
            await db.update(transactions)
                .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
                .where(eq(transactions.id, sourceTransactionId));
            await db.update(transactions)
                .set({ isTransfer: true, transferLinkId: linkId, category: 'Transfer' })
                .where(eq(transactions.id, destinationTransactionId));

            created.push(linkId);
        }

        events.emit('update', { type: 'transactions_updated' });

        return c.json({ success: true, created: created.length, linkIds: created });
    } catch (err) {
        console.error('Bulk link failed:', err);
        return c.json({ error: 'Bulk link failed' }, 500);
    }
});

// NOTE: POST /api/transfers/detect is handled by routes/pipeline.ts (mounted at /api)

// Get transfer summary aggregated by period
// Query params: ?period=monthly|quarterly|all&from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/transfers/summary', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const period = c.req.query('period') || 'monthly'; // monthly, quarterly, all, or legacy 1m/3m/6m/12m
        const fromDate = c.req.query('from');
        const toDate = c.req.query('to');

        // Build date filter conditions
        const conditions: any[] = [eq(transferLinks.userId, userId)];

        if (fromDate) {
            conditions.push(gte(transferLinks.transferDate, fromDate));
        } else {
            // Default: last 3 months if no date range specified
            const legacyMap: Record<string, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };
            const defaultMonths = legacyMap[period] || 3;
            const defaultStart = new Date();
            defaultStart.setMonth(defaultStart.getMonth() - defaultMonths);
            conditions.push(gte(transferLinks.transferDate, defaultStart.toISOString().split('T')[0]));
        }

        if (toDate) {
            conditions.push(lte(transferLinks.transferDate, toDate));
        }

        const links = await db.select()
            .from(transferLinks)
            .where(and(...conditions))
            .all();

        // Aggregate by time period (monthly or quarterly)
        const byPeriod: Record<string, { count: number; totalAmount: number }> = {};
        for (const link of links) {
            const date = link.transferDate || '';
            let periodKey: string;

            if (period === 'quarterly') {
                const [year, month] = date.split('-').map(Number);
                const q = Math.ceil(month / 3);
                periodKey = `${year}-Q${q}`;
            } else {
                // monthly (default)
                periodKey = date.substring(0, 7); // YYYY-MM
            }

            if (!byPeriod[periodKey]) {
                byPeriod[periodKey] = { count: 0, totalAmount: 0 };
            }
            byPeriod[periodKey].count += 1;
            byPeriod[periodKey].totalAmount += link.amount || 0;
        }

        // Aggregate by account pair (for MoneyFlowDiagram)
        const byPair: Record<string, { sourceAccountId: string; destinationAccountId: string; count: number; totalAmount: number }> = {};
        for (const link of links) {
            const pairKey = `${link.sourceAccountId || 'unknown'}→${link.destinationAccountId || 'unknown'}`;
            if (!byPair[pairKey]) {
                byPair[pairKey] = {
                    sourceAccountId: link.sourceAccountId || 'unknown',
                    destinationAccountId: link.destinationAccountId || 'unknown',
                    count: 0,
                    totalAmount: 0,
                };
            }
            byPair[pairKey].count += 1;
            byPair[pairKey].totalAmount += link.amount || 0;
        }

        return c.json({
            period,
            totalTransfers: links.length,
            totalAmount: links.reduce((sum: any, l: any) => sum + (l.amount || 0), 0),
            confirmedCount: links.filter((l: any) => l.isUserConfirmed).length,
            pendingCount: links.filter((l: any) => !l.isUserConfirmed).length,
            byPeriod: Object.entries(byPeriod).sort(([a], [b]) => a.localeCompare(b)).map(([key, data]) => ({
                period: key,
                ...data,
            })),
            byAccountPair: Object.values(byPair).sort((a, b) => b.totalAmount - a.totalAmount),
        });
    } catch (err) {
        console.error('Transfer summary failed:', err);
        return c.json({ error: 'Transfer summary failed' }, 500);
    }
});

// Get consolidated report for a period
app.get('/api/reports/consolidated/:period', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const period = c.req.param('period'); // Format: YYYY-MM or YYYY

        let startDate: string;
        let endDate: string;

        if (period.length === 7) {
            // Monthly: YYYY-MM
            startDate = `${period}-01`;
            const [year, month] = period.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            endDate = `${period}-${lastDay.toString().padStart(2, '0')}`;
        } else if (period.length === 4) {
            // Yearly: YYYY
            startDate = `${period}-01-01`;
            endDate = `${period}-12-31`;
        } else {
            return c.json({ error: 'Invalid period format. Use YYYY-MM or YYYY' }, 400);
        }

        const userTransactions = await db.select().from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                gte(transactions.date, startDate),
                lte(transactions.date, endDate)
            ))
            .orderBy(desc(transactions.date))
            .all();

        // Exclude transfers from calculations
        const nonTransferTxs = userTransactions.filter((t: any) => !t.isTransfer);

        // Category breakdown
        const categoryTotals: Record<string, { income: number; expenses: number; count: number }> = {};

        for (const tx of nonTransferTxs) {
            const cat = tx.category || 'Uncategorized';
            if (!categoryTotals[cat]) {
                categoryTotals[cat] = { income: 0, expenses: 0, count: 0 };
            }
            if (tx.amount > 0) {
                categoryTotals[cat].income += tx.amount;
            } else {
                categoryTotals[cat].expenses += Math.abs(tx.amount);
            }
            categoryTotals[cat].count++;
        }

        // GST summary
        const gstTransactions = nonTransferTxs.filter((t: any) => t.gstApplicable);
        const totalGST = gstTransactions.reduce((sum: any, t: any) => {
            return sum + (t.gstAmount || Math.round(Math.abs(t.amount) / 11));
        }, 0);

        return c.json({
            period,
            startDate,
            endDate,
            summary: {
                totalIncome: nonTransferTxs.filter((t: any) => t.amount > 0).reduce((sum: any, t: any) => sum + t.amount, 0),
                totalExpenses: nonTransferTxs.filter((t: any) => t.amount < 0).reduce((sum: any, t: any) => sum + Math.abs(t.amount), 0),
                netFlow: nonTransferTxs.reduce((sum: any, t: any) => sum + t.amount, 0),
                transactionCount: nonTransferTxs.length,
                transferCount: userTransactions.length - nonTransferTxs.length,
            },
            gst: {
                gstTransactionCount: gstTransactions.length,
                totalGSTCollected: gstTransactions.filter((t: any) => t.amount > 0).reduce((sum: any, t: any) => sum + (t.gstAmount || Math.round(t.amount / 11)), 0),
                totalGSTPaid: gstTransactions.filter((t: any) => t.amount < 0).reduce((sum: any, t: any) => sum + (t.gstAmount || Math.round(Math.abs(t.amount) / 11)), 0),
                estimatedGSTPayable: totalGST,
            },
            categories: Object.entries(categoryTotals).map(([category, data]) => ({
                category,
                ...data,
                net: data.income - data.expenses,
            })).sort((a, b) => b.expenses - a.expenses),
        });
    } catch (err) {
        console.error('Failed to generate report:', err);
        return c.json({ error: 'Failed to generate report' }, 500);
    }
});

// Knowledge Ingestion Endpoint
app.post('/api/admin/ingest-knowledge', async (c) => {
    try {
        const _payload = c.get('jwtPayload'); // Placeholder for admin check
        // TODO: Add admin check here

        const { datasetName } = await c.req.json();
        const targetDataset = datasetName || 'production_handbooks';

        // Assume knowledge is stored in server/knowledge
        const knowledgeDir = path.resolve(process.cwd(), 'knowledge');

        if (!fs.existsSync(knowledgeDir)) {
            return c.json({ error: 'Knowledge directory not found' }, 404);
        }

        const files = fs.readdirSync(knowledgeDir);
        const documents: string[] = [];

        for (const file of files) {
            if (file.endsWith('.md')) {
                const filePath = path.join(knowledgeDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                documents.push(`Source: ${file}\nContent:\n${content}`);
            }
        }

        if (documents.length === 0) {
            return c.json({ message: 'No markdown files found to ingest' });
        }

        const result = await ragService.addDocuments(documents, targetDataset);
        return c.json(result);

    } catch (err) {
        console.error('Ingestion failed:', err);
        return c.json({ error: 'Ingestion failed' }, 500);
    }
});

// ============ ANALYTICS ENDPOINTS ============

// Category color palette for responses
const CATEGORY_COLORS: Record<string, string> = {
  'Groceries & Supermarkets': '#22c55e', 'Dining & Restaurants': '#f97316',
  'Transport & Auto': '#3b82f6', 'Entertainment & Recreation': '#a855f7',
  'Shopping & Retail': '#ec4899', 'Utilities & Bills': '#eab308',
  'Housing & Rent': '#ef4444', 'Medical & Health': '#06b6d4',
  'Education & Childcare': '#8b5cf6', 'Insurance': '#14b8a6',
  'Government & Tax': '#64748b', 'Financial Services': '#6366f1',
  'Employment Income': '#10b981', 'Salary & Wages': '#10b981',
  'Interest & Dividends': '#84cc16', 'Business Revenue': '#22c55e',
  'Internal Transfer': '#71717a', 'Transfer': '#71717a',
  'Subscription Services': '#d946ef', 'Travel & Accommodation': '#0ea5e9',
  'Personal Care': '#f43f5e', 'Donations & Charity': '#f59e0b',
  'Loan/Liability Payment': '#78716c', 'Superannuation': '#14b8a6',
  'Merchant Fees': '#ef4444', 'Other': '#71717a',
};

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat] || '#FFCC00';
}

// Helper: get cutoff date relative to the user's latest transaction
async function getRelativeCutoff(userId: string, months: number): Promise<string> {
    const latest = await db.select({ maxDate: sql<string>`MAX(${transactions.date})` })
      .from(transactions).where(eq(transactions.userId, userId)).get();
    const refDate = latest?.maxDate ? new Date(latest.maxDate) : new Date();
    refDate.setMonth(refDate.getMonth() - months);
    return refDate.toISOString().split('T')[0];
}

// 1. Category Breakdown
app.get('/api/analytics/category-breakdown', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const period = c.req.query('period') || '3m_expenses';
    const [monthStr, mode] = period.split('_');
    const months = parseInt(monthStr) || 3;
    const isExpense = mode !== 'income';

    const cutoffStr = await getRelativeCutoff(userId, months);

    const txns = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, cutoffStr),
        eq(transactions.isTransfer, false)
      ))
      .all();

    const filtered = txns.filter((t: any) => isExpense ? t.amount < 0 : t.amount > 0);
    const totalAbs = filtered.reduce((s: any, t: any) => s + Math.abs(t.amount), 0);

    const byCategory: Record<string, { total: number; count: number }> = {};
    for (const t of filtered) {
      const cat = t.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
      byCategory[cat].total += Math.abs(t.amount);
      byCategory[cat].count++;
    }

    const result = Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        total: data.total,
        percentage: totalAbs > 0 ? Math.round((data.total / totalAbs) * 10000) / 100 : 0,
        color: getCatColor(category),
        transactionCount: data.count,
      }))
      .sort((a, b) => b.total - a.total);

    return c.json(result);
  } catch (err) {
    console.error('Category breakdown failed:', err);
    return c.json({ error: 'Failed' }, 500);
  }
});

// 2. Recurring Payments
app.get('/api/analytics/recurring-payments', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    const txns = await db.select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.isTransfer, false)))
      .all();

    // Group by normalized description to find recurring patterns
    const byMerchant: Record<string, Array<{ amount: number; date: string }>> = {};
    for (const t of txns) {
      if (t.amount >= 0) continue; // Only expenses
      const key = (t.description || '').replace(/\d{2,}/g, '').trim().substring(0, 40);
      if (!key) continue;
      if (!byMerchant[key]) byMerchant[key] = [];
      byMerchant[key].push({ amount: Math.abs(t.amount), date: t.date });
    }

    const recurring: any[] = [];
    const now = new Date();

    for (const [merchant, occurrences] of Object.entries(byMerchant)) {
      if (occurrences.length < 2) continue;

      // Sort by date
      occurrences.sort((a, b) => a.date.localeCompare(b.date));

      // Calculate average interval in days
      let totalGap = 0;
      for (let i = 1; i < occurrences.length; i++) {
        const d1 = new Date(occurrences[i - 1].date);
        const d2 = new Date(occurrences[i].date);
        totalGap += (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
      }
      const avgGap = totalGap / (occurrences.length - 1);

      // Determine frequency
      let frequency: string;
      if (avgGap <= 10) frequency = 'weekly';
      else if (avgGap <= 20) frequency = 'fortnightly';
      else if (avgGap <= 45) frequency = 'monthly';
      else if (avgGap <= 120) frequency = 'quarterly';
      else frequency = 'annual';

      const typicalAmount = Math.round(
        occurrences.reduce((s, o) => s + o.amount, 0) / occurrences.length
      );
      const lastDate = occurrences[occurrences.length - 1].date;
      const lastDateObj = new Date(lastDate);
      const nextExpected = new Date(lastDateObj);
      nextExpected.setDate(nextExpected.getDate() + Math.round(avgGap));

      // Determine if missed (more than 1.5x the gap since last)
      const daysSinceLast = (now.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24);
      const isMissed = daysSinceLast > avgGap * 1.5;

      // Amount changed?
      const last = occurrences[occurrences.length - 1].amount;
      const prev = occurrences.length > 1 ? occurrences[occurrences.length - 2].amount : last;
      const amountChanged = Math.abs(last - prev) > prev * 0.1;

      // Annual cost
      const multiplier = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annual: 1 }[frequency] || 12;

      recurring.push({
        id: crypto.randomUUID(),
        merchantPattern: merchant,
        typicalAmount,
        frequency,
        lastOccurrence: lastDate,
        nextExpected: nextExpected.toISOString().split('T')[0],
        isActive: !isMissed,
        category: undefined,
        annualCost: typicalAmount * multiplier,
        isMissed,
        amountChanged,
      });
    }

    recurring.sort((a, b) => b.annualCost - a.annualCost);
    return c.json(recurring);
  } catch (err) {
    console.error('Recurring payments failed:', err);
    return c.json({ error: 'Failed' }, 500);
  }
});

// 3. Spending Trends
app.get('/api/analytics/spending-trends', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const months = parseInt(c.req.query('months') || '6');

    const cutoffStr = await getRelativeCutoff(userId, months);

    const txns = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, cutoffStr),
        eq(transactions.isTransfer, false)
      ))
      .all();

    // Group by month
    const byMonth: Record<string, Record<string, number>> = {};
    for (const t of txns) {
      if (t.amount >= 0) continue; // Expenses only
      const month = t.date.substring(0, 7); // YYYY-MM
      if (!byMonth[month]) byMonth[month] = {};
      const cat = t.category || 'Other';
      byMonth[month][cat] = (byMonth[month][cat] || 0) + Math.abs(t.amount);
    }

    const result = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, categories]) => ({
        month,
        categories,
        total: Object.values(categories).reduce((s, v) => s + v, 0),
      }));

    return c.json(result);
  } catch (err) {
    console.error('Spending trends failed:', err);
    return c.json({ error: 'Failed' }, 500);
  }
});

// 4. Budget vs Actual
app.get('/api/analytics/budget-vs-actual', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const period = c.req.query('period') || 'monthly';

    // Use the latest transaction month as "current"
    const latestResult = await db.select({ maxDate: sql<string>`MAX(${transactions.date})` })
      .from(transactions).where(eq(transactions.userId, userId)).get();
    const refDate = latestResult?.maxDate ? new Date(latestResult.maxDate) : new Date();
    const monthStart = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];

    const txns = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
        eq(transactions.isTransfer, false)
      ))
      .all();

    // Sum actuals by category
    const actuals: Record<string, number> = {};
    for (const t of txns) {
      if (t.amount >= 0) continue;
      const cat = t.category || 'Other';
      actuals[cat] = (actuals[cat] || 0) + Math.abs(t.amount);
    }

    // Generate budget entries (auto-estimated from average spending)
    // Get 3-month history for estimates
    const histCutoff = await getRelativeCutoff(userId, 3);
    const histTxns = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, histCutoff),
        eq(transactions.isTransfer, false)
      ))
      .all();

    const monthlyAvg: Record<string, number> = {};
    for (const t of histTxns) {
      if (t.amount >= 0) continue;
      const cat = t.category || 'Other';
      monthlyAvg[cat] = (monthlyAvg[cat] || 0) + Math.abs(t.amount);
    }
    // Divide by 3 to get monthly average
    for (const cat of Object.keys(monthlyAvg)) {
      monthlyAvg[cat] = Math.round(monthlyAvg[cat] / 3);
    }

    // Combine all categories
    const allCats = new Set([...Object.keys(actuals), ...Object.keys(monthlyAvg)]);
    const result: any[] = [];
    for (const cat of allCats) {
      const budgetAmount = monthlyAvg[cat] || 0;
      const actualAmount = actuals[cat] || 0;
      const variance = budgetAmount - actualAmount;
      const utilizationPercent = budgetAmount > 0 ? Math.round((actualAmount / budgetAmount) * 100) : 0;
      result.push({
        id: crypto.randomUUID(),
        category: cat,
        periodType: 'monthly',
        periodStart: monthStart,
        amountCents: budgetAmount,
        actualCents: actualAmount,
        variance,
        utilizationPercent,
      });
    }

    result.sort((a, b) => b.actualCents - a.actualCents);
    return c.json(result);
  } catch (err) {
    console.error('Budget vs actual failed:', err);
    return c.json({ error: 'Failed' }, 500);
  }
});

// 5. Budgets CRUD
app.get('/api/analytics/budgets', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    // Redirect to budget-vs-actual for now
    const period = c.req.query('period') || 'monthly';
    const url = new URL(c.req.url);
    url.pathname = '/api/analytics/budget-vs-actual';
    const response = await app.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
    return response;
  } catch (err) {
    return c.json([], 200);
  }
});

app.post('/api/analytics/budgets', async (c) => {
  try {
    // Budget save - placeholder for now
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed' }, 500);
  }
});

// 6. Anomaly Detection
app.get('/api/analytics/anomalies', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;

    const txns = await db.select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.isTransfer, false)))
      .all();

    const anomalies: any[] = [];
    const now = new Date().toISOString();

    // Calculate average and stddev per category
    const catStats: Record<string, { amounts: number[]; dates: string[] }> = {};
    for (const t of txns) {
      const cat = t.category || 'Other';
      if (!catStats[cat]) catStats[cat] = { amounts: [], dates: [] };
      catStats[cat].amounts.push(Math.abs(t.amount));
      catStats[cat].dates.push(t.date);
    }

    // Detect anomalies
    for (const t of txns) {
      const cat = t.category || 'Other';
      const stats = catStats[cat];
      if (!stats || stats.amounts.length < 3) continue;

      const avg = stats.amounts.reduce((s, v) => s + v, 0) / stats.amounts.length;
      const variance = stats.amounts.reduce((s, v) => s + (v - avg) ** 2, 0) / stats.amounts.length;
      const stddev = Math.sqrt(variance);
      const absAmount = Math.abs(t.amount);

      // Unusually large amount (>2 stddev)
      if (stddev > 0 && absAmount > avg + 2 * stddev) {
        anomalies.push({
          id: crypto.randomUUID(),
          transactionId: t.id,
          type: 'amount',
          severity: absAmount > avg + 3 * stddev ? 'critical' : 'warning',
          description: `${t.description}: $${(absAmount / 100).toFixed(2)} is ${((absAmount - avg) / stddev).toFixed(1)}x standard deviations above average ($${(avg / 100).toFixed(2)}) for ${cat}`,
          isDismissed: false,
          createdAt: now,
        });
      }

      // Round number detection (exactly divisible by 100, >$50)
      if (absAmount >= 5000 && absAmount % 10000 === 0) {
        anomalies.push({
          id: crypto.randomUUID(),
          transactionId: t.id,
          type: 'round_number',
          severity: 'info',
          description: `${t.description}: Round amount of $${(absAmount / 100).toFixed(0)} — verify if correct`,
          isDismissed: false,
          createdAt: now,
        });
      }
    }

    // Duplicate detection (same amount + same day)
    const txByDate: Record<string, typeof txns> = {};
    for (const t of txns) {
      if (!txByDate[t.date]) txByDate[t.date] = [];
      txByDate[t.date].push(t);
    }
    for (const [date, dayTxns] of Object.entries(txByDate)) {
      for (let i = 0; i < dayTxns.length; i++) {
        for (let j = i + 1; j < dayTxns.length; j++) {
          if (dayTxns[i].amount === dayTxns[j].amount && dayTxns[i].amount < 0) {
            anomalies.push({
              id: crypto.randomUUID(),
              transactionId: dayTxns[j].id,
              type: 'duplicate',
              severity: 'warning',
              description: `Possible duplicate: "${dayTxns[i].description}" and "${dayTxns[j].description}" — same amount ($${(Math.abs(dayTxns[i].amount) / 100).toFixed(2)}) on ${date}`,
              isDismissed: false,
              createdAt: now,
            });
          }
        }
      }
    }

    anomalies.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity as keyof typeof sev] || 2) - (sev[b.severity as keyof typeof sev] || 2);
    });

    return c.json(anomalies.slice(0, 50));
  } catch (err) {
    console.error('Anomaly detection failed:', err);
    return c.json({ error: 'Failed' }, 500);
  }
});

app.post('/api/analytics/anomalies/:id/dismiss', async (c) => {
  return c.json({ success: true });
});

// 7. Cash Flow Forecast
app.get('/api/analytics/cash-flow-forecast', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const forecastMonths = parseInt(c.req.query('months') || '3');

    // Get last 6 months of transactions for trend analysis
    const cutoffStr = await getRelativeCutoff(userId, 6);

    const txns = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        gte(transactions.date, cutoffStr),
        eq(transactions.isTransfer, false)
      ))
      .all();

    // Calculate monthly net flows
    const monthlyNet: Record<string, number> = {};
    for (const t of txns) {
      const month = t.date.substring(0, 7);
      monthlyNet[month] = (monthlyNet[month] || 0) + t.amount;
    }

    const monthValues = Object.entries(monthlyNet).sort(([a], [b]) => a.localeCompare(b));
    const avgMonthlyNet = monthValues.length > 0
      ? monthValues.reduce((s, [_, v]) => s + v, 0) / monthValues.length
      : 0;

    // Calculate variance for confidence bands
    const varianceVal = monthValues.length > 1
      ? monthValues.reduce((s, [_, v]) => s + (v - avgMonthlyNet) ** 2, 0) / monthValues.length
      : 0;
    const stddev = Math.sqrt(varianceVal);

    // Get latest balance
    const latestTx = await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(sql`${transactions.date} DESC`)
      .limit(1)
      .all();

    let currentBalance = latestTx[0]?.balance || 0;

    // Generate forecast
    const forecast: any[] = [];
    const now = new Date();

    for (let i = 1; i <= forecastMonths; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

      currentBalance += avgMonthlyNet;
      const confidence = Math.max(0.5, 1 - (i * 0.1)); // Decreasing confidence
      const band = stddev * i * 0.5;

      forecast.push({
        month,
        projectedBalance: Math.round(currentBalance),
        confidence: Math.round(confidence * 100) / 100,
        upperBound: Math.round(currentBalance + band),
        lowerBound: Math.round(currentBalance - band),
      });
    }

    return c.json(forecast);
  } catch (err) {
    console.error('Cash flow forecast failed:', err);
    return c.json({ error: 'Failed' }, 500);
  }
});

// Mount Claude agent framework routes (separate from legacy agent endpoints)
app.route('/api/claude-agents', agentRoutes);

// Mount pipeline integration routes (transfers, enrichment, BAS prefill)
app.route('/api', pipelineRoutes);

const port = parseInt(process.env.PORT || '3501', 10);
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
})

