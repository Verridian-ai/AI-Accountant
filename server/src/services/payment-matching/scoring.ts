/**
 * Payment Matching - Scoring and String Similarity
 * Match scoring logic and vendor string normalization/comparison
 */

import { db, paymentMatchRules } from '../../schema.js';
import { eq, and, asc } from 'drizzle-orm';

import type { OcrDocument, Transaction, PaymentMatchRule, MatchScore } from './types.js';
import {
  WEIGHT_AMOUNT,
  WEIGHT_DATE,
  WEIGHT_VENDOR,
  WEIGHT_RULE,
  DEFAULT_DATE_TOLERANCE,
  COMMON_PREFIXES,
} from './types.js';

// --------------------------------------------------------------------------
// Match Scoring
// --------------------------------------------------------------------------

export async function scoreMatch(
  document: OcrDocument,
  transaction: Transaction,
): Promise<MatchScore> {
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
  const vendorFactor = docVendor ? calculateSimilarity(docVendor, txDesc) : 0.5;

  // Rule factor (15%)
  let ruleFactor = 0;
  if (document.userId) {
    const matchingRule = await findMatchingRule(document);
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
// String Similarity
// --------------------------------------------------------------------------

export function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

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

export function normalizeString(s: string): string {
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
// Private Helper: Find Matching Rule
// --------------------------------------------------------------------------

export async function findMatchingRule(doc: OcrDocument): Promise<PaymentMatchRule | null> {
  if (!doc.userId) return null;

  const rules = await db
    .select()
    .from(paymentMatchRules)
    .where(and(eq(paymentMatchRules.userId, doc.userId), eq(paymentMatchRules.isActive, true)))
    .orderBy(asc(paymentMatchRules.priority))
    .all();

  for (const rule of rules) {
    if (documentMatchesRule(doc, rule)) {
      return rule;
    }
  }

  return null;
}

// --------------------------------------------------------------------------
// Document-Rule Matching
// --------------------------------------------------------------------------

export function documentMatchesRule(doc: OcrDocument, rule: PaymentMatchRule): boolean {
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
      const normVendor = normalizeString(docVendor);
      const normPattern = normalizeString(rule.vendorPattern);
      return normVendor.includes(normPattern) || normPattern.includes(normVendor);
    }
    case 'recurring': {
      // Check if similar document matched before
      if (!rule.vendorPattern) return false;
      const normVendor = normalizeString(docVendor);
      const normPattern = normalizeString(rule.vendorPattern);
      const amountMatch =
        rule.amountExact != null
          ? Math.abs(docAmount - rule.amountExact) <= (rule.amountTolerance ?? 0.01)
          : true;
      return amountMatch && (normVendor.includes(normPattern) || normPattern.includes(normVendor));
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
        const normVendor = normalizeString(docVendor);
        const normPattern = normalizeString(rule.vendorPattern);
        pass = pass && (normVendor.includes(normPattern) || normPattern.includes(normVendor));
      }
      return pass;
    }
    default:
      return false;
  }
}
