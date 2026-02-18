/**
 * Wave 18 CDR — Tests 4, 7 & 8: Rate Parsing, Best Rates, Savings Calculator
 */

import { describe, it, expect } from 'vitest';
import { api } from './helpers';

// ============================================================================
// 4. Rate Parsing Accuracy
// ============================================================================
describe('Rate Parsing Accuracy', () => {
  it('should have numeric rate values within valid bounds', async () => {
    const { data } = await api<Array<{ rate: number; comparisonRate?: number }>>(
      '/api/cdr/rates/best?category=RESIDENTIAL_MORTGAGES&rateType=lending&limit=20',
    );
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[SKIP] No lending rates in DB');
      return;
    }
    for (const entry of data) {
      expect(typeof entry.rate).toBe('number');
      expect(entry.rate).toBeGreaterThan(0);
      expect(entry.rate).toBeLessThan(0.2);
      if (entry.comparisonRate != null) {
        expect(typeof entry.comparisonRate).toBe('number');
        expect(entry.comparisonRate).toBeGreaterThan(0);
        expect(entry.comparisonRate).toBeLessThan(0.25);
      }
    }
  });

  it('should have deposit rates within valid bounds', async () => {
    const { data } = await api<Array<{ rate: number }>>(
      '/api/cdr/rates/best?category=TRANS_AND_SAVINGS_ACCOUNTS&rateType=deposit&limit=20',
    );
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[SKIP] No deposit rates in DB');
      return;
    }
    for (const entry of data) {
      expect(typeof entry.rate).toBe('number');
      expect(entry.rate).toBeGreaterThanOrEqual(0);
      expect(entry.rate).toBeLessThan(0.15);
    }
  });
});

// ============================================================================
// 7. Best Rates Sorting
// ============================================================================
describe('Best Rates Leaderboard', () => {
  it('should return lending rates sorted ascending by rate', async () => {
    const { status, data } = await api<Array<{ rate: number }>>(
      '/api/cdr/rates/best?category=RESIDENTIAL_MORTGAGES&rateType=lending&limit=10',
    );
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.rate).toBeGreaterThanOrEqual(data[i - 1]!.rate);
    }
  });

  it('should return deposit rates sorted descending by rate', async () => {
    const { status, data } = await api<Array<{ rate: number }>>(
      '/api/cdr/rates/best?category=TRANS_AND_SAVINGS_ACCOUNTS&rateType=deposit&limit=10',
    );
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    for (let i = 1; i < data.length; i++) {
      expect(data[i]!.rate).toBeLessThanOrEqual(data[i - 1]!.rate);
    }
  });
});

// ============================================================================
// 8. Savings Calculator
// ============================================================================
describe('Savings Calculator', () => {
  it('should calculate monthly savings for rate reduction', async () => {
    const { status, data } = await api<{
      monthlySavings: number;
      totalSavings: number;
      breakEvenMonths: number;
    }>('/api/cdr/savings/calculate', {
      method: 'POST',
      body: JSON.stringify({
        currentRate: 0.065,
        newRate: 0.059,
        loanBalance: 50000000,
        remainingTermMonths: 300,
        switchingCosts: 100000,
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('monthlySavings');
    expect(data).toHaveProperty('totalSavings');
    expect(data).toHaveProperty('breakEvenMonths');
    expect(data.monthlySavings).toBeGreaterThan(0);
    expect(data.totalSavings).toBeGreaterThan(0);
    expect(data.breakEvenMonths).toBeGreaterThan(0);
  });

  it('should return zero savings for identical rates', async () => {
    const { status, data } = await api<{ monthlySavings: number }>('/api/cdr/savings/calculate', {
      method: 'POST',
      body: JSON.stringify({
        currentRate: 0.06,
        newRate: 0.06,
        loanBalance: 50000000,
        remainingTermMonths: 360,
        switchingCosts: 0,
      }),
    });
    expect(status).toBe(200);
    expect(data.monthlySavings).toBe(0);
  });
});
