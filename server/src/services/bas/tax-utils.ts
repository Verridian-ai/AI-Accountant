/**
 * Australian Tax Utilities
 */

/**
 * Estimate gross income from net income using Australian tax brackets.
 * Uses a simple iterative approach to reverse-calculate gross from net.
 */
export function grossFromNet(netDollars: number, fyStartYear: number): number {
  // Simplified reverse-tax calculation using 2024-25 brackets as default
  // Iterate to find the gross amount that produces the given net
  let gross = netDollars;
  for (let i = 0; i < 20; i++) {
    const tax = estimateTax(gross, fyStartYear);
    const calculatedNet = gross - tax;
    const diff = netDollars - calculatedNet;
    if (Math.abs(diff) < 0.01) break;
    gross += diff;
  }
  return Math.round(gross * 100) / 100;
}

export function estimateTax(grossDollars: number, _fyStartYear: number): number {
  // 2024-25 Australian individual tax brackets (Stage 3 tax cuts)
  if (grossDollars <= 18_200) return 0;
  if (grossDollars <= 45_000) return (grossDollars - 18_200) * 0.16;
  if (grossDollars <= 135_000) return 4_288 + (grossDollars - 45_000) * 0.3;
  if (grossDollars <= 190_000) return 31_288 + (grossDollars - 135_000) * 0.37;
  return 51_638 + (grossDollars - 190_000) * 0.45;
}
