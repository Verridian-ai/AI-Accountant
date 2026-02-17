/**
 * Financial Planner helpers — constants and the simulatePayoff function.
 *
 * Shared between legacy and Vercel financial planner agents.
 * Extracted to comply with the 300-line enterprise standard.
 */

/** Expected annual returns by risk profile */
export const RISK_PROFILE_RETURNS: Record<string, number> = {
  conservative: 0.04,
  balanced: 0.06,
  growth: 0.08,
  aggressive: 0.1,
};

/** 50/30/20 budget rule variants by risk profile */
export const BUDGET_RULES: Record<string, { needs: number; wants: number; savings: number }> = {
  conservative: { needs: 50, wants: 20, savings: 30 },
  balanced: { needs: 50, wants: 30, savings: 20 },
  growth: { needs: 50, wants: 25, savings: 25 },
  aggressive: { needs: 45, wants: 20, savings: 35 },
};

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
  const maxMonths = 360; // 30-year cap
  const order: Array<{ debtName: string; payoffMonth: number }> = [];

  while (balances.some((d) => d.remaining > 0) && month < maxMonths) {
    month++;

    // Apply interest
    for (const d of balances) {
      if (d.remaining <= 0) continue;
      const monthlyInterest = Math.round(d.remaining * (d.interestRate / 12));
      d.remaining += monthlyInterest;
      totalInterestCents += monthlyInterest;
    }

    // Make minimum payments on all debts
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

    // Apply extra payment to the first debt with remaining balance
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

  // Deduplicate order entries
  const seen = new Set<string>();
  const uniqueOrder = order.filter((o) => {
    if (seen.has(o.debtName)) return false;
    seen.add(o.debtName);
    return true;
  });

  return { totalInterestCents, months: month, order: uniqueOrder };
}
