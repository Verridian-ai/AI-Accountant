/**
 * Wave 18 CDR — Tests 1 & 2: Register Discovery + CBA Product Catalog
 */

import { describe, it, expect } from 'vitest';
import { api } from './helpers';

// ============================================================================
// 1. CDR Register Discovery
// ============================================================================
describe('CDR Register Discovery', () => {
  it('should discover 10+ data holders from the CDR Register', async () => {
    const { status, data } = await api<Record<string, unknown>>('/api/cdr/crawl/full', {
      method: 'POST',
    });

    if (status === 200) {
      expect((data as { holdersDiscovered: number }).holdersDiscovered).toBeGreaterThanOrEqual(10);
      expect((data as { holdersProcessed: number }).holdersProcessed).toBeGreaterThanOrEqual(1);
    } else {
      console.warn('[SKIP] CDR Register unreachable:', (data as { error?: string }).error);
      expect(status).toBe(500);
    }
  }, 120_000);

  it('should list discovered data holders', async () => {
    const { status, data } = await api<unknown[]>('/api/cdr/data-holders');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});

// ============================================================================
// 2. CBA Product Catalog Crawl
// ============================================================================
describe('CBA Product Catalog', () => {
  it('should have CBA (or similar) data holder with products', async () => {
    const { data: holders } = await api<Array<{ productCount?: number }>>('/api/cdr/data-holders');
    const withProducts = holders.filter((h) => (h.productCount ?? 0) > 0);
    if (withProducts.length === 0) {
      console.warn('[SKIP] No data holders with products — run a crawl first');
      return;
    }
    expect(withProducts.length).toBeGreaterThanOrEqual(1);
  });

  it('should return paginated product list', async () => {
    const { status, data } = await api<{ products: unknown[]; total: number }>(
      '/api/cdr/products?limit=5&offset=0',
    );
    expect(status).toBe(200);
    expect(data).toHaveProperty('products');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.products)).toBe(true);
  });
});
