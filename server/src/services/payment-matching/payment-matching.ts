/**
 * Payment Matching Service Class
 * Thin orchestrator — delegates to sub-modules for all logic.
 */

import { db, ocrDocuments, paymentMatches } from '../../schema.js';
import { eq } from 'drizzle-orm';
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
import {
  insertMatchRecord,
  insertAutoMatchRecord,
  insertSuggestionRecord,
  incrementRuleMatchCount,
} from './payment-matching-db.js';
import {
  createMatchRule,
  listMatchRules,
  updateMatchRule,
  deleteMatchRule,
} from './payment-matching-rules.js';
import { getMatchStats as getMatchStatsImpl } from './payment-matching-stats.js';

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

  async autoMatch(userId: string, options?: AutoMatchOptions): Promise<AutoMatchResult> {
    const autoThreshold = options?.autoMatchThreshold ?? DEFAULT_AUTO_MATCH_THRESHOLD;
    const suggestThreshold = options?.suggestThreshold ?? DEFAULT_SUGGEST_THRESHOLD;
    const shouldApplyRules = options?.applyRules ?? true;

    const unmatchedDocs = await db
      .select()
      .from(ocrDocuments)
      .where(eq(ocrDocuments.userId, userId) as ReturnType<typeof eq>)
      .all();

    const result: AutoMatchResult = { matched: 0, suggested: 0, unmatched: 0, details: [] };

    for (const doc of unmatchedDocs) {
      if (doc.status !== 'extracted') continue;
      if (shouldApplyRules) {
        const ruleMatch = await applyRules(doc.id);
        if (ruleMatch) {
          const matchId = randomUUID();
          await insertMatchRecord(matchId, doc.id, ruleMatch, 'auto_rule');
          if (ruleMatch.ruleId) {
            await incrementRuleMatchCount(ruleMatch.ruleId);
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
        await insertAutoMatchRecord(matchId, doc.id, top);
        result.matched++;
        result.details.push({ documentId: doc.id, status: 'matched', matchId, topScore });
      } else if (topScore >= suggestThreshold) {
        const matchId = randomUUID();
        await insertSuggestionRecord(matchId, doc.id, top);
        result.suggested++;
        result.details.push({ documentId: doc.id, status: 'suggested', matchId, topScore });
      } else {
        result.unmatched++;
        result.details.push({ documentId: doc.id, status: 'unmatched', topScore });
      }
    }
    return result;
  }

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
      await incrementRuleMatchCount(match.ruleId);
    }
    await learnFromConfirmation(matchId, this.createRule.bind(this));
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
  }

  async createRule(userId: string, params: CreateRuleParams): Promise<PaymentMatchRule> {
    return createMatchRule(userId, params);
  }

  async listRules(userId: string, isActive?: boolean): Promise<PaymentMatchRule[]> {
    return listMatchRules(userId, isActive);
  }

  async updateRule(ruleId: string, updates: Record<string, unknown>): Promise<PaymentMatchRule> {
    return updateMatchRule(ruleId, updates);
  }

  async deleteRule(ruleId: string): Promise<void> {
    return deleteMatchRule(ruleId);
  }

  async getMatchStats(userId: string): Promise<MatchStats> {
    return getMatchStatsImpl(userId);
  }
}

export const paymentMatchingService = new PaymentMatchingService();
