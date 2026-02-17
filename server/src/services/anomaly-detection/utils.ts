/**
 * Anomaly Detection Module — Shared Utility Functions
 */

import type { DescriptiveStats, RecurringPattern } from './types.js';

export function calculateStats(values: number[]): DescriptiveStats {
  if (values.length === 0) return { mean: 0, stdDev: 0, median: 0, q1: 0, q3: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  return {
    mean,
    stdDev: Math.sqrt(variance),
    median,
    q1: sorted[Math.floor(n * 0.25)] ?? 0,
    q3: sorted[Math.min(Math.floor(n * 0.75), n - 1)] ?? 0,
  };
}

export function daysBetween(dateA: string, dateB: string): number {
  return Math.abs(
    Math.round(
      (new Date(dateB.slice(0, 10)).getTime() - new Date(dateA.slice(0, 10)).getTime()) / 86400000,
    ),
  );
}

export function fuzzyAmountMatch(a: number, b: number, tolerancePct: number): boolean {
  if (a === b) return true;
  const maxAbs = Math.max(Math.abs(a), Math.abs(b));
  if (maxAbs === 0) return true;
  return (Math.abs(Math.abs(a) - Math.abs(b)) / maxAbs) * 100 <= tolerancePct;
}

export function merchantSimilarity(a: string, b: string): number {
  const normA = a
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  const normB = b
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;
  const tokensA = new Set(normA.split(/\s+/)),
    tokensB = new Set(normB.split(/\s+/));
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;
  const tokenScore = overlap / Math.max(tokensA.size, tokensB.size);
  const editDist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const charScore = maxLen > 0 ? 1 - editDist / maxLen : 1;
  return tokenScore * 0.6 + charScore * 0.4;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function categoryProportions(txns: any[]): Record<string, number> {
  const totals: Record<string, number> = {};
  let grandTotal = 0;
  for (const tx of txns) {
    const cat = tx.category ?? 'uncategorized';
    const abs = Math.abs(tx.amount);
    totals[cat] = (totals[cat] ?? 0) + abs;
    grandTotal += abs;
  }
  const proportions: Record<string, number> = {};
  if (grandTotal > 0) {
    for (const [cat, total] of Object.entries(totals))
      proportions[cat] = (total / grandTotal) * 100;
  }
  return proportions;
}

export function findRecurringPatterns(txns: any[]): RecurringPattern[] {
  const merchantGroups = new Map<string, any[]>();
  for (const tx of txns) {
    const merchant = (tx.merchantNormalized ?? tx.description ?? '').toLowerCase().trim();
    if (!merchant) continue;
    const list = merchantGroups.get(merchant) ?? [];
    list.push(tx);
    merchantGroups.set(merchant, list);
  }
  const patterns: RecurringPattern[] = [];
  for (const [merchant, group] of merchantGroups) {
    if (group.length < 3) continue;
    group.sort((a: any, b: any) => a.date.localeCompare(b.date));
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      const days = daysBetween(group[i - 1].date, group[i].date);
      if (days > 0) intervals.push(days);
    }
    if (intervals.length < 2) continue;
    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const intervalStats = calculateStats(intervals);
    const cv = intervalStats.mean > 0 ? intervalStats.stdDev / intervalStats.mean : Infinity;
    if (cv > 0.4 || avgInterval < 5 || avgInterval > 120) continue;
    const amounts = group.map((t: any) => Math.abs(t.amount));
    const avgAmount = amounts.reduce((s: number, a: number) => s + a, 0) / amounts.length;
    const lastDate = group[group.length - 1].date;
    const nextExpected = new Date(lastDate);
    nextExpected.setDate(nextExpected.getDate() + Math.round(avgInterval));
    patterns.push({
      merchant,
      averageAmount: Math.round(avgAmount),
      intervalDays: Math.round(avgInterval),
      lastOccurrence: lastDate,
      nextExpected: nextExpected.toISOString().slice(0, 10),
    });
  }
  return patterns;
}
