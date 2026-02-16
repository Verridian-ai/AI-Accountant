/**
 * Payment Matching Service
 * Multi-strategy engine for matching OCR-extracted documents to bank transactions.
 * Supports rule-based, AI-assisted, and manual matching with scoring and learning.
 */

import { db, ocrDocuments, paymentMatchRules, paymentMatches, transactions } from '../schema.js';
import { eq, and, desc, asc, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';

type OcrDocument = typeof ocrDocuments.$inferSelect;
type Transaction = typeof transactions.$inferSelect;
type PaymentMatchRule = typeof paymentMatchRules.$inferSelect;

// ============================================================================
// Type Definitions
// ============================================================================

export interface MatchCandidate {
  transactionId: string;
  transactionDate: string;
  transactionDescription: string;
  transactionAmount: number;
  score: MatchScore;
  ruleId?: string;
}

export interface MatchScore {
  overallScore: number;
  factors: {
    amount: number;
    date: number;
    vendor: number;
    rule: number;
  };
  amountDifference: number;
  dateDifference: number;
}

export interface AutoMatchResult {
  matched: number;
  suggested: number;
  unmatched: number;
  details: Array<{
    documentId: string;
    status: 'matched' | 'suggested' | 'unmatched';
    matchId?: string;
    topScore?: number;
  }>;
}

export interface MatchStats {
  totalDocuments: number;
  matched: number;
  pending: number;
  failed: number;
  matchRate: number;
  averageConfidence: number;
  topVendors: Array<{ name: string; count: number }>;
  ruleEffectiveness: Array<{
    ruleId: string;
    name: string;
    matchCount: number;
    lastMatched?: string;
  }>;
}

export interface CreateRuleParams {
  name: string;
  ruleType: 'exact_amount' | 'amount_range' | 'vendor_match' | 'recurring' | 'composite';
  vendorPattern?: string;
  amountExact?: number;
  amountMin?: number;
  amountMax?: number;
  amountTolerance?: number;
  dateToleranceDays?: number;
  categoryFilter?: string;
  priority?: number;
}

export interface MatchOptions {
  amountTolerance?: number;
  dateTolerance?: number;
  minScore?: number;
  limit?: number;
}

export interface AutoMatchOptions {
  autoMatchThreshold?: number;
  suggestThreshold?: number;
  applyRules?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const WEIGHT_AMOUNT = 0.4;
const WEIGHT_DATE = 0.25;
const WEIGHT_VENDOR = 0.2;
const WEIGHT_RULE = 0.15;

const DEFAULT_AMOUNT_TOLERANCE = 0.01;
const DEFAULT_DATE_TOLERANCE = 7;
const DEFAULT_AUTO_MATCH_THRESHOLD = 0.85;
const DEFAULT_SUGGEST_THRESHOLD = 0.6;
const DEFAULT_LIMIT = 10;

const COMMON_PREFIXES = [
  'payment to',
  'direct debit',
  'transfer to',
  'transfer from',
  'deposit from',
  'eftpos',
  'visa purchase',
  'bpay',
  'osko payment',
  'pay anyone',
  'payroll',
];

// ============================================================================
// Service Class
// ============================================================================

export class PaymentMatchingService {
  // --------------------------------------------------------------------------
  // Match Candidate Discovery
  // --------------------------------------------------------------------------

  async findMatchCandidates(documentId: string, options?: MatchOptions): Promise<MatchCandidate[]> {
    const amountTolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
    const dateTolerance = options?.dateTolerance ?? DEFAULT_DATE_TOLERANCE;
    const minScore = options?.minScore ?? 0;
    const limit = options?.limit ?? DEFAULT_LIMIT;

    // Fetch the OCR document
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();

    if (!doc) {
      return [];
    }

    const docAmount = doc.totalAmount ?? 0;
    const docDate = doc.documentDate ?? '';
    const docVendor = doc.vendorName ?? '';

    // Multi-pass candidate discovery — collect unique transaction IDs
    const candidateMap = new Map<string, MatchCandidate>();

    // Pass 1: Amount match (within tolerance)
    if (docAmount > 0) {
      const amountLow = docAmount - amountTolerance;
      const amountHigh = docAmount + amountTolerance;

      const amountMatches = await db
        .select()
        .from(transactions)
        .where(
          and(
            sql`ABS(${transactions.amount}) >= ${amountLow}`,
            sql`ABS(${transactions.amount}) <= ${amountHigh}`,
          ),
        )
        .all();

      for (const tx of amountMatches) {
        candidateMap.set(tx.id, tx);
      }
    }

    // Pass 2: Date range filter (within tolerance days)
    if (docDate) {
      const dateObj = new Date(docDate);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - dateTolerance);
      const endDate = new Date(dateObj);
      endDate.setDate(endDate.getDate() + dateTolerance);

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const dateMatches = await db
        .select()
        .from(transactions)
        .where(
          and(sql`${transactions.date} >= ${startStr}`, sql`${transactions.date} <= ${endStr}`),
        )
        .all();

      for (const tx of dateMatches) {
        candidateMap.set(tx.id, tx);
      }
    }

    // Pass 3: Vendor name match (fuzzy LIKE)
    if (docVendor) {
      const normalizedVendor = this.normalizeString(docVendor);
      if (normalizedVendor.length > 2) {
        const vendorMatches = await db
          .select()
          .from(transactions)
          .where(sql`LOWER(${transactions.description}) LIKE ${'%' + normalizedVendor + '%'}`)
          .all();

        for (const tx of vendorMatches) {
          candidateMap.set(tx.id, tx);
        }
      }
    }

    // Score each candidate
    const candidates: MatchCandidate[] = [];
    for (const tx of candidateMap.values()) {
      const score = await this.scoreMatch(doc, tx);

      if (score.overallScore >= minScore) {
        candidates.push({
          transactionId: tx.id,
          transactionDate: tx.date,
          transactionDescription: tx.description,
          transactionAmount: tx.amount,
          score,
        });
      }
    }

    // Sort by score DESC, take top N
    candidates.sort((a, b) => b.score.overallScore - a.score.overallScore);
    return candidates.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Match Scoring
  // --------------------------------------------------------------------------

  async scoreMatch(document: OcrDocument, transaction: Transaction): Promise<MatchScore> {
    const docAmount = document.totalAmount ?? 0;
    const txAmount = Math.abs(transaction.amount ?? 0);

    // Amount factor (40%)
    let amountFactor = 0;
    if (docAmount > 0) {
      amountFactor = Math.max(0, Math.min(1, 1.0 - Math.abs(docAmount - txAmount) / docAmount));
    } else if (txAmount === 0) {
      amountFactor = 1.0;
    }

    // Date factor (25%)
    let dateFactor = 0;
    let daysDiff = DEFAULT_DATE_TOLERANCE;
    const docDate = document.documentDate ?? '';
    const txDate = transaction.date ?? '';
    if (docDate && txDate) {
      const docDateObj = new Date(docDate);
      const txDateObj = new Date(txDate);
      daysDiff = Math.abs(
        Math.round((docDateObj.getTime() - txDateObj.getTime()) / (1000 * 60 * 60 * 24)),
      );
      dateFactor = Math.max(0, Math.min(1, 1.0 - daysDiff / DEFAULT_DATE_TOLERANCE));
    }

    // Vendor factor (20%)
    const docVendor = document.vendorName ?? '';
    const txDesc = transaction.description ?? '';
    const vendorFactor = docVendor ? this.calculateSimilarity(docVendor, txDesc) : 0.5;

    // Rule factor (15%)
    let ruleFactor = 0;
    if (document.userId) {
      const matchingRule = await this.findMatchingRule(document);
      if (matchingRule) {
        ruleFactor = 1.0;
      }
    }

    const overallScore =
      amountFactor * WEIGHT_AMOUNT +
      dateFactor * WEIGHT_DATE +
      vendorFactor * WEIGHT_VENDOR +
      ruleFactor * WEIGHT_RULE;

    return {
      overallScore: Math.round(overallScore * 1000) / 1000,
      factors: {
        amount: Math.round(amountFactor * 1000) / 1000,
        date: Math.round(dateFactor * 1000) / 1000,
        vendor: Math.round(vendorFactor * 1000) / 1000,
        rule: Math.round(ruleFactor * 1000) / 1000,
      },
      amountDifference: Math.round((docAmount - txAmount) * 100) / 100,
      dateDifference: daysDiff,
    };
  }

  // --------------------------------------------------------------------------
  // String Similarity (private)
  // --------------------------------------------------------------------------

  private calculateSimilarity(a: string, b: string): number {
    const normA = this.normalizeString(a);
    const normB = this.normalizeString(b);

    if (!normA || !normB) return 0;
    if (normA === normB) return 1;

    // Token overlap
    const tokensA = new Set(normA.split(/\s+/).filter(Boolean));
    const tokensB = new Set(normB.split(/\s+/).filter(Boolean));
    const maxTokens = Math.max(tokensA.size, tokensB.size);

    let shared = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) shared++;
    }

    let score = maxTokens > 0 ? shared / maxTokens : 0;

    // Substring bonus
    if (normA.includes(normB) || normB.includes(normA)) {
      score = Math.min(1, score + 0.2);
    }

    return Math.max(0, Math.min(1, score));
  }

  private normalizeString(s: string): string {
    let normalized = s.toLowerCase().trim();
    for (const prefix of COMMON_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length).trim();
      }
    }
    return normalized
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --------------------------------------------------------------------------
  // Auto-Matching
  // --------------------------------------------------------------------------

  async autoMatch(userId: string, options?: AutoMatchOptions): Promise<AutoMatchResult> {
    const autoThreshold = options?.autoMatchThreshold ?? DEFAULT_AUTO_MATCH_THRESHOLD;
    const suggestThreshold = options?.suggestThreshold ?? DEFAULT_SUGGEST_THRESHOLD;
    const shouldApplyRules = options?.applyRules ?? true;

    // Fetch unmatched documents
    const unmatchedDocs = await db
      .select()
      .from(ocrDocuments)
      .where(and(eq(ocrDocuments.userId, userId), eq(ocrDocuments.status, 'extracted')))
      .all();

    const result: AutoMatchResult = {
      matched: 0,
      suggested: 0,
      unmatched: 0,
      details: [],
    };

    for (const doc of unmatchedDocs) {
      // Try rules first (higher priority)
      if (shouldApplyRules) {
        const ruleMatch = await this.applyRules(doc.id);
        if (ruleMatch) {
          const matchId = randomUUID();
          await db
            .insert(paymentMatches)
            .values({
              id: matchId,
              documentId: doc.id,
              transactionId: ruleMatch.transactionId,
              ruleId: ruleMatch.ruleId ?? null,
              matchScore: ruleMatch.score.overallScore,
              matchMethod: 'auto_rule',
              amountDifference: ruleMatch.score.amountDifference,
              dateDifference: ruleMatch.score.dateDifference,
              status: 'confirmed',
              confirmedBy: 'system',
              confirmedAt: new Date().toISOString(),
            })
            .run();

          await db
            .update(ocrDocuments)
            .set({ status: 'matched', updatedAt: new Date().toISOString() })
            .where(eq(ocrDocuments.id, doc.id))
            .run();

          // Increment rule match count
          if (ruleMatch.ruleId) {
            await db
              .update(paymentMatchRules)
              .set({
                matchCount: sql`${paymentMatchRules.matchCount} + 1`,
                lastMatchedAt: new Date().toISOString(),
              })
              .where(eq(paymentMatchRules.id, ruleMatch.ruleId))
              .run();
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

      // Find candidates via scoring
      const candidates = await this.findMatchCandidates(doc.id);

      if (candidates.length === 0) {
        result.unmatched++;
        result.details.push({ documentId: doc.id, status: 'unmatched' });
        continue;
      }

      const topCandidate = candidates[0];
      const topScore = topCandidate.score.overallScore;

      if (topScore >= autoThreshold) {
        // Auto-confirm
        const matchId = randomUUID();
        await db
          .insert(paymentMatches)
          .values({
            id: matchId,
            documentId: doc.id,
            transactionId: topCandidate.transactionId,
            matchScore: topScore,
            matchMethod: 'auto_ai',
            amountDifference: topCandidate.score.amountDifference,
            dateDifference: topCandidate.score.dateDifference,
            status: 'confirmed',
            confirmedBy: 'system',
            confirmedAt: new Date().toISOString(),
          })
          .run();

        await db
          .update(ocrDocuments)
          .set({ status: 'matched', updatedAt: new Date().toISOString() })
          .where(eq(ocrDocuments.id, doc.id))
          .run();

        result.matched++;
        result.details.push({
          documentId: doc.id,
          status: 'matched',
          matchId,
          topScore,
        });
      } else if (topScore >= suggestThreshold) {
        // Suggest
        const matchId = randomUUID();
        await db
          .insert(paymentMatches)
          .values({
            id: matchId,
            documentId: doc.id,
            transactionId: topCandidate.transactionId,
            matchScore: topScore,
            matchMethod: 'suggested',
            amountDifference: topCandidate.score.amountDifference,
            dateDifference: topCandidate.score.dateDifference,
            status: 'suggested',
          })
          .run();

        result.suggested++;
        result.details.push({
          documentId: doc.id,
          status: 'suggested',
          matchId,
          topScore,
        });
      } else {
        result.unmatched++;
        result.details.push({
          documentId: doc.id,
          status: 'unmatched',
          topScore,
        });
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

    if (!match) {
      throw new Error(`Match not found: ${matchId}`);
    }

    await db
      .update(paymentMatches)
      .set({
        status: 'confirmed',
        confirmedBy: confirmedBy ?? 'user',
        confirmedAt: new Date().toISOString(),
      })
      .where(eq(paymentMatches.id, matchId))
      .run();

    // Update document status
    await db
      .update(ocrDocuments)
      .set({ status: 'matched', updatedAt: new Date().toISOString() })
      .where(eq(ocrDocuments.id, match.documentId))
      .run();

    // Increment rule match count if rule was used
    if (match.ruleId) {
      await db
        .update(paymentMatchRules)
        .set({
          matchCount: sql`${paymentMatchRules.matchCount} + 1`,
          lastMatchedAt: new Date().toISOString(),
        })
        .where(eq(paymentMatchRules.id, match.ruleId))
        .run();
    }

    // Try to learn from this confirmation
    await this.learnFromConfirmation(matchId);

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

    if (!match) {
      throw new Error(`Match not found: ${matchId}`);
    }

    await db
      .update(paymentMatches)
      .set({
        status: 'rejected',
        notes: reason ?? null,
      })
      .where(eq(paymentMatches.id, matchId))
      .run();

    // Reset document status to 'extracted' for re-matching
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

    // Validate: amount rules need amount_exact or range
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

    const created = await db
      .select()
      .from(paymentMatchRules)
      .where(eq(paymentMatchRules.id, id))
      .get();

    return created;
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
    // Only allow safe fields to be updated
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
        allowedFields[key] = updates[key];
      }
    }

    if (Object.keys(allowedFields).length > 0) {
      await db
        .update(paymentMatchRules)
        .set(allowedFields)
        .where(eq(paymentMatchRules.id, ruleId))
        .run();
    }

    const updated = await db
      .select()
      .from(paymentMatchRules)
      .where(eq(paymentMatchRules.id, ruleId))
      .get();

    return updated;
  }

  async deleteRule(ruleId: string): Promise<void> {
    await db.delete(paymentMatchRules).where(eq(paymentMatchRules.id, ruleId)).run();
  }

  // --------------------------------------------------------------------------
  // Apply Rules
  // --------------------------------------------------------------------------

  async applyRules(documentId: string): Promise<MatchCandidate | null> {
    const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();

    if (!doc || !doc.userId) return null;

    const rules = await db
      .select()
      .from(paymentMatchRules)
      .where(and(eq(paymentMatchRules.userId, doc.userId), eq(paymentMatchRules.isActive, true)))
      .orderBy(asc(paymentMatchRules.priority))
      .all();

    for (const rule of rules) {
      const matched = this.documentMatchesRule(doc, rule);
      if (!matched) continue;

      // Find a matching transaction for this rule
      const txCandidates = await this.findTransactionsForRule(doc, rule);
      if (txCandidates.length === 0) continue;

      const bestTx = txCandidates[0];
      const score = await this.scoreMatch(doc, bestTx);

      return {
        transactionId: bestTx.id,
        transactionDate: bestTx.date,
        transactionDescription: bestTx.description,
        transactionAmount: bestTx.amount,
        score: {
          ...score,
          factors: { ...score.factors, rule: 1.0 },
          overallScore:
            score.factors.amount * WEIGHT_AMOUNT +
            score.factors.date * WEIGHT_DATE +
            score.factors.vendor * WEIGHT_VENDOR +
            1.0 * WEIGHT_RULE,
        },
        ruleId: rule.id,
      };
    }

    return null;
  }

  private documentMatchesRule(doc: OcrDocument, rule: PaymentMatchRule): boolean {
    const docAmount = doc.totalAmount ?? 0;
    const docVendor = doc.vendorName ?? '';

    switch (rule.ruleType) {
      case 'exact_amount': {
        const tolerance = rule.amountTolerance ?? 0.01;
        return Math.abs(docAmount - (rule.amountExact ?? 0)) <= tolerance;
      }
      case 'amount_range': {
        return docAmount >= (rule.amountMin ?? 0) && docAmount <= (rule.amountMax ?? Infinity);
      }
      case 'vendor_match': {
        if (!rule.vendorPattern || !docVendor) return false;
        const normVendor = this.normalizeString(docVendor);
        const normPattern = this.normalizeString(rule.vendorPattern);
        return normVendor.includes(normPattern) || normPattern.includes(normVendor);
      }
      case 'recurring': {
        // Check if similar document matched before
        if (!rule.vendorPattern) return false;
        const normVendor = this.normalizeString(docVendor);
        const normPattern = this.normalizeString(rule.vendorPattern);
        const amountMatch =
          rule.amountExact != null
            ? Math.abs(docAmount - rule.amountExact) <= (rule.amountTolerance ?? 0.01)
            : true;
        return (
          amountMatch && (normVendor.includes(normPattern) || normPattern.includes(normVendor))
        );
      }
      case 'composite': {
        // All conditions must match
        let pass = true;
        if (rule.amountExact != null) {
          pass = pass && Math.abs(docAmount - rule.amountExact) <= (rule.amountTolerance ?? 0.01);
        }
        if (rule.amountMin != null && rule.amountMax != null) {
          pass = pass && docAmount >= rule.amountMin && docAmount <= rule.amountMax;
        }
        if (rule.vendorPattern) {
          const normVendor = this.normalizeString(docVendor);
          const normPattern = this.normalizeString(rule.vendorPattern);
          pass = pass && (normVendor.includes(normPattern) || normPattern.includes(normVendor));
        }
        return pass;
      }
      default:
        return false;
    }
  }

  private async findTransactionsForRule(
    doc: OcrDocument,
    rule: PaymentMatchRule,
  ): Promise<Transaction[]> {
    const docAmount = doc.totalAmount ?? 0;
    const docDate = doc.documentDate ?? '';
    const dateTolerance = rule.dateToleranceDays ?? DEFAULT_DATE_TOLERANCE;

    const conditions: SQL[] = [];

    // Amount filtering
    if (rule.amountExact != null) {
      const tolerance = rule.amountTolerance ?? 0.01;
      conditions.push(sql`ABS(ABS(${transactions.amount}) - ${rule.amountExact}) <= ${tolerance}`);
    } else if (docAmount > 0) {
      const tolerance = rule.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
      conditions.push(sql`ABS(ABS(${transactions.amount}) - ${docAmount}) <= ${tolerance}`);
    }

    // Date filtering
    if (docDate) {
      const dateObj = new Date(docDate);
      const start = new Date(dateObj);
      start.setDate(start.getDate() - dateTolerance);
      const end = new Date(dateObj);
      end.setDate(end.getDate() + dateTolerance);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      conditions.push(sql`${transactions.date} >= ${startStr}`);
      conditions.push(sql`${transactions.date} <= ${endStr}`);
    }

    // Vendor filtering
    if (rule.vendorPattern) {
      const normPattern = this.normalizeString(rule.vendorPattern);
      if (normPattern.length > 2) {
        conditions.push(sql`LOWER(${transactions.description}) LIKE ${'%' + normPattern + '%'}`);
      }
    }

    // Category filtering
    if (rule.categoryFilter) {
      conditions.push(eq(transactions.category, rule.categoryFilter));
    }

    if (conditions.length === 0) return [];

    return db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .all();
  }

  // --------------------------------------------------------------------------
  // Match Learning
  // --------------------------------------------------------------------------

  async learnFromConfirmation(matchId: string): Promise<void> {
    const match = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.id, matchId))
      .get();

    if (!match || match.status !== 'confirmed') return;

    // Get the document
    const doc = await db
      .select()
      .from(ocrDocuments)
      .where(eq(ocrDocuments.id, match.documentId))
      .get();

    if (!doc || !doc.vendorName || !doc.userId) return;

    const vendorNorm = this.normalizeString(doc.vendorName);
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

      if (mDoc?.vendorName && this.normalizeString(mDoc.vendorName) === vendorNorm) {
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
          and(
            eq(paymentMatchRules.userId, doc.userId),
            eq(paymentMatchRules.ruleType, 'recurring'),
          ),
        )
        .all();

      const alreadyExists = existingRules.some((r) => {
        const rulePattern = this.normalizeString(r.vendorPattern ?? '');
        return rulePattern === vendorNorm;
      });

      if (!alreadyExists) {
        const avgAmount = totalAmount / vendorMatchCount;
        await this.createRule(doc.userId, {
          name: `Auto: ${doc.vendorName}`,
          ruleType: 'recurring',
          vendorPattern: doc.vendorName,
          amountExact: Math.round(avgAmount * 100) / 100,
          amountTolerance: Math.round(avgAmount * 0.1 * 100) / 100, // 10% tolerance
          priority: 50,
        });
        console.log(`[PaymentMatching] Auto-created matching rule for ${doc.vendorName}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  async getMatchStats(userId: string): Promise<MatchStats> {
    // Total documents
    const allDocs = await db
      .select()
      .from(ocrDocuments)
      .where(eq(ocrDocuments.userId, userId))
      .all();

    const totalDocuments = allDocs.length;
    const matched = allDocs.filter((d) => d.status === 'matched').length;
    const pending = allDocs.filter((d) =>
      ['pending', 'processing', 'extracted'].includes(d.status),
    ).length;
    const failed = allDocs.filter((d) => d.status === 'failed').length;
    const matchRate = totalDocuments > 0 ? Math.round((matched / totalDocuments) * 10000) / 100 : 0;

    // Average confidence of confirmed matches
    const confirmedMatches = await db
      .select()
      .from(paymentMatches)
      .where(eq(paymentMatches.status, 'confirmed'))
      .all();

    // Filter to user's documents
    const userDocIds = new Set(allDocs.map((d) => d.id));
    const userMatches = confirmedMatches.filter((m) => userDocIds.has(m.documentId));
    const averageConfidence =
      userMatches.length > 0
        ? Math.round(
            (userMatches.reduce((sum: number, m) => sum + (m.matchScore ?? 0), 0) /
              userMatches.length) *
              1000,
          ) / 1000
        : 0;

    // Top vendors
    const vendorCounts = new Map<string, number>();
    for (const doc of allDocs.filter((d) => d.status === 'matched')) {
      const vendor = doc.vendorName ?? 'Unknown';
      vendorCounts.set(vendor, (vendorCounts.get(vendor) ?? 0) + 1);
    }
    const topVendors = Array.from(vendorCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Rule effectiveness
    const rules = await db
      .select()
      .from(paymentMatchRules)
      .where(eq(paymentMatchRules.userId, userId))
      .all();

    const ruleEffectiveness = rules.map((r) => ({
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

  private async findMatchingRule(doc: OcrDocument): Promise<PaymentMatchRule | null> {
    if (!doc.userId) return null;

    const rules = await db
      .select()
      .from(paymentMatchRules)
      .where(and(eq(paymentMatchRules.userId, doc.userId), eq(paymentMatchRules.isActive, true)))
      .orderBy(asc(paymentMatchRules.priority))
      .all();

    for (const rule of rules) {
      if (this.documentMatchesRule(doc, rule)) {
        return rule;
      }
    }

    return null;
  }
}

export const paymentMatchingService = new PaymentMatchingService();
