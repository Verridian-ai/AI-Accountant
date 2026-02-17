/**
 * BAS available quarters — self-contained implementation.
 */
import { db, transactions } from '../../schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * Get available quarters for a user (based on transaction dates)
 */
export async function getAvailableQuarters(
  userId: string,
): Promise<Array<{ financialYear: string; quarter: number }>> {
  // Get min and max transaction dates
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

  const quarters: Array<{ financialYear: string; quarter: number }> = [];
  const minDate = new Date(result.minDate);
  const maxDate = new Date(result.maxDate);

  // Iterate through each quarter from min to max date
  const current = new Date(minDate);
  while (current <= maxDate) {
    const month = current.getMonth() + 1;
    const year = current.getFullYear();

    let financialYear: string;
    let quarter: number;

    if (month >= 7) {
      financialYear = `${year}-${(year + 1).toString().slice(2)}`;
      if (month >= 7 && month <= 9) quarter = 1;
      else quarter = 2;
    } else {
      financialYear = `${year - 1}-${year.toString().slice(2)}`;
      if (month >= 1 && month <= 3) quarter = 3;
      else quarter = 4;
    }

    // Check if already added
    if (!quarters.some((q) => q.financialYear === financialYear && q.quarter === quarter)) {
      quarters.push({ financialYear, quarter });
    }

    // Move to next quarter
    current.setMonth(current.getMonth() + 3);
  }

  return quarters;
}
