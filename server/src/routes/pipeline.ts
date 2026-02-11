/**
 * Pipeline Integration Routes
 *
 * Endpoints for transfer detection, enrichment, and BAS pre-fill.
 */

import { Hono } from 'hono';
import { db, transactions, accounts, transferLinks, merchantMemory } from '../schema.js';
import { eq, and, gte, lte, like } from 'drizzle-orm';
import { TransferDetector, type TransferCandidate, type AccountContext } from '../services/transfers/index.js';
import { persistTransferMatches, markOwnerContributions } from '../services/transfers/persistence.js';
import { enrichmentService } from '../services/enrichment.js';
import { orchestrator } from '../services/claude/orchestrator.js';
import { BASService } from '../services/bas.js';
import { events } from '../events.js';

const pipelineRoutes = new Hono();
const basService = new BASService();

// ============================================================================
// TRANSFER DETECTION
// ============================================================================

/**
 * POST /api/transfers/detect
 * Trigger transfer detection across all user accounts.
 */
pipelineRoutes.post('/transfers/detect', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        // Get all user transactions
        const allTxs = await db.select().from(transactions)
            .where(eq(transactions.userId, userId)).all();

        // Get all user accounts
        const userAccounts = await db.select().from(accounts)
            .where(eq(accounts.userId, userId)).all();

        if (userAccounts.length < 2) {
            return c.json({
                message: 'Need at least 2 accounts for transfer detection',
                matches: 0,
            });
        }

        // Get existing links to avoid duplicates
        const existingLinks = await db.select().from(transferLinks)
            .where(eq(transferLinks.userId, userId)).all();
        const existingPairs = existingLinks.map((l: any) => ({
            sourceId: l.sourceTransactionId as any,
            targetId: l.destinationTransactionId as any,
        }));

        // Convert to transfer detection format
        const candidates: TransferCandidate[] = allTxs.map((t: any) => ({
            id: t.id,
            accountId: t.accountId || '',
            date: t.date,
            description: t.description,
            amount: t.amount,
            isLinked: t.isTransfer || false,
            linkedTransactionId: t.transferLinkId || undefined,
        }));

        const accountContexts: AccountContext[] = userAccounts.map((a: any) => ({
            id: a.id,
            accountNumber: a.accountNumber,
            bankId: a.bankName || '',
            accountName: a.accountName,
            accountType: a.accountType,
            ownershipTag: a.ownershipTag || 'business',
        }));

        const detector = new TransferDetector();
        const matches = detector.detectTransfers(candidates, accountContexts, existingPairs);

        if (matches.length === 0) {
            return c.json({ message: 'No new transfers detected', matches: 0, created: 0 });
        }

        // Persist matches
        const result = await persistTransferMatches(matches, { userId });

        // Emit SSE events
        for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const linkId = result.linkIds[i];
            if (linkId) {
                events.emitTransferDetected({
                    sourceAccountId: String(m.sourceTransaction.accountId),
                    destinationAccountId: String(m.targetTransaction.accountId),
                    amount: Math.abs(m.sourceTransaction.amount),
                    confidence: m.confidence,
                    linkId,
                });
            }
        }

        // Detect and mark owner contributions (personal → business)
        const ownerContribIds: string[] = [];
        for (const m of matches) {
            const srcAcct = userAccounts.find((a: any) => a.id === m.sourceTransaction.accountId || String(a.id) === String(m.sourceTransaction.accountId));
            const dstAcct = userAccounts.find((a: any) => a.id === m.targetTransaction.accountId || String(a.id) === String(m.targetTransaction.accountId));
            if ((srcAcct as any)?.ownershipTag === 'personal' && (dstAcct as any)?.ownershipTag !== 'personal') {
                ownerContribIds.push(String(m.targetTransaction.id));
            }
        }
        if (ownerContribIds.length > 0) {
            await markOwnerContributions(ownerContribIds);
        }

        events.emit('update', { type: 'transactions_updated' });

        return c.json({
            message: `Detected ${matches.length} transfers`,
            matchesFound: matches.length,
            matches: matches.length,
            persisted: result.created,
            created: result.created,
            skipped: result.skipped,
            ownerContributions: ownerContribIds.length,
            errors: result.errors,
        });
    } catch (err) {
        console.error('Transfer detection failed:', err);
        return c.json({ error: 'Transfer detection failed' }, 500);
    }
});

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * POST /api/enrichment/run
 * Trigger batch enrichment for uncategorized transactions.
 */
pipelineRoutes.post('/enrichment/run', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;

        const result = await enrichmentService.enrichUncategorized(userId);

        events.emit('update', { type: 'transactions_updated' });

        return c.json({
            message: 'Enrichment complete',
            ...result,
        });
    } catch (err) {
        console.error('Enrichment failed:', err);
        return c.json({ error: 'Enrichment failed' }, 500);
    }
});

/**
 * POST /api/enrichment/batch
 * Enrich specific transaction IDs.
 */
pipelineRoutes.post('/enrichment/batch', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { transactionIds } = body;

        if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
            return c.json({ error: 'transactionIds array is required' }, 400);
        }

        const result = await enrichmentService.enrichTransactions(transactionIds, userId);

        events.emit('update', { type: 'transactions_updated' });

        return c.json({
            message: `Enriched ${result.enriched} transactions`,
            ...result,
        });
    } catch (err) {
        console.error('Batch enrichment failed:', err);
        return c.json({ error: 'Batch enrichment failed' }, 500);
    }
});

// ============================================================================
// BAS PRE-FILL
// ============================================================================

/**
 * GET /api/bas/prefill?period=YYYY-QN
 * Get BAS pre-fill data for a quarter.
 */
pipelineRoutes.get('/bas/prefill', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const period = c.req.query('period');

        if (!period) {
            return c.json({ error: 'period query parameter is required (format: YYYY-QN)' }, 400);
        }

        // Parse period (format: YYYY-Q1, YYYY-Q2, etc.)
        const match = period.match(/^(\d{4})-Q([1-4])$/);
        if (!match) {
            return c.json({ error: 'Invalid period format. Use YYYY-Q1, YYYY-Q2, etc.' }, 400);
        }

        const year = parseInt(match[1]);
        const quarter = parseInt(match[2]);
        const financialYear = `${year}-${(year + 1).toString().slice(2)}`;

        const result = await basService.calculateBAS(userId, financialYear, quarter, 'cash');

        // Map to pre-fill format
        const g5 = result.labels.G2 + result.labels.G3;
        const g6 = result.labels.G1 - g5;

        return c.json({
            period: `${financialYear}-Q${quarter}`,
            startDate: result.period.startDate,
            endDate: result.period.endDate,
            lodgementDue: result.period.lodgementDue,
            labels: {
                G1: result.labels.G1,
                G2: result.labels.G2,
                G3: result.labels.G3,
                G5: g5,
                G6: g6,
                G9: result.labels['1A'],
                G10: result.labels.G10,
                G11: result.labels.G11,
                G12: result.labels.G10 + result.labels.G11,
                G19: result.labels['1B'],
                G20: result.labels['1A'] - result.labels['1B'],
                '1A': result.labels['1A'],
                '1B': result.labels['1B'],
                W1: result.labels.W1,
                W2: result.labels.W2,
                '5A': result.labels['5A'],
                '7C': result.labels['7C'],
                '7D': result.labels['7D'],
            },
            netGst: result.netGst,
            totalPayable: result.totalPayable,
            isRefund: result.isRefund,
            transactionCount: result.transactionCount,
        });
    } catch (err) {
        console.error('BAS prefill failed:', err);
        return c.json({ error: 'BAS prefill calculation failed' }, 500);
    }
});

// ============================================================================
// SINGLE TRANSACTION ENRICHMENT
// ============================================================================

/**
 * POST /api/enrichment/transaction/:id
 * Enrich a single transaction by ID.
 */
pipelineRoutes.post('/enrichment/transaction/:id', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const transactionId = c.req.param('id');

        // Verify transaction belongs to user
        const [tx] = await db.select().from(transactions)
            .where(and(
                eq(transactions.id, transactionId),
                eq(transactions.userId, userId)
            )).all();

        if (!tx) {
            return c.json({ error: 'Transaction not found' }, 404);
        }

        const result = await enrichmentService.enrichTransactions([transactionId], userId);

        events.emit('update', { type: 'transactions_updated' });

        return c.json({
            message: 'Transaction enriched',
            transactionId,
            ...result,
        });
    } catch (err) {
        console.error('Single transaction enrichment failed:', err);
        return c.json({ error: 'Transaction enrichment failed' }, 500);
    }
});

// ============================================================================
// MERCHANT MAPPINGS
// ============================================================================

/**
 * GET /api/merchants
 * List merchant memory mappings for the user.
 * Supports ?search= filter on merchant pattern or display name.
 */
pipelineRoutes.get('/merchants', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const search = c.req.query('search');

        let query = db.select().from(merchantMemory)
            .where(eq(merchantMemory.userId, userId));

        if (search) {
            const pattern = `%${search.toLowerCase()}%`;
            query = db.select().from(merchantMemory)
                .where(and(
                    eq(merchantMemory.userId, userId),
                    like(merchantMemory.merchantPattern, pattern)
                )) as any;
        }

        const mappings = await query.all();

        return c.json({
            merchants: mappings.map((m: any) => ({
                id: m.id,
                pattern: m.merchantPattern,
                displayName: m.merchantDisplayName,
                category: m.category,
                gstRegistered: m.gstApplicable || false,
                timesUsed: m.timesUsed || 0,
                lastUsed: m.lastUsed,
                isUserConfirmed: m.isUserConfirmed || false,
            })),
            total: mappings.length,
        });
    } catch (err) {
        console.error('Merchant list failed:', err);
        return c.json({ error: 'Failed to list merchants' }, 500);
    }
});

/**
 * POST /api/merchants/batch-resolve
 * Batch-resolve merchant descriptions using the Merchant Intelligence agent.
 */
pipelineRoutes.post('/merchants/batch-resolve', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        const userId = payload.userId;
        const body = await c.req.json();
        const { descriptions } = body;

        if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
            return c.json({ error: 'descriptions array is required' }, 400);
        }

        if (!orchestrator.isEnabled()) {
            return c.json({ error: 'Claude agents are not enabled' }, 503);
        }

        // Get existing merchant mappings for context
        const existingMappings = await db.select().from(merchantMemory)
            .where(eq(merchantMemory.userId, userId)).all();

        const result = await orchestrator.invoke('merchant_intelligence', {
            merchants: descriptions.map((desc: string, i: number) => ({
                transactionId: i,
                description: desc,
                amount: 0,
            })),
            existingMappings: existingMappings.map((m: any) => ({
                pattern: m.merchantPattern,
                displayName: m.merchantDisplayName || m.merchantPattern,
                gstRegistered: m.gstApplicable || false,
                category: m.category,
            })),
        });

        return c.json({
            message: `Resolved ${result.results.length} merchants`,
            results: result.results,
            newMappings: result.newMappings,
        });
    } catch (err) {
        console.error('Merchant batch-resolve failed:', err);
        return c.json({ error: 'Merchant batch resolution failed' }, 500);
    }
});

export default pipelineRoutes;
