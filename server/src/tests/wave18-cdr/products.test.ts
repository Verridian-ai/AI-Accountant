/**
 * Wave 18 CDR — Tests 3, 5 & 6: Product Detail, Search Filters, Comparison
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api } from './helpers';

// ============================================================================
// 3. Product Detail with Rates
// ============================================================================
describe('Product Detail Crawl', () => {
  let sampleProductId: string | null = null;

  beforeAll(async () => {
    const { data } = await api<{ products?: Array<{ id: string }> }>('/api/cdr/products?limit=1');
    if (data.products && data.products.length > 0) {
      sampleProductId = data.products[0].id;
    }
  });

  it('should return full product detail with child records', async () => {
    if (!sampleProductId) {
      console.warn('[SKIP] No products in DB');
      return;
    }
    const { status, data } = await api<Record<string, unknown>>(
      `/api/cdr/products/${sampleProductId}`,
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty('id', sampleProductId);
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('productCategory');
    expect(Array.isArray(data.lendingRates)).toBe(true);
    expect(Array.isArray(data.depositRates)).toBe(true);
    expect(Array.isArray(data.fees)).toBe(true);
    expect(Array.isArray(data.features)).toBe(true);
    expect(Array.isArray(data.eligibility)).toBe(true);
    expect(data).toHaveProperty('dataHolder');
  });

  it('should return 404 for non-existent product', async () => {
    const { status, data } = await api<{ error?: string }>('/api/cdr/products/non-existent-id-999');
    expect(status).toBe(404);
    expect(data).toHaveProperty('error');
  });
});

// ============================================================================
// 5. Product Search Filters
// ============================================================================
describe('Product Search Filters', () => {
  it('should filter by productCategory', async () => {
    const { data } = await api<{ products?: Array<{ productCategory: string }> }>(
      '/api/cdr/products?productCategory=RESIDENTIAL_MORTGAGES&limit=5',
    );
    for (const p of data.products ?? []) {
      expect(p.productCategory).toBe('RESIDENTIAL_MORTGAGES');
    }
  });

  it('should filter by rate range', async () => {
    const { data } = await api<{ products?: Array<{ bestRate?: number }> }>(
      '/api/cdr/products?minRate=0.04&maxRate=0.07&limit=5',
    );
    expect(data).toHaveProperty('products');
    for (const p of data.products ?? []) {
      if (p.bestRate != null) {
        expect(p.bestRate).toBeGreaterThanOrEqual(0.04);
        expect(p.bestRate).toBeLessThanOrEqual(0.07);
      }
    }
  });

  it('should support text search', async () => {
    const { data } = await api<{ products: unknown[]; total: number }>(
      '/api/cdr/products?searchText=home+loan&limit=5',
    );
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('total');
  });

  it('should support sorting by rate', async () => {
    const { data } = await api<{ products?: Array<{ bestRate?: number }> }>(
      '/api/cdr/products?sortBy=rate&sortOrder=asc&limit=10',
    );
    const rates = (data.products ?? []).map((p) => p.bestRate).filter((r) => r != null) as number[];
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]!);
    }
  });

  it('should return category summary', async () => {
    const { status, data } = await api<Array<{ productCategory: string; count: number }>>(
      '/api/cdr/products/categories',
    );
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
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
    const { data: search } = await api<{ products?: Array<{ id: string }> }>(
      '/api/cdr/products?limit=3',
    );
    const ids = (search.products ?? []).map((p) => p.id);
    if (ids.length < 2) {
      console.warn('[SKIP] Need at least 2 products for comparison');
      return;
    }

    const { status, data } = await api<{ products: Array<Record<string, unknown>> }>(
      '/api/cdr/products/compare',
      {
        method: 'POST',
        body: JSON.stringify({ productIds: ids }),
      },
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty('products');
    expect(data.products.length).toBe(ids.length);
    for (const p of data.products) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('lendingRates');
      expect(p).toHaveProperty('fees');
      expect(p).toHaveProperty('features');
    }
  });

  it('should reject empty productIds', async () => {
    const { status, data } = await api<{ error?: string }>('/api/cdr/products/compare', {
      method: 'POST',
      body: JSON.stringify({ productIds: [] }),
    });
    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
  });
});
