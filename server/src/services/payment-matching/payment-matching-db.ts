/**
 * Payment Matching — DB helper functions for match insertion
 */

import { db, ocrDocuments, paymentMatchRules, paymentMatches } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';
import type { MatchCandidate } from './types.js';

export async function insertMatchRecord(
  matchId: string,
  docId: string,
  candidate: MatchCandidate,
  method: string,
): Promise<void> {
  await db
    .insert(paymentMatches)
    .values({
      id: matchId,
      documentId: docId,
      transactionId: candidate.transactionId,
      ruleId: candidate.ruleId ?? null,
      matchScore: candidate.score.overallScore,
      matchMethod: method,
      amountDifference: candidate.score.amountDifference,
      dateDifference: candidate.score.dateDifference,
      status: 'confirmed',
      confirmedBy: 'system',
      confirmedAt: new Date().toISOString(),
    })
    .run();
  await db
    .update(ocrDocuments)
    .set({ status: 'matched', updatedAt: new Date().toISOString() })
    .where(eq(ocrDocuments.id, docId))
    .run();
}

export async function insertAutoMatchRecord(
  matchId: string,
  docId: string,
  candidate: MatchCandidate,
): Promise<void> {
  await db
    .insert(paymentMatches)
    .values({
      id: matchId,
      documentId: docId,
      transactionId: candidate.transactionId,
      matchScore: candidate.score.overallScore,
      matchMethod: 'auto_ai',
      amountDifference: candidate.score.amountDifference,
      dateDifference: candidate.score.dateDifference,
      status: 'confirmed',
      confirmedBy: 'system',
      confirmedAt: new Date().toISOString(),
    })
    .run();
  await db
    .update(ocrDocuments)
    .set({ status: 'matched', updatedAt: new Date().toISOString() })
    .where(eq(ocrDocuments.id, docId))
    .run();
}

export async function insertSuggestionRecord(
  matchId: string,
  docId: string,
  candidate: MatchCandidate,
): Promise<void> {
  await db
    .insert(paymentMatches)
    .values({
      id: matchId,
      documentId: docId,
      transactionId: candidate.transactionId,
      matchScore: candidate.score.overallScore,
      matchMethod: 'suggested',
      amountDifference: candidate.score.amountDifference,
      dateDifference: candidate.score.dateDifference,
      status: 'suggested',
    })
    .run();
}

export async function incrementRuleMatchCount(ruleId: string): Promise<void> {
  await db
    .update(paymentMatchRules)
    .set({
      matchCount: sql`${paymentMatchRules.matchCount} + 1`,
      lastMatchedAt: new Date().toISOString(),
    })
    .where(eq(paymentMatchRules.id, ruleId))
    .run();
}
