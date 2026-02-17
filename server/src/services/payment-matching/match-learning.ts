/**
 * Payment Matching - Match Learning
 * Learns from confirmed matches to auto-create rules for recurring vendors
 */

import { db, ocrDocuments, paymentMatchRules, paymentMatches } from '../../schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../lib/logger.js';

import type { PaymentMatchRule, CreateRuleParams } from './types.js';
import { normalizeString } from './scoring.js';

// --------------------------------------------------------------------------
// Match Learning
// --------------------------------------------------------------------------

export async function learnFromConfirmation(
  matchId: string,
  createRuleFn: (userId: string, params: CreateRuleParams) => Promise<PaymentMatchRule>,
): Promise<void> {
  const match = await db.select().from(paymentMatches).where(eq(paymentMatches.id, matchId)).get();

  if (!match || match.status !== 'confirmed') return;

  // Get the document
  const doc = await db
    .select()
    .from(ocrDocuments)
    .where(eq(ocrDocuments.id, match.documentId))
    .get();

  if (!doc || !doc.vendorName || !doc.userId) return;

  const vendorNorm = normalizeString(doc.vendorName);
  if (!vendorNorm) return;

  // Count similar confirmed matches for same vendor
  const similarMatches = await db
    .select({
      id: paymentMatches.id,
      matchScore: paymentMatches.matchScore,
      documentId: paymentMatches.documentId,
    })
    .from(paymentMatches)
    .where(eq(paymentMatches.status, 'confirmed'))
    .all();

  // Filter for matches where the document had the same vendor
  let vendorMatchCount = 0;
  let totalAmount = 0;

  for (const m of similarMatches) {
    const mDoc = await db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.id, m.documentId), eq(ocrDocuments.userId, doc.userId)))
      .get();

    if (mDoc?.vendorName && normalizeString(mDoc.vendorName) === vendorNorm) {
      vendorMatchCount++;
      totalAmount += mDoc.totalAmount ?? 0;
    }
  }

  // Auto-create rule after 3+ similar matches
  if (vendorMatchCount >= 3) {
    // Check if a rule already exists for this vendor
    const existingRules = await db
      .select()
      .from(paymentMatchRules)
      .where(
        and(eq(paymentMatchRules.userId, doc.userId), eq(paymentMatchRules.ruleType, 'recurring')),
      )
      .all();

    const alreadyExists = existingRules.some((r: (typeof existingRules)[number]) => {
      const rulePattern = normalizeString(r.vendorPattern ?? '');
      return rulePattern === vendorNorm;
    });

    if (!alreadyExists) {
      const avgAmount = totalAmount / vendorMatchCount;
      await createRuleFn(doc.userId, {
        name: `Auto: ${doc.vendorName}`,
        ruleType: 'recurring',
        vendorPattern: doc.vendorName,
        amountExact: Math.round(avgAmount * 100) / 100,
        amountTolerance: Math.round(avgAmount * 0.1 * 100) / 100, // 10% tolerance
        priority: 50,
      });
      logger.info(`[PaymentMatching] Auto-created matching rule for ${doc.vendorName}`);
    }
  }
}
