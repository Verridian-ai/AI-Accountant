export function resolvePeriod(period: string): { financialYear: string; quarter: number } {
  if (period === 'current') {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const fy =
      month >= 7
        ? `${year}-${(year + 1).toString().slice(2)}`
        : `${year - 1}-${year.toString().slice(2)}`;
    let q: number;
    if (month >= 7 && month <= 9) q = 1;
    else if (month >= 10 && month <= 12) q = 2;
    else if (month >= 1 && month <= 3) q = 3;
    else q = 4;
    return { financialYear: fy, quarter: q };
  }
  const [year, q] = period.split('-Q');
  const quarterNum = parseInt(q, 10);
  const fyStartYear = parseInt(year, 10);
  const financialYear = `${fyStartYear}-${(fyStartYear + 1).toString().slice(2)}`;
  return { financialYear, quarter: quarterNum };
}
