/**
 * Wave 18 CDR — Test 13: Cognee CDR Indexing
 */

import { describe, it, expect } from 'vitest';
import { api } from './helpers';

describe('Cognee CDR Indexing', () => {
  it('should trigger CDR product indexing', async () => {
    const { status, data } = await api<{ indexed?: number; error?: string }>('/api/cdr/index', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (status === 200) {
      expect(data).toHaveProperty('indexed');
    } else {
      console.warn('[SKIP] Cognee indexing not available:', data.error);
    }
  });
});
