import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db, transactions, accounts, transferLinks } from '../schema.js';
import { eq } from 'drizzle-orm';
import {
  TransferDetector,
  type TransferCandidate,
  type AccountContext,
} from '../services/transfers/index.js';
import {
  persistTransferMatches,
  markOwnerContributions,
} from '../services/transfers/persistence.js';
import { events } from '../events.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

// POST /detect has no body — validates nothing from request, reads DB only
const _transferDetectSchema = z.object({}).optional();

const transferRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
transferRoutes.use('/*', tenantAuthMiddleware());

transferRoutes.post('/detect', zValidator('json', z.object({}).optional()), async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const allTxs = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  if (userAccounts.length < 2) return c.json({ message: 'Need 2+ accounts', matches: 0 });
  const existingLinks = await db
    .select()
    .from(transferLinks)
    .where(eq(transferLinks.userId, userId));
  const existingPairs = existingLinks.map((l: Record<string, unknown>) => ({
    sourceId: parseInt(l.sourceTransactionId as string, 10) || 0,
    targetId: parseInt(l.destinationTransactionId as string, 10) || 0,
  }));
  const detector = new TransferDetector();
  const matches = detector.detectTransfers(
    allTxs as unknown as TransferCandidate[],
    userAccounts as unknown as AccountContext[],
    existingPairs,
  );
  if (matches.length === 0) return c.json({ message: 'No new matches', matches: 0, created: 0 });
  const result = await persistTransferMatches(matches, { userId });
  for (let i = 0; i < matches.length; i++) {
    if (result.linkIds[i])
      events.emitTransferDetected({
        sourceAccountId: String(matches[i].sourceTransaction.accountId),
        destinationAccountId: String(matches[i].targetTransaction.accountId),
        amount: Math.abs(matches[i].sourceTransaction.amount),
        confidence: matches[i].confidence,
        linkId: result.linkIds[i],
      });
  }
  const ownerContribIds: string[] = [];
  for (const m of matches) {
    const src = userAccounts.find(
      (a: Record<string, unknown>) => a.id === m.sourceTransaction.accountId,
    );
    const dst = userAccounts.find(
      (a: Record<string, unknown>) => a.id === m.targetTransaction.accountId,
    );
    if (src?.ownershipTag === 'personal' && dst?.ownershipTag !== 'personal')
      ownerContribIds.push(String(m.targetTransaction.id));
  }
  if (ownerContribIds.length > 0) await markOwnerContributions(ownerContribIds);
  events.emit('update', { type: 'transactions_updated' });
  return c.json({ message: `Detected ${matches.length} transfers`, created: result.created });
});

export default transferRoutes;
