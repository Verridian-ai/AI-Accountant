export function formatCurrencyShort(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // Australian financial year quarters
  if (month >= 6 && month <= 8) return { year, quarter: 1 }; // Jul-Sep
  if (month >= 9 && month <= 11) return { year, quarter: 2 }; // Oct-Dec
  if (month >= 0 && month <= 2) return { year: year - 1, quarter: 3 }; // Jan-Mar
  return { year: year - 1, quarter: 4 }; // Apr-Jun
}

export function getQuarterDates(year: number, quarter: 1 | 2 | 3 | 4): string {
  const periods = {
    1: `Jul-Sep ${year}`,
    2: `Oct-Dec ${year}`,
    3: `Jan-Mar ${year + 1}`,
    4: `Apr-Jun ${year + 1}`,
  };
  return periods[quarter];
}

export function generateQuarterOptions(): { value: string; label: string; sublabel: string }[] {
  const options: { value: string; label: string; sublabel: string }[] = [];
  const currentYear = new Date().getFullYear();

  for (let year = currentYear; year >= currentYear - 4; year--) {
    for (let q = 4; q >= 1; q--) {
      options.push({
        value: `${year}-Q${q}`,
        label: `Q${q} ${year}-${(year + 1).toString().slice(2)}`,
        sublabel: getQuarterDates(year, q as 1 | 2 | 3 | 4),
      });
    }
  }

  return options;
}
