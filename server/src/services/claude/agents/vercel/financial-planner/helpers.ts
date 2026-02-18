/**
 * Simulate debt payoff over time.
 * Returns total interest paid, months to payoff, and payoff order.
 */
export function simulatePayoff(
  debts: Array<{
    name: string;
    balanceCents: number;
    interestRate: number;
    minimumPaymentCents: number;
  }>,
  extraPaymentCents: number,
): {
  totalInterestCents: number;
  months: number;
  order: Array<{ debtName: string; payoffMonth: number }>;
} {
  const balances = debts.map((d) => ({ ...d, remaining: d.balanceCents }));
  let totalInterestCents = 0;
  let month = 0;
  const maxMonths = 360;
  const order: Array<{ debtName: string; payoffMonth: number }> = [];

  while (balances.some((d) => d.remaining > 0) && month < maxMonths) {
    month++;

    for (const d of balances) {
      if (d.remaining <= 0) continue;
      const monthlyInterest = Math.round(d.remaining * (d.interestRate / 12));
      d.remaining += monthlyInterest;
      totalInterestCents += monthlyInterest;
    }

    let extraRemaining = extraPaymentCents;
    for (const d of balances) {
      if (d.remaining <= 0) continue;
      const payment = Math.min(d.minimumPaymentCents, d.remaining);
      d.remaining -= payment;
      if (d.remaining <= 0) {
        extraRemaining += d.minimumPaymentCents - payment;
        order.push({ debtName: d.name, payoffMonth: month });
      }
    }

    for (const d of balances) {
      if (d.remaining <= 0 || extraRemaining <= 0) continue;
      const payment = Math.min(extraRemaining, d.remaining);
      d.remaining -= payment;
      extraRemaining -= payment;
      if (d.remaining <= 0) {
        order.push({ debtName: d.name, payoffMonth: month });
      }
    }
  }

  const seen = new Set<string>();
  const uniqueOrder = order.filter((o) => {
    if (seen.has(o.debtName)) return false;
    seen.add(o.debtName);
    return true;
  });

  return { totalInterestCents, months: month, order: uniqueOrder };
}
