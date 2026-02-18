/**
 * Wave 18 CDR — Test 11: CDR Loan Calculator Extensions
 */

import { describe, it, expect } from 'vitest';
import { api } from './helpers';

describe('CDR Loan Calculator', () => {
  it('should return market rates for a category', async () => {
    const { status, data } = await api<{
      averageRate: number;
      medianRate: number;
      lowestRate: number;
      highestRate: number;
      sampleSize: number;
    }>('/api/cdr/rates/market?category=RESIDENTIAL_MORTGAGES');
    expect(status).toBe(200);
    expect(data).toHaveProperty('averageRate');
    expect(data).toHaveProperty('medianRate');
    expect(data).toHaveProperty('lowestRate');
    expect(data).toHaveProperty('highestRate');
    expect(data).toHaveProperty('sampleSize');
  });

  it('should perform refinance analysis', async () => {
    const { status, data } = await api<{ recommendations: unknown[] }>('/api/cdr/loans/refinance', {
      method: 'POST',
      body: JSON.stringify({
        currentLoanBalance: 50000000,
        currentRate: 0.065,
        currentRemainingMonths: 300,
        switchingCosts: 150000,
        targetCategory: 'RESIDENTIAL_MORTGAGES',
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('recommendations');
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  it('should calculate borrowing capacity', async () => {
    const { status, data } = await api<{ maxBorrowingAmount: number }>(
      '/api/cdr/loans/borrowing-capacity',
      {
        method: 'POST',
        body: JSON.stringify({
          annualIncome: 12000000,
          monthlyExpenses: 300000,
          existingDebts: 0,
          dependants: 0,
          category: 'RESIDENTIAL_MORTGAGES',
        }),
      },
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty('maxBorrowingAmount');
    expect(data.maxBorrowingAmount).toBeGreaterThan(0);
  });

  it('should model rate scenarios', async () => {
    const { status, data } = await api<{ scenarios: unknown[] }>('/api/cdr/loans/rate-scenarios', {
      method: 'POST',
      body: JSON.stringify({
        loanBalance: 50000000,
        currentRate: 0.06,
        remainingTermMonths: 360,
        rateChanges: [0.0025, 0.005, 0.01, -0.005],
        category: 'RESIDENTIAL_MORTGAGES',
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('scenarios');
    expect(Array.isArray(data.scenarios)).toBe(true);
    expect(data.scenarios.length).toBeGreaterThanOrEqual(4);
  });
});
