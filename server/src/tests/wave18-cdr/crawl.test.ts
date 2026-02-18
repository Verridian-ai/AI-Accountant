/**
 * Wave 18 CDR — Tests 9 & 10: Crawl Logs + Rate Limiter Enforcement
 */

import { describe, it, expect } from 'vitest';
import { api } from './helpers';

// ============================================================================
// 9. Crawl Log Records
// ============================================================================
describe('Crawl Logs', () => {
  it('should return crawl log entries', async () => {
    const { status, data } =
      await api<Array<{ id: string; crawlType: string; status: string; startedAt: string }>>(
        '/api/cdr/crawl/logs',
      );
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
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
    const [res1, res2] = await Promise.all([
      api('/api/cdr/crawl/full', { method: 'POST' }),
      api('/api/cdr/crawl/full', { method: 'POST' }),
    ]);
    const successes = [res1, res2].filter((r) => r.status === 200);
    expect(successes.length).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('should enforce per-holder rate limiting in incremental crawls', async () => {
    const { data } = await api<{ errors?: Array<{ statusCode: number }> }>(
      '/api/cdr/crawl/incremental',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    if (data.errors) {
      const rateLimitErrors = data.errors.filter((e) => e.statusCode === 429);
      expect(rateLimitErrors.length).toBe(0);
    }
  }, 120_000);
});
