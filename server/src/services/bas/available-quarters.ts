/**
 * BAS available quarters — self-contained implementation.
 * Enumerates quarters by fixed boundary dates (not 3-month jumps) to avoid skipping.
 */
import { db, transactions } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Get available quarters for a user (based on transaction dates).
 * Uses explicit quarter boundary enumeration to avoid the 3-month-jump bug
 * where quarters at the edges of the date range could be skipped.
 */
export async function getAvailableQuarters(
  userId: string,
): Promise<Array<{ financialYear: string; quarter: number }>> {
  const result = await db
    .select({
      minDate: sql<string>`MIN(${transactions.date})`,
      maxDate: sql<string>`MAX(${transactions.date})`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .get();

  if (!result?.minDate || !result?.maxDate) {
    return [];
  }

  const minDate = new Date(result.minDate);
  const maxDate = new Date(result.maxDate);
  const quarters: Array<{ financialYear: string; quarter: number }> = [];

  // Determine FY range to scan: minDate could be as early as FY starting 2019,
  // maxDate could be as late as current year + 1
  const minYear = minDate.getFullYear() - 1; // cover edge: Dec 31 → FY starts prev year
  const maxYear = maxDate.getFullYear() + 1;

  for (let fyStartYear = minYear; fyStartYear <= maxYear; fyStartYear++) {
    const fyStr = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
    const quarterBounds = [
      { q: 1, start: new Date(`${fyStartYear}-07-01`), end: new Date(`${fyStartYear}-09-30`) },
      { q: 2, start: new Date(`${fyStartYear}-10-01`), end: new Date(`${fyStartYear}-12-31`) },
      {
        q: 3,
        start: new Date(`${fyStartYear + 1}-01-01`),
        end: new Date(`${fyStartYear + 1}-03-31`),
      },
      {
        q: 4,
        start: new Date(`${fyStartYear + 1}-04-01`),
        end: new Date(`${fyStartYear + 1}-06-30`),
      },
    ];

    for (const { q, start, end } of quarterBounds) {
      // Quarter overlaps with the transaction date range
      if (start <= maxDate && end >= minDate) {
        quarters.push({ financialYear: fyStr, quarter: q });
      }
    }
  }

  // Sort descending: newest quarter first
  return quarters.sort((a, b) => {
    if (a.financialYear !== b.financialYear) return b.financialYear.localeCompare(a.financialYear);
    return b.quarter - a.quarter;
  });
}
