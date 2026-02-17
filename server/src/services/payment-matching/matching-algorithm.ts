/**
 * Payment Matching - Core Matching Algorithm
 * Candidate discovery, rule application, and transaction search
 */

import { db, ocrDocuments, paymentMatchRules, transactions } from '../../schema.js';
import { eq, and, desc, asc, sql, type SQL } from 'drizzle-orm';

import type {
  OcrDocument,
  Transaction,
  PaymentMatchRule,
  MatchCandidate,
  MatchOptions,
} from './types.js';
import {
  WEIGHT_AMOUNT,
  WEIGHT_DATE,
  WEIGHT_VENDOR,
  WEIGHT_RULE,
  DEFAULT_AMOUNT_TOLERANCE,
  DEFAULT_DATE_TOLERANCE,
  DEFAULT_LIMIT,
} from './types.js';
import { scoreMatch, normalizeString, documentMatchesRule } from './scoring.js';

// --------------------------------------------------------------------------
// Match Candidate Discovery
// --------------------------------------------------------------------------

export async function findMatchCandidates(
  documentId: string,
  options?: MatchOptions,
): Promise<MatchCandidate[]> {
  const amountTolerance = options?.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
  const dateTolerance = options?.dateTolerance ?? DEFAULT_DATE_TOLERANCE;
  const minScore = options?.minScore ?? 0;
  const limit = options?.limit ?? DEFAULT_LIMIT;

  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc) return [];

  const docAmount = doc.totalAmount ?? 0;
  const docDate = doc.documentDate ?? '';
  const docVendor = doc.vendorName ?? '';
  const candidateMap = new Map<string, Transaction>();

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
    for (const tx of amountMatches) candidateMap.set(tx.id, tx);
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
      .where(and(sql`${transactions.date} >= ${startStr}`, sql`${transactions.date} <= ${endStr}`))
      .all();
    for (const tx of dateMatches) candidateMap.set(tx.id, tx);
  }

  // Pass 3: Vendor name match (fuzzy LIKE)
  if (docVendor) {
    const normalizedVendor = normalizeString(docVendor);
    if (normalizedVendor.length > 2) {
      const vendorMatches = await db
        .select()
        .from(transactions)
        .where(sql`LOWER(${transactions.description}) LIKE ${'%' + normalizedVendor + '%'}`)
        .all();
      for (const tx of vendorMatches) candidateMap.set(tx.id, tx);
    }
  }

  // Score each candidate
  const candidates: MatchCandidate[] = [];
  for (const tx of candidateMap.values()) {
    const score = await scoreMatch(doc, tx);
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

  candidates.sort((a, b) => b.score.overallScore - a.score.overallScore);
  return candidates.slice(0, limit);
}

// --------------------------------------------------------------------------
// Apply Rules
// --------------------------------------------------------------------------

export async function applyRules(documentId: string): Promise<MatchCandidate | null> {
  const doc = await db.select().from(ocrDocuments).where(eq(ocrDocuments.id, documentId)).get();
  if (!doc || !doc.userId) return null;

  const rules = await db
    .select()
    .from(paymentMatchRules)
    .where(and(eq(paymentMatchRules.userId, doc.userId), eq(paymentMatchRules.isActive, true)))
    .orderBy(asc(paymentMatchRules.priority))
    .all();

  for (const rule of rules) {
    if (!documentMatchesRule(doc, rule)) continue;

    const txCandidates = await findTransactionsForRule(doc, rule);
    if (txCandidates.length === 0) continue;

    const bestTx = txCandidates[0];
    const score = await scoreMatch(doc, bestTx);

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

// --------------------------------------------------------------------------
// Find Transactions for Rule
// --------------------------------------------------------------------------

export async function findTransactionsForRule(
  doc: OcrDocument,
  rule: PaymentMatchRule,
): Promise<Transaction[]> {
  const docAmount = doc.totalAmount ?? 0;
  const docDate = doc.documentDate ?? '';
  const dateTolerance = rule.dateToleranceDays ?? DEFAULT_DATE_TOLERANCE;
  const conditions: SQL[] = [];

  if (rule.amountExact != null) {
    const tolerance = rule.amountTolerance ?? 0.01;
    conditions.push(sql`ABS(ABS(${transactions.amount}) - ${rule.amountExact}) <= ${tolerance}`);
  } else if (docAmount > 0) {
    const tolerance = rule.amountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;
    conditions.push(sql`ABS(ABS(${transactions.amount}) - ${docAmount}) <= ${tolerance}`);
  }

  if (docDate) {
    const dateObj = new Date(docDate);
    const start = new Date(dateObj);
    start.setDate(start.getDate() - dateTolerance);
    const end = new Date(dateObj);
    end.setDate(end.getDate() + dateTolerance);
    conditions.push(sql`${transactions.date} >= ${start.toISOString().split('T')[0]}`);
    conditions.push(sql`${transactions.date} <= ${end.toISOString().split('T')[0]}`);
  }

  if (rule.vendorPattern) {
    const normPattern = normalizeString(rule.vendorPattern);
    if (normPattern.length > 2) {
      conditions.push(sql`LOWER(${transactions.description}) LIKE ${'%' + normPattern + '%'}`);
    }
  }

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
