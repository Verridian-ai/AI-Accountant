import { useMemo } from 'react';

/**
 * Computes sparkline-friendly number[] from a list of transactions.
 * Groups by month / quarter / week and aggregates values.
 */
export function useSparklineData(
  transactions: Array<{ date: string; amount: number }>,
  groupBy: 'month' | 'quarter' | 'week' = 'month',
  valueField: 'amount' | 'count' = 'amount',
  periods: number = 6,
): number[] {
  return useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const buckets = new Map<string, number>();

    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (Number.isNaN(d.getTime())) continue;

      let key: string;
      if (groupBy === 'week') {
        // ISO week-based key: YYYY-Www
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(
          ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
        );
        key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else if (groupBy === 'quarter') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        key = `${d.getFullYear()}-Q${q}`;
      } else {
        // month
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      const prev = buckets.get(key) ?? 0;
      buckets.set(key, prev + (valueField === 'count' ? 1 : Math.abs(tx.amount)));
    }

    // Sort keys chronologically and take the last N
    const sortedKeys = [...buckets.keys()].sort();
    const lastN = sortedKeys.slice(-periods);

    // Fill missing periods with 0
    const result: number[] = lastN.map((k) => buckets.get(k) ?? 0);
    return result;
  }, [transactions, groupBy, valueField, periods]);
}
