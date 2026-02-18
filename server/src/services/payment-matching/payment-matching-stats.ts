/**
 * Payment Matching — Statistics
 */

import { db, ocrDocuments, paymentMatchRules, paymentMatches } from '../../schema.js';
import { eq } from 'drizzle-orm';
import type { MatchStats, OcrDocument, PaymentMatchRule } from './types.js';

interface PaymentMatchRow {
  documentId: string;
  matchScore: number | null;
}

export async function getMatchStats(userId: string): Promise<MatchStats> {
  const allDocs = (await db
    .select()
    .from(ocrDocuments)
    .where(eq(ocrDocuments.userId, userId))
    .all()) as OcrDocument[];

  const totalDocuments = allDocs.length;
  const matched = allDocs.filter((d) => d.status === 'matched').length;
  const pending = allDocs.filter((d) =>
    ['pending', 'processing', 'extracted'].includes(d.status),
  ).length;
  const failed = allDocs.filter((d) => d.status === 'failed').length;
  const matchRate = totalDocuments > 0 ? Math.round((matched / totalDocuments) * 10000) / 100 : 0;

  const confirmedMatches = (await db
    .select()
    .from(paymentMatches)
    .where(eq(paymentMatches.status, 'confirmed'))
    .all()) as PaymentMatchRow[];

  const userDocIds = new Set(allDocs.map((d) => d.id));
  const userMatches = confirmedMatches.filter((m) => userDocIds.has(m.documentId));
  const averageConfidence =
    userMatches.length > 0
      ? Math.round(
          (userMatches.reduce((sum, m) => sum + (m.matchScore ?? 0), 0) / userMatches.length) *
            1000,
        ) / 1000
      : 0;

  const vendorCounts = new Map<string, number>();
  for (const doc of allDocs.filter((d) => d.status === 'matched')) {
    const vendor = doc.vendorName ?? 'Unknown';
    vendorCounts.set(vendor, (vendorCounts.get(vendor) ?? 0) + 1);
  }
  const topVendors = Array.from(vendorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const rules = (await db
    .select()
    .from(paymentMatchRules)
    .where(eq(paymentMatchRules.userId, userId))
    .all()) as PaymentMatchRule[];

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
