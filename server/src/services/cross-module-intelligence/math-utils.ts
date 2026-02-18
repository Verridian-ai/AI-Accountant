// ============================================================================
// MATH UTILITIES — Pure numeric functions for statistical analysis
// ============================================================================

/**
 * Pearson correlation coefficient with t-distribution p-value approximation.
 * Formula: r = Σ((xi-x̄)(yi-ȳ)) / √(Σ(xi-x̄)² × Σ(yi-ȳ)²)
 * P-value from t = r√(n-2)/√(1-r²), using t-distribution CDF.
 */
export function calculatePearsonCorrelation(
  x: number[],
  y: number[],
): { coefficient: number; pValue: number } {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { coefficient: 0, pValue: 1 };

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  if (sumX2 === 0 || sumY2 === 0) return { coefficient: 0, pValue: 1 };

  const r = sumXY / Math.sqrt(sumX2 * sumY2);
  const rSquared = r * r;

  // t-statistic: t = r * sqrt(n-2) / sqrt(1 - r²)
  const df = n - 2;
  const t = (r * Math.sqrt(df)) / Math.sqrt(1 - rSquared + 1e-15);

  // Approximate two-tailed p-value
  const pValue = tDistPValue(Math.abs(t), df);

  return {
    coefficient: Math.round(r * 1e10) / 1e10,
    pValue: Math.round(pValue * 1e10) / 1e10,
  };
}

/**
 * Approximate two-tailed p-value from t-distribution.
 * Uses normal approximation for large df, beta function series for small df.
 */
export function tDistPValue(t: number, df: number): number {
  if (df > 100) {
    // Normal approximation (Abramowitz & Stegun 26.2.17)
    const x = t / Math.sqrt(2);
    const ax = Math.abs(x);
    const tVal = 1 / (1 + 0.3275911 * ax);
    const poly =
      ((((1.061405429 * tVal - 1.453152027) * tVal + 1.421413741) * tVal - 0.284496736) * tVal +
        0.254829592) *
      tVal;
    const erf = 1 - poly * Math.exp(-ax * ax);
    const normalCdf = 0.5 * (1 + (x >= 0 ? erf : -erf));
    return 2 * (1 - normalCdf);
  }

  // Regularized incomplete beta: p = I_x(df/2, 1/2) where x = df/(df+t²)
  const xVal = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const prefix = Math.exp(a * Math.log(xVal) + b * Math.log(1 - xVal) - lnBeta) / a;

  let term = 1;
  let result = 1;
  for (let k = 1; k <= 200; k++) {
    term *= (xVal * (a + b + k - 1) * (a + k - 1)) / ((a + 2 * k - 1) * (a + 2 * k));
    if (!isFinite(term)) break;
    result += term;
    if (Math.abs(term) < 1e-10) break;
  }

  return Math.min(1, Math.max(0, prefix * result));
}

/** Lanczos approximation of the log-gamma function. */
export function lnGamma(z: number): number {
  if (z <= 0) return 0;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) {
    x += c[i] / (z + i);
  }
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
