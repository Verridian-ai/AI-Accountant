/**
 * Enhanced Budget Service — Financial Calculators
 *
 * Wealth projection and debt repayment strategy calculations.
 * Pure functions that don't require database access.
 */

import type {
  WealthProjectionParams,
  WealthProjectionResult,
  DebtInfo,
  DebtStrategyResult,
} from './types.js';

/**
 * Calculate wealth projection over multiple timeframes with 4 risk profiles.
 *
 * Formula: FV = PV * (1 + r/n)^(nt) + PMT * ((1 + r/n)^(nt) - 1) / (r/n)
 * where n = 12 (monthly compounding)
 */
export function calculateWealthProjection(params: WealthProjectionParams): WealthProjectionResult {
  const { currentSavings, monthlyContribution, inflationRate = 0.03 } = params;

  const profiles = [
    { name: 'Conservative', annualReturn: 0.04 },
    { name: 'Balanced', annualReturn: 0.06 },
    { name: 'Growth', annualReturn: 0.08 },
    { name: 'Aggressive', annualReturn: 0.1 },
  ];

  const horizons = [5, 10, 20, 30]; // years

  return {
    profiles: profiles.map((profile) => ({
      name: profile.name,
      annualReturn: profile.annualReturn,
      projections: horizons.map((years) => {
        const r = profile.annualReturn / 12; // monthly rate
        const n = years * 12; // total months

        // Compound growth: PV component
        const pvGrowth = Math.round(currentSavings * Math.pow(1 + r, n));

        // Annuity component (regular contributions)
        let annuityGrowth = 0;
        if (r > 0) {
          annuityGrowth = Math.round((monthlyContribution * (Math.pow(1 + r, n) - 1)) / r);
        } else {
          annuityGrowth = monthlyContribution * n;
        }

        const nominalValue = pvGrowth + annuityGrowth;

        // Inflation adjustment
        const inflationFactor = Math.pow(1 + inflationRate, years);
        const realValue = Math.round(nominalValue / inflationFactor);

        return { years, nominalValue, realValue };
      }),
    })),
  };
}

/**
 * Compare debt repayment strategies: avalanche (highest rate first)
 * vs snowball (smallest balance first).
 */
export function compareDebtStrategies(
  debts: DebtInfo[],
  extraMonthlyPayment: number, // cents
): DebtStrategyResult {
  // Avalanche: sort by highest interest rate first
  const avalancheOrder = [...debts].sort((a, b) => b.rate - a.rate);
  const avalanche = simulateDebtPayoff(avalancheOrder, extraMonthlyPayment);

  // Snowball: sort by smallest balance first
  const snowballOrder = [...debts].sort((a, b) => a.balance - b.balance);
  const snowball = simulateDebtPayoff(snowballOrder, extraMonthlyPayment);

  const interestSaved = snowball.totalInterest - avalanche.totalInterest;

  return {
    avalanche: {
      totalInterest: avalanche.totalInterest,
      payoffMonths: avalanche.payoffMonths,
      order: avalancheOrder.map((d) => d.name),
    },
    snowball: {
      totalInterest: snowball.totalInterest,
      payoffMonths: snowball.payoffMonths,
      order: snowballOrder.map((d) => d.name),
    },
    interestSaved,
    recommendation:
      interestSaved > 10000 // > $100 difference
        ? `Avalanche saves ${(interestSaved / 100).toFixed(2)} in interest. Use avalanche if motivated by math.`
        : `Both strategies are similar. Snowball may be better for motivation.`,
  };
}

/**
 * Simulate debt payoff for a given order of debts.
 * The extra payment goes to the first debt in the list;
 * when one is paid off, its min payment + extra rolls to the next.
 */
export function simulateDebtPayoff(
  debts: DebtInfo[],
  extraMonthlyPayment: number,
): { totalInterest: number; payoffMonths: number } {
  // Clone balances
  const balances = debts.map((d) => d.balance);
  let totalInterest = 0;
  let month = 0;
  const maxMonths = 600; // 50 year safety cap

  while (balances.some((b) => b > 0) && month < maxMonths) {
    month++;

    // Calculate interest for each debt
    for (let i = 0; i < debts.length; i++) {
      if (balances[i] <= 0) continue;
      const monthlyInterest = Math.round((balances[i] * debts[i].rate) / 12);
      balances[i] += monthlyInterest;
      totalInterest += monthlyInterest;
    }

    // Make minimum payments on all debts
    for (let i = 0; i < debts.length; i++) {
      if (balances[i] <= 0) continue;
      const payment = Math.min(debts[i].minPayment, balances[i]);
      balances[i] -= payment;
    }

    // Apply extra payment to the first debt with remaining balance
    let remaining = extraMonthlyPayment;
    for (let i = 0; i < debts.length; i++) {
      if (balances[i] <= 0 || remaining <= 0) continue;
      const payment = Math.min(remaining, balances[i]);
      balances[i] -= payment;
      remaining -= payment;
      break; // Extra goes to first priority debt only
    }
  }

  return { totalInterest, payoffMonths: month };
}
