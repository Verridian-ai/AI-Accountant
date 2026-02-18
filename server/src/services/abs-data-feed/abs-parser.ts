/**
 * ABS Data Feed — Pure SDMX parsing helpers
 */

export function extractObsValue(obs: unknown): number | null {
  if (!obs) return null;
  if (Array.isArray(obs)) {
    const val = obs[0];
    return typeof val === 'number' ? val : null;
  }
  return typeof obs === 'number' ? obs : null;
}

export function periodToIsoDate(period: string): string {
  if (!period) return new Date().toISOString().slice(0, 10);
  const qMatch = period.match(/^(\d{4})-Q(\d)$/);
  if (qMatch) {
    const year = parseInt(qMatch[1], 10);
    const quarter = parseInt(qMatch[2], 10);
    const month = quarter * 3;
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
  const mMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) return `${mMatch[1]}-${mMatch[2]}-01`;
  const yMatch = period.match(/^(\d{4})$/);
  if (yMatch) return `${yMatch[1]}-01-01`;
  return period;
}

export function defaultStartPeriod(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return `${d.getFullYear()}-01`;
}

export function inferFrequency(key: string): string {
  switch (key) {
    case 'CPI':
    case 'GDP':
    case 'WAGES':
      return 'quarterly';
    case 'LABOUR_FORCE':
    case 'DWELLING_APPROVALS':
      return 'monthly';
    default:
      return 'quarterly';
  }
}
