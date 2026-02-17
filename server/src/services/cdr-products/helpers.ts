/**
 * CDR Product Service — Internal Helpers
 */

/** Standard annuity payment (PMT formula). Returns cents. */
export function pmt(principalCents: number, periodicRate: number, periods: number): number {
  if (periodicRate === 0) return Math.round(principalCents / periods);
  const factor = Math.pow(1 + periodicRate, periods);
  return Math.round((principalCents * periodicRate * factor) / (factor - 1));
}
