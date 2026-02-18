export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100);
}

/** value is a ratio (0–1), returns percentage string like "22.5%" */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getCurrentTaxYear(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}-${year.toString().slice(2)}`;
}

export function generateTaxYears(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let i = 0; i < 5; i++) {
    const year = currentYear - i;
    years.push(`${year}-${(year + 1).toString().slice(2)}`);
  }
  return years;
}
