import { Hono } from 'hono';
import { z } from 'zod';
import { db, transactions, accounts, transferLinks } from '../schema.js';
import { eq } from 'drizzle-orm';
import { TransferDetector } from '../services/transfers/index.js';
import { persistTransferMatches, markOwnerContributions } from '../services/transfers/persistence.js';
import { events } from '../events.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

// POST /detect has no body — validates nothing from request, reads DB only
const _transferDetectSchema = z.object({}).optional();

const transferRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
transferRoutes.use('/*', tenantAuthMiddleware());

transferRoutes.post('/detect', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.userId;
  const allTxs = await db.select().from(transactions).where(eq(transactions.userId, userId)).all();
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  if (userAccounts.length < 2) return c.json({ message: 'Need 2+ accounts', matches: 0 });
  const existingLinks = await db.select().from(transferLinks).where(eq(transferLinks.userId, userId)).all();
  const existingPairs = existingLinks.map((l: any) => ({ sourceId: l.sourceTransactionId, targetId: l.destinationTransactionId })); // eslint-disable-line @typescript-eslint/no-explicit-any
  const detector = new TransferDetector();
  const matches = detector.detectTransfers(allTxs as any, userAccounts as any, existingPairs); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (matches.length === 0) return c.json({ message: 'No new matches', matches: 0, created: 0 });
  const result = await persistTransferMatches(matches, { userId });
  for (let i = 0; i < matches.length; i++) {
    if (result.linkIds[i]) events.emitTransferDetected({ sourceAccountId: String(matches[i].sourceTransaction.accountId), destinationAccountId: String(matches[i].targetTransaction.accountId), amount: Math.abs(matches[i].sourceTransaction.amount), confidence: matches[i].confidence, linkId: result.linkIds[i] });
  }
  const ownerContribIds: string[] = [];
  for (const m of matches) {
    const src = userAccounts.find((a: any) => a.id === m.sourceTransaction.accountId); // eslint-disable-line @typescript-eslint/no-explicit-any
    const dst = userAccounts.find((a: any) => a.id === m.targetTransaction.accountId); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (src?.ownershipTag === 'personal' && dst?.ownershipTag !== 'personal') ownerContribIds.push(String(m.targetTransaction.id));
  }
  if (ownerContribIds.length > 0) await markOwnerContributions(ownerContribIds);
  events.emit('update', { type: 'transactions_updated' });
  return c.json({ message: `Detected ${matches.length} transfers`, created: result.created });
});

export default transferRoutes;