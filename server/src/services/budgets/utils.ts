/**
 * Budget Utility Functions
 */

/** Get array of YYYY-MM strings between two dates */
export function getMonthsBetween(startStr: string, endStr: string): string[] {
  const months: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);

  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

/** Convert a period string (YYYY-MM or YYYY-QN) to a date range */
export function getPeriodDateRange(period: string): { startDate: string; endDate: string } {
  if (period.includes('Q')) {
    // Quarterly: 2025-Q1 -> Jan-Mar
    const [yearStr, qStr] = period.split('-Q');
    const year = parseInt(yearStr);
    const quarter = parseInt(qStr);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0); // last day of quarter
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  // Monthly: 2025-01 -> full month
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of month
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}
