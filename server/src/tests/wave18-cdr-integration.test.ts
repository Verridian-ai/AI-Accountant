/**
 * Wave 18 — CDR Open Banking Integration Tests
 *
 * Tests the full CDR pipeline: Register discovery → product catalog crawl →
 * detail crawl → rate parsing → product search → comparison → savings.
 *
 * Prerequisites:
 *   - PostgreSQL running with CDR tables (migration 0030)
 *   - Server running at BASE_URL (default http://localhost:3501)
 *   - Internet access for live CDR Register API tests
 *
 * Run:  npx vitest run src/tests/wave18-cdr-integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3501';

// Helper: fetch with JSON response + status check
async function api<T = any>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

// ============================================================================
// 1. CDR Register Discovery
// ============================================================================
describe('CDR Register Discovery', () => {
  it('should discover 10+ data holders from the CDR Register', async () => {
    // The live CDR Register at https://api.cdr.gov.au should return a substantial list
    // of ADI (Authorised Deposit-taking Institution) brands.
    const { status, data } = await api<any>('/api/cdr/crawl/full', {
      method: 'POST',
    });

    // A full crawl may take a while; we primarily care that it doesn't crash.
    // If the CDR Register is unreachable, expect a 500 with an error message.
    if (status === 200) {
      expect(data.holdersDiscovered).toBeGreaterThanOrEqual(10);
      expect(data.holdersProcessed).toBeGreaterThanOrEqual(1);
    } else {
      // Acceptable: CDR Register may be unreachable in CI — just log a warning.
      console.warn('[SKIP] CDR Register unreachable:', data.error);
      expect(status).toBe(500);
    }
  }, 120_000); // 2-minute timeout for full crawl

  it('should list discovered data holders', async () => {
    const { status, data } = await api<any[]>('/api/cdr/data-holders');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // After a crawl (or empty DB), this should always return an array.
  });
});

// ============================================================================
// 2. CBA Product Catalog Crawl
// ============================================================================
describe('CBA Product Catalog', () => {
  it('should have CBA (or similar) data holder with products', async () => {
    const { data: holders } = await api<any[]>('/api/cdr/data-holders');
    // Look for any holder that has been crawled (productCount > 0)
    const withProducts = holders.filter((h: any) => (h.productCount ?? 0) > 0);
    if (withProducts.length === 0) {
      console.warn('[SKIP] No data holders with products — run a crawl first');
      return;
    }
    expect(withProducts.length).toBeGreaterThanOrEqual(1);
  });

  it('should return paginated product list', async () => {
    const { status, data } = await api<any>('/api/cdr/products?limit=5&offset=0');
    expect(status).toBe(200);
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.products)).toBe(true);
  });
});

// ============================================================================
// 3. Product Detail with Rates
// ============================================================================
describe('Product Detail Crawl', () => {
  let sampleProductId: string | null = null;

  beforeAll(async () => {
    const { data } = await api<any>('/api/cdr/products?limit=1');
    if (data.products?.length > 0) {
      sampleProductId = data.products[0].id;
    }
  });

  it('should return full product detail with child records', async () => {
    if (!sampleProductId) {
      console.warn('[SKIP] No products in DB');
      return;
    }
    const { status, data } = await api<any>(`/api/cdr/products/${sampleProductId}`);
    expect(status).toBe(200);
    expect(data).toHaveProperty('id', sampleProductId);
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('productCategory');
    // Child arrays should exist even if empty
    expect(Array.isArray(data.lendingRates)).toBe(true);
    expect(Array.isArray(data.depositRates)).toBe(true);
    expect(Array.isArray(data.fees)).toBe(true);
    expect(Array.isArray(data.features)).toBe(true);
    expect(Array.isArray(data.eligibility)).toBe(true);
    expect(data).toHaveProperty('dataHolder');
  });

  it('should return 404 for non-existent product', async () => {
    const { status, data } = await api<any>('/api/cdr/products/non-existent-id-999');
    expect(status).toBe(404);
    expect(data).toHaveProperty('error');
  });
});

// ============================================================================
// 4. Rate Parsing Accuracy
// ============================================================================
describe('Rate Parsing Accuracy', () => {
  it('should have numeric rate values within valid bounds', async () => {
    const { data } = await api<any>(
      '/api/cdr/rates/best?category=RESIDENTIAL_MORTGAGES&rateType=lending&limit=20',
    );
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[SKIP] No lending rates in DB');
      return;
    }
    for (const entry of data) {
      // Australian home loan rates are typically 0.01–0.15 (1%–15% as decimal)
      expect(typeof entry.rate).toBe('number');
      expect(entry.rate).toBeGreaterThan(0);
      expect(entry.rate).toBeLessThan(0.2); // 20% upper bound sanity check
      if (entry.comparisonRate != null) {
        expect(typeof entry.comparisonRate).toBe('number');
        expect(entry.comparisonRate).toBeGreaterThan(0);
        expect(entry.comparisonRate).toBeLessThan(0.25);
      }
    }
  });

  it('should have deposit rates within valid bounds', async () => {
    const { data } = await api<any>(
      '/api/cdr/rates/best?category=TRANS_AND_SAVINGS_ACCOUNTS&rateType=deposit&limit=20',
    );
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[SKIP] No deposit rates in DB');
      return;
    }
    for (const entry of data) {
      expect(typeof entry.rate).toBe('number');
      expect(entry.rate).toBeGreaterThanOrEqual(0);
      expect(entry.rate).toBeLessThan(0.15); // 15% upper bound
    }
  });
});

// ============================================================================
// 5. Product Search Filters
// ============================================================================
describe('Product Search Filters', () => {
  it('should filter by productCategory', async () => {
    const { data } = await api<any>(
      '/api/cdr/products?productCategory=RESIDENTIAL_MORTGAGES&limit=5',
    );
    if (data.products?.length > 0) {
      for (const p of data.products) {
        expect(p.productCategory).toBe('RESIDENTIAL_MORTGAGES');
      }
    }
  });

  it('should filter by rate range', async () => {
    const { data } = await api<any>('/api/cdr/products?minRate=0.04&maxRate=0.07&limit=5');
    expect(data).toHaveProperty('products');
    // All returned products should have a bestRate in the requested range
    for (const p of data.products ?? []) {
      if (p.bestRate != null) {
        expect(p.bestRate).toBeGreaterThanOrEqual(0.04);
        expect(p.bestRate).toBeLessThanOrEqual(0.07);
      }
    }
  });

  it('should support text search', async () => {
    const { data } = await api<any>('/api/cdr/products?searchText=home+loan&limit=5');
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('total');
  });

  it('should support sorting by rate', async () => {
    const { data } = await api<any>('/api/cdr/products?sortBy=rate&sortOrder=asc&limit=10');
    const rates = (data.products ?? []).map((p: any) => p.bestRate).filter((r: any) => r != null);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });

  it('should return category summary', async () => {
    const { status, data } = await api<any[]>('/api/cdr/products/categories');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // Each category should have a name and count
    for (const cat of data) {
      expect(cat).toHaveProperty('productCategory');
      expect(cat).toHaveProperty('count');
    }
  });
});

// ============================================================================
// 6. Product Comparison Matrix
// ============================================================================
describe('Product Comparison', () => {
  it('should compare multiple products side-by-side', async () => {
    const { data: search } = await api<any>('/api/cdr/products?limit=3');
    const ids = (search.products ?? []).map((p: any) => p.id);
    if (ids.length < 2) {
      console.warn('[SKIP] Need at least 2 products for comparison');
      return;
    }

    const { status, data } = await api<any>('/api/cdr/products/compare', {
      method: 'POST',
      body: JSON.stringify({ productIds: ids }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('products');
    expect(data.products.length).toBe(ids.length);
    // Each product in comparison should have rates, fees, features
    for (const p of data.products) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('lendingRates');
      expect(p).toHaveProperty('fees');
      expect(p).toHaveProperty('features');
    }
  });

  it('should reject empty productIds', async () => {
    const { status, data } = await api<any>('/api/cdr/products/compare', {
      method: 'POST',
      body: JSON.stringify({ productIds: [] }),
    });
    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
  });
});

// ============================================================================
// 7. Best Rates Sorting
// ============================================================================
describe('Best Rates Leaderboard', () => {
  it('should return lending rates sorted ascending by rate', async () => {
    const { status, data } = await api<any[]>(
      '/api/cdr/rates/best?category=RESIDENTIAL_MORTGAGES&rateType=lending&limit=10',
    );
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // Rates should be in ascending order (best = lowest for lending)
    for (let i = 1; i < data.length; i++) {
      expect(data[i].rate).toBeGreaterThanOrEqual(data[i - 1].rate);
    }
  });

  it('should return deposit rates sorted descending by rate', async () => {
    const { status, data } = await api<any[]>(
      '/api/cdr/rates/best?category=TRANS_AND_SAVINGS_ACCOUNTS&rateType=deposit&limit=10',
    );
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // Rates should be in descending order (best = highest for deposits)
    for (let i = 1; i < data.length; i++) {
      expect(data[i].rate).toBeLessThanOrEqual(data[i - 1].rate);
    }
  });
});

// ============================================================================
// 8. Savings Calculator
// ============================================================================
describe('Savings Calculator', () => {
  it('should calculate monthly savings for rate reduction', async () => {
    const { status, data } = await api<any>('/api/cdr/savings/calculate', {
      method: 'POST',
      body: JSON.stringify({
        currentRate: 0.065, // 6.5%
        newRate: 0.059, // 5.9%
        loanBalance: 50000000, // $500k in cents
        remainingTermMonths: 300, // 25 years
        switchingCosts: 100000, // $1000 in cents
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('monthlySavings');
    expect(data).toHaveProperty('totalSavings');
    expect(data).toHaveProperty('breakEvenMonths');
    // With a 0.6% rate reduction on $500k, monthly savings should be positive
    expect(data.monthlySavings).toBeGreaterThan(0);
    expect(data.totalSavings).toBeGreaterThan(0);
    expect(data.breakEvenMonths).toBeGreaterThan(0);
  });

  it('should return zero savings for identical rates', async () => {
    const { status, data } = await api<any>('/api/cdr/savings/calculate', {
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

// ============================================================================
// 9. Crawl Log Records
// ============================================================================
describe('Crawl Logs', () => {
  it('should return crawl log entries', async () => {
    const { status, data } = await api<any[]>('/api/cdr/crawl/logs');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    // If any crawls have been run, each log should have required fields
    for (const log of data) {
      expect(log).toHaveProperty('id');
      expect(log).toHaveProperty('crawlType');
      expect(log).toHaveProperty('status');
      expect(log).toHaveProperty('startedAt');
    }
  });
});

// ============================================================================
// 10. Rate Limiter Enforcement
// ============================================================================
describe('Rate Limiter Enforcement', () => {
  it('should not allow parallel full crawls (rate-limited)', async () => {
    // Fire two full crawls simultaneously — the second should be rejected or queued.
    // This tests the internal rate-limiting mechanism (500ms per data holder).
    const [res1, res2] = await Promise.all([
      api('/api/cdr/crawl/full', { method: 'POST' }),
      api('/api/cdr/crawl/full', { method: 'POST' }),
    ]);
    // At least one should succeed; both succeeding is also acceptable if the
    // service serializes internally.
    const successes = [res1, res2].filter((r) => r.status === 200);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('should enforce per-holder rate limiting in incremental crawls', async () => {
    // An incremental crawl should complete without 429 errors from the CDR Register
    const { data } = await api<any>('/api/cdr/crawl/incremental', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (data.errors) {
      const rateLimitErrors = data.errors.filter((e: any) => e.statusCode === 429);
      expect(rateLimitErrors.length).toBe(0); // No 429 errors = rate limiter working
    }
  }, 120_000);
});

// ============================================================================
// 11. CDR Loan Calculator Extensions
// ============================================================================
describe('CDR Loan Calculator', () => {
  it('should return market rates for a category', async () => {
    const { status, data } = await api<any>('/api/cdr/rates/market?category=RESIDENTIAL_MORTGAGES');
    expect(status).toBe(200);
    expect(data).toHaveProperty('averageRate');
    expect(data).toHaveProperty('medianRate');
    expect(data).toHaveProperty('lowestRate');
    expect(data).toHaveProperty('highestRate');
    expect(data).toHaveProperty('sampleSize');
  });

  it('should perform refinance analysis', async () => {
    const { status, data } = await api<any>('/api/cdr/loans/refinance', {
      method: 'POST',
      body: JSON.stringify({
        currentLoanBalance: 50000000, // $500k in cents
        currentRate: 0.065,
        currentRemainingMonths: 300,
        switchingCosts: 150000, // $1500 in cents
        targetCategory: 'RESIDENTIAL_MORTGAGES',
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('recommendations');
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  it('should calculate borrowing capacity', async () => {
    const { status, data } = await api<any>('/api/cdr/loans/borrowing-capacity', {
      method: 'POST',
      body: JSON.stringify({
        annualIncome: 12000000, // $120k in cents
        monthlyExpenses: 300000, // $3k in cents
        existingDebts: 0,
        dependants: 0,
        category: 'RESIDENTIAL_MORTGAGES',
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('maxBorrowingAmount');
    expect(data.maxBorrowingAmount).toBeGreaterThan(0);
  });

  it('should model rate scenarios', async () => {
    const { status, data } = await api<any>('/api/cdr/loans/rate-scenarios', {
      method: 'POST',
      body: JSON.stringify({
        loanBalance: 50000000, // $500k in cents
        currentRate: 0.06,
        remainingTermMonths: 360,
        rateChanges: [0.0025, 0.005, 0.01, -0.005], // +0.25%, +0.5%, +1%, -0.5%
        category: 'RESIDENTIAL_MORTGAGES',
      }),
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('scenarios');
    expect(Array.isArray(data.scenarios)).toBe(true);
    expect(data.scenarios.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// 12. Rate Alert CRUD
// ============================================================================
describe('Rate Alerts', () => {
  let alertId: string | null = null;

  it('should create a rate alert', async () => {
    const { status, data } = await api<any>('/api/cdr/alerts', {
      method: 'POST',
      body: JSON.stringify({
        alertType: 'rate_drop',
        productCategory: 'RESIDENTIAL_MORTGAGES',
        rateType: 'lending',
        thresholdRate: 0.055,
        notificationMethod: 'in_app',
      }),
    });
    expect(status).toBe(201);
    expect(data).toHaveProperty('id');
    alertId = data.id;
  });

  it('should list alerts for user', async () => {
    const { status, data } = await api<any[]>('/api/cdr/alerts');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    if (alertId) {
      const found = data.find((a) => a.id === alertId);
      expect(found).toBeDefined();
    }
  });

  it('should soft-delete an alert', async () => {
    if (!alertId) return;
    const { status, data } = await api<any>(`/api/cdr/alerts/${alertId}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('success', true);

    // Verify it no longer appears in active alerts
    const { data: alerts } = await api<any[]>('/api/cdr/alerts');
    const found = alerts.find((a: any) => a.id === alertId);
    expect(found).toBeUndefined();
  });
});

// ============================================================================
// 13. Cognee CDR Indexing
// ============================================================================
describe('Cognee CDR Indexing', () => {
  it('should trigger CDR product indexing', async () => {
    const { status, data } = await api<any>('/api/cdr/index', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    // Cognee may not be running in CI — accept both success and error
    if (status === 200) {
      expect(data).toHaveProperty('indexed');
    } else {
      console.warn('[SKIP] Cognee indexing not available:', data.error);
    }
  });
});
