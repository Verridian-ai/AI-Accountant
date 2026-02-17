/**
 * Payment Matching Service Class
 * Main PaymentMatchingService with auto-matching, confirmation, rule management, and statistics
 */

import { db, ocrDocuments, paymentMatchRules, paymentMatches } from '../../schema.js';
import { eq, and, asc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import type {
  PaymentMatchRule,
  MatchCandidate,
  MatchOptions,
  AutoMatchResult,
  AutoMatchOptions,
  MatchStats,
  CreateRuleParams,
  MatchScore,
  OcrDocument,
  Transaction,
} from './types.js';
import { DEFAULT_AUTO_MATCH_THRESHOLD, DEFAULT_SUGGEST_THRESHOLD } from './types.js';
import { scoreMatch } from './scoring.js';
import { findMatchCandidates, applyRules } from './matching-algorithm.js';
import { learnFromConfirmation } from './match-learning.js';

// ============================================================================
// Service Class
// ============================================================================

export class PaymentMatchingService {
  async findMatchCandidates(documentId: string, options?: MatchOptions): Promise<MatchCandidate[]> {
    return findMatchCandidates(documentId, options);
  }

  async scoreMatch(document: OcrDocument, transaction: Transaction): Promise<MatchScore> {
    return scoreMatch(document, transaction);
  }

  async applyRules(documentId: string): Promise<MatchCandidate | null> {
    return applyRules(documentId);
  }

  async learnFromConfirmation(matchId: string): Promise<void> {
    return learnFromConfirmation(matchId, this.createRule.bind(this));
  }

  // --------------------------------------------------------------------------
  // Auto-Matching
  // --------------------------------------------------------------------------

  async autoMatch(userId: string, options?: AutoMatchOptions): Promise<AutoMatchResult> {
    const autoThreshold = options?.autoMatchThreshold ?? DEFAULT_AUTO_MATCH_THRESHOLD;
    const suggestThreshold = options?.suggestThreshold ?? DEFAULT_SUGGEST_THRESHOLD;
    const shouldApplyRules = options?.applyRules ?? true;

    const unmatchedDocs = await db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.userId, userId), eq(ocrDocuments.status, 'extracted')))
      .all();

    const result: AutoMatchResult = { matched: 0, suggested: 0, unmatched: 0, details: [] };

    for (const doc of unmatchedDocs) {
      if (shouldApplyRules) {
        const ruleMatch = await applyRules(doc.id);
        if (ruleMatch) {
          const matchId = randomUUID();
          await this.insertMatch(matchId, doc.id, ruleMatch, 'auto_rule');
          if (ruleMatch.ruleId) {
            await this.incrementRuleCount(ruleMatch.ruleId);
          }
          result.matched++;
          result.details.push({
            documentId: doc.id,
            status: 'matched',
            matchId,
            topScore: ruleMatch.score.overallScore,
          });
          continue;
        }
      }

      const candidates = await findMatchCandidates(doc.id);
      if (candidates.length === 0) {
        result.unmatched++;
        result.details.push({ documentId: doc.id, status: 'unmatched' });
        continue;
      }

      const top = candidates[0];
      const topScore = top.score.overallScore;

      if (topScore >= autoThreshold) {
        const matchId = randomUUID();
        await this.insertAutoMatch(matchId, doc.id, top);
        result.matched++;
        result.details.push({ documentId: doc.id, status: 'matched', matchId, topScore });
      } else if (topScore >= suggestThreshold) {
        const matchId = randomUUID();
        await this.insertSuggestion(matchId, doc.id, top);
        result.suggested++;
        result.details.push({ documentId: doc.id, status: 'suggested', matchId, topScore });
      } else {
        result.unmatched++;
        result.details.push({ documentId: doc.id, status: 'unmatched', topScore });
      }
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // Match Confirmation / Rejection
  // --------------------------------------------------------------------------

  async confirmMatch(matchId: string, confirmedBy?: string): Promise<void> {
    const match = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.id, matchId))
      .get();
    if (!match) throw new Error(`Match not found: ${matchId}`);

    await db
      .update(paymentMatches)
      .set({
        status: 'confirmed',
        confirmedBy: confirmedBy ?? 'user',
        confirmedAt: new Date().toISOString(),
      })
      .where(eq(paymentMatches.id, matchId))
      .run();

    await db
      .update(ocrDocuments)
      .set({ status: 'matched', updatedAt: new Date().toISOString() })
      .where(eq(ocrDocuments.id, match.documentId))
      .run();

    if (match.ruleId) {
      await this.incrementRuleCount(match.ruleId);
    }
    await learnFromConfirmation(matchId, this.createRule.bind(this));

    const updated = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.id, matchId))
      .get();
    return updated;
  }

  async rejectMatch(matchId: string, reason?: string): Promise<void> {
    const match = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.id, matchId))
      .get();
    if (!match) throw new Error(`Match not found: ${matchId}`);

    await db
      .update(paymentMatches)
      .set({ status: 'rejected', notes: reason ?? null })
      .where(eq(paymentMatches.id, matchId))
      .run();

    await db
      .update(ocrDocuments)
      .set({ status: 'extracted', updatedAt: new Date().toISOString() })
      .where(eq(ocrDocuments.id, match.documentId))
      .run();

    const updated = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.id, matchId))
      .get();
    return updated;
  }

  // --------------------------------------------------------------------------
  // Rule Management
  // --------------------------------------------------------------------------

  async createRule(userId: string, params: CreateRuleParams): Promise<PaymentMatchRule> {
    const id = randomUUID();
    if (params.ruleType === 'exact_amount' && params.amountExact == null) {
      throw new Error('exact_amount rule requires amountExact');
    }
    if (
      params.ruleType === 'amount_range' &&
      (params.amountMin == null || params.amountMax == null)
    ) {
      throw new Error('amount_range rule requires amountMin and amountMax');
    }

    await db
      .insert(paymentMatchRules)
      .values({
        id,
        userId,
        name: params.name,
        ruleType: params.ruleType,
        vendorPattern: params.vendorPattern ?? null,
        amountExact: params.amountExact ?? null,
        amountMin: params.amountMin ?? null,
        amountMax: params.amountMax ?? null,
        amountTolerance: params.amountTolerance ?? 0.01,
        dateToleranceDays: params.dateToleranceDays ?? 7,
        categoryFilter: params.categoryFilter ?? null,
        priority: params.priority ?? 100,
        isActive: true,
        matchCount: 0,
      })
      .run();

    return db.select().from(paymentMatchRules).where(eq(paymentMatchRules.id, id)).get();
  }

  async listRules(userId: string, isActive?: boolean): Promise<PaymentMatchRule[]> {
    let query = db.select().from(paymentMatchRules).where(eq(paymentMatchRules.userId, userId));
    if (isActive !== undefined) {
      query = db
        .select()
        .from(paymentMatchRules)
        .where(and(eq(paymentMatchRules.userId, userId), eq(paymentMatchRules.isActive, isActive)));
    }
    return query.orderBy(asc(paymentMatchRules.priority)).all();
  }

  async updateRule(ruleId: string, updates: Record<string, unknown>): Promise<PaymentMatchRule> {
    const allowedFields: Partial<PaymentMatchRule> = {};
    const safeKeys = [
      'name',
      'ruleType',
      'vendorPattern',
      'amountExact',
      'amountMin',
      'amountMax',
      'amountTolerance',
      'dateToleranceDays',
      'categoryFilter',
      'priority',
      'isActive',
    ];
    for (const key of safeKeys) {
      if (key in updates) {
        (allowedFields as Record<string, unknown>)[key] = updates[key];
      }
    }
    if (Object.keys(allowedFields).length > 0) {
      await db
        .update(paymentMatchRules)
        .set(allowedFields)
        .where(eq(paymentMatchRules.id, ruleId))
        .run();
    }
    return db.select().from(paymentMatchRules).where(eq(paymentMatchRules.id, ruleId)).get();
  }

  async deleteRule(ruleId: string): Promise<void> {
    await db.delete(paymentMatchRules).where(eq(paymentMatchRules.id, ruleId)).run();
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  async getMatchStats(userId: string): Promise<MatchStats> {
    const allDocs = await db
      .select()
      .from(ocrDocuments)
      .where(eq(ocrDocuments.userId, userId))
      .all();
    const totalDocuments = allDocs.length;
    const matched = allDocs.filter((d: (typeof allDocs)[number]) => d.status === 'matched').length;
    const pending = allDocs.filter((d: (typeof allDocs)[number]) =>
      ['pending', 'processing', 'extracted'].includes(d.status),
    ).length;
    const failed = allDocs.filter((d: (typeof allDocs)[number]) => d.status === 'failed').length;
    const matchRate = totalDocuments > 0 ? Math.round((matched / totalDocuments) * 10000) / 100 : 0;

    const confirmedMatches = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.status, 'confirmed'))
      .all();
    const userDocIds = new Set(allDocs.map((d: (typeof allDocs)[number]) => d.id));
    const userMatches = confirmedMatches.filter((m: (typeof confirmedMatches)[number]) =>
      userDocIds.has(m.documentId),
    );
    const averageConfidence =
      userMatches.length > 0
        ? Math.round(
            (userMatches.reduce(
              (sum: number, m: (typeof userMatches)[number]) => sum + (m.matchScore ?? 0),
              0,
            ) /
              userMatches.length) *
              1000,
          ) / 1000
        : 0;

    const vendorCounts = new Map<string, number>();
    for (const doc of allDocs.filter((d: (typeof allDocs)[number]) => d.status === 'matched')) {
      const vendor = doc.vendorName ?? 'Unknown';
      vendorCounts.set(vendor, (vendorCounts.get(vendor) ?? 0) + 1);
    }
    const topVendors = Array.from(vendorCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const rules = await db
      .select()
      .from(paymentMatchRules)
      .where(eq(paymentMatchRules.userId, userId))
      .all();
    const ruleEffectiveness = rules.map((r: (typeof rules)[number]) => ({
      ruleId: r.id,
      name: r.name,
      matchCount: r.matchCount ?? 0,
      lastMatched: r.lastMatchedAt?.toString(),
    }));

    return {
      totalDocuments,
      matched,
      pending,
      failed,
      matchRate,
      averageConfidence,
      topVendors,
      ruleEffectiveness,
    };
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async insertMatch(
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

  private async insertAutoMatch(
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

  private async insertSuggestion(
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

  private async incrementRuleCount(ruleId: string): Promise<void> {
    await db
      .update(paymentMatchRules)
      .set({
        matchCount: sql`${paymentMatchRules.matchCount} + 1`,
        lastMatchedAt: new Date().toISOString(),
      })
      .where(eq(paymentMatchRules.id, ruleId))
      .run();
  }
}

export const paymentMatchingService = new PaymentMatchingService();
