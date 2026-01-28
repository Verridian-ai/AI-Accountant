import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import { rateLimiter } from 'hono-rate-limiter'
import { jwt, verify } from 'hono/jwt'
import { stream } from 'hono/streaming'
import { db, transactions, statements, users, userSettings, transactionHistory, accounts, merchantMemory, pendingCategorization, transferLinks, accountBalanceHistory, reconciliationAlerts, statementAccounts, businessProfiles } from './schema.js'
import { validateABN, normalizeABN, formatABN, validateEntityType, validateBasFrequency, validateAnzsicCode, validateTaxAgentNumber, ENTITY_TYPES, BAS_FREQUENCIES, COMMON_ANZSIC_CODES } from './utils/abn.js'
import { desc, eq, and, gte, lte, like, aliasedTable } from 'drizzle-orm'

import { pipeline } from './services/pipeline.js';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import crypto from 'crypto';
import { hashPassword, comparePassword, generateToken, verifyToken } from './auth.js';
import { events } from './events.js';
import { aiService } from './services/ai.js';
import { ragService } from './services/rag.js';
import { accountService } from './services/accounts.js';
import { agentService, AgentType } from './services/agents.js';
import { getVertexAIClient, VERTEX_AI_MODELS, FINTECH_MODEL_PRESETS } from './services/vertex-ai.js';

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

// General API rate limiter: relaxed for development
const generalLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 1000, // Increased from 30 to 1000 for local development
    standardHeaders: true,
    keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
    message: { error: 'Too many requests, please try again later.' },
})

// Strict limiter for expensive AI endpoints: relaxed for development
const chatLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 100, // Increased from 5 to 100 for local development
    standardHeaders: true,
    keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
    message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
})

app.use('/*', cors())

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
    return c.text('CBA Statement Parser API is running!')
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

    const filename = file.name;
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

app.get('/api/settings', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

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
        return c.json(settings);
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to fetch settings' }, 500);
    }
});

app.patch('/api/settings', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();

        const updateData = {
            modelParsingText: body.modelParsingText,
            modelParsingVision: body.modelParsingVision,
            modelCategorization: body.modelCategorization,
            modelChat: body.modelChat,
            modelEmbedding: body.modelEmbedding
        };

        await db.update(userSettings)
            .set(updateData)
            .where(eq(userSettings.userId, userId));

        return c.json({ message: 'Settings updated' });
    } catch (err) {
        console.error(err);
        return c.json({ error: 'Failed to update settings' }, 500);
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

        // 3. Reset status to PENDING and clear errors
        await db.update(statements)
            .set({
                parsingStatus: 'PENDING',
                errorType: null,
                errorMessage: null,
                errorDetails: null
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
            stream.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
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

        const stmtAccountMap = new Map(stmtAccounts.map(sa => [sa.statementId, sa.accountId]));

        // Group statements by account
        const accountStatements = new Map<string, typeof stmts>();
        const unlinkedStatements: typeof stmts = [];

        for (const stmt of stmts) {
            const accountId = stmtAccountMap.get(stmt.id);
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
            .filter(s => s.periodStartDate && s.periodEndDate)
            .flatMap(s => [s.periodStartDate!, s.periodEndDate!])
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
            statements: stmts.map(s => ({
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

// Get all accounts for the current user
app.get('/api/accounts', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.userId;
    const userAccounts = await accountService.getUserAccounts(userId);
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

    const results = rows.map(row => ({
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

    const results = rows.map(row => {
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
    const interestTransactions = txs.filter(t =>
        t.category === 'Interest & Fees' ||
        t.description.toLowerCase().includes('interest') ||
        t.description.toLowerCase().includes('fee')
    );
    const totalInterestPaid = interestTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Find payment transactions (credits to the card)
    const payments = txs.filter(t => t.amount > 0 && !t.isTransfer);
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);

    // Calculate average monthly spending
    const purchases = txs.filter(t => t.amount < 0 && !t.isTransfer);
    const totalSpending = purchases.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Get unique months
    const months = new Set(txs.map(t => t.date.substring(0, 7)));
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
        recentInterestCharges: interestTransactions.slice(0, 5).map(t => ({
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
    const accountsWithDebt = debtAccounts.filter(a =>
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
    const accountMap = new Map(accountsWithDebt.map(a => [a.id, a]));

    // Prepare accounts for AI analysis
    const accountsForAnalysis = accountsWithDebt.map(a => ({
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
                const account = accountMap.get(p.account_id);
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
        const agentType = c.req.param('type') as AgentType;
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
        const agentType = c.req.param('type') as AgentType;
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
import { TransferDetector, detectTransfers, excludeTransfers } from './services/transfers/index.js';
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

        return c.json(result);
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

        const result = taxService.calculateFullTax(grossIncome, totalDeductions, hasPrivateHealth, applyLITO);

        return c.json({ ...result, taxYear });
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
            return c.json(existingSummary);
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
            .filter(t => t.amount > 0 && !t.isTransfer)
            .reduce((sum, t) => sum + t.amount, 0);

        const totalDeductionsAmount = userDeductions
            .reduce((sum, d) => sum + d.amount, 0);

        const netCGT = cgtEventsList
            .reduce((sum, e) => sum + ((e.capitalGainNet || 0) - (e.capitalLoss || 0)), 0);

        // Calculate tax using the tax service
        const taxCalc = taxService.calculateFullTax(totalIncome, totalDeductionsAmount, false, true);

        // Create a partial summary object for response (not saving to DB)
        const calculatedSummary = {
            id: crypto.randomUUID(),
            userId,
            taxYear,
            totalGrossIncome: totalIncome,
            totalDeductions: totalDeductionsAmount,
            taxableIncome: totalIncome - totalDeductionsAmount + Math.max(0, netCGT),
            netCapitalGain: Math.max(0, netCGT),
            totalCapitalGains: cgtEventsList.reduce((sum, e) => sum + (e.capitalGainGross || 0), 0),
            capitalLossesOffset: cgtEventsList.reduce((sum, e) => sum + (e.capitalLoss || 0), 0),
            taxOnTaxableIncome: taxCalc.incomeTax,
            medicareLevy: taxCalc.medicareLevy,
            medicareLevySurcharge: taxCalc.medicareSurcharge,
            taxOffsetsTotal: taxCalc.taxOffsets,
            totalTaxPayable: taxCalc.totalTax,
            effectiveTaxRate: taxCalc.effectiveTaxRate,
            taxWithheld: 0,
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
        const accountSummaries = userAccounts.map(account => {
            const accountTxs = userTransactions.filter(t => t.accountId === account.id);
            const totalIncome = accountTxs
                .filter(t => t.amount > 0 && !t.isTransfer)
                .reduce((sum, t) => sum + t.amount, 0);
            const totalExpenses = accountTxs
                .filter(t => t.amount < 0 && !t.isTransfer)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const transfersIn = accountTxs
                .filter(t => t.amount > 0 && t.isTransfer)
                .reduce((sum, t) => sum + t.amount, 0);
            const transfersOut = accountTxs
                .filter(t => t.amount < 0 && t.isTransfer)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);

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
            totalTransactions: userTransactions.filter(t => !t.isTransfer).length,
            totalIncome: accountSummaries.reduce((sum, a) => sum + a.totalIncome, 0),
            totalExpenses: accountSummaries.reduce((sum, a) => sum + a.totalExpenses, 0),
            netWorth: userAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0),
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

// Auto-detect transfers between accounts
app.post('/api/transfers/auto-detect', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

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
        const candidates = userTransactions.map(t => ({
            id: parseInt(t.id) || 0,
            accountId: parseInt(t.accountId || '0') || 0,
            date: t.date,
            description: t.description,
            amount: t.amount,
            isLinked: t.isTransfer ?? undefined,
            linkedTransactionId: t.transferLinkId ? parseInt(t.transferLinkId) : undefined,
        }));

        const accountContexts = userAccounts.map(a => ({
            id: parseInt(a.id) || 0,
            accountNumber: a.accountNumber,
            bankId: a.bankName || 'unknown',
            accountName: a.accountName,
        }));

        const existingLinkPairs = existingLinks.map(l => ({
            sourceId: parseInt(l.sourceTransactionId) || 0,
            targetId: parseInt(l.destinationTransactionId) || 0,
        }));

        const matches = detectTransfers(candidates, accountContexts, existingLinkPairs);

        return c.json({
            matchesFound: matches.length,
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
        const nonTransferTxs = userTransactions.filter(t => !t.isTransfer);

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
        const gstTransactions = nonTransferTxs.filter(t => t.gstApplicable);
        const totalGST = gstTransactions.reduce((sum, t) => {
            return sum + (t.gstAmount || Math.round(Math.abs(t.amount) / 11));
        }, 0);

        return c.json({
            period,
            startDate,
            endDate,
            summary: {
                totalIncome: nonTransferTxs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                totalExpenses: nonTransferTxs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
                netFlow: nonTransferTxs.reduce((sum, t) => sum + t.amount, 0),
                transactionCount: nonTransferTxs.length,
                transferCount: userTransactions.length - nonTransferTxs.length,
            },
            gst: {
                gstTransactionCount: gstTransactions.length,
                totalGSTCollected: gstTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + (t.gstAmount || Math.round(t.amount / 11)), 0),
                totalGSTPaid: gstTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + (t.gstAmount || Math.round(Math.abs(t.amount) / 11)), 0),
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

const port = parseInt(process.env.PORT || '3501', 10);
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
})

