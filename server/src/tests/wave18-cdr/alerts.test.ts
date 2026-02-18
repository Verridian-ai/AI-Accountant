/**
 * Wave 18 CDR — Test 12: Rate Alert CRUD
 */

import { describe, it, expect } from 'vitest';
import { api } from './helpers';

describe('Rate Alerts', () => {
  let alertId: string | null = null;

  it('should create a rate alert', async () => {
    const { status, data } = await api<{ id: string }>('/api/cdr/alerts', {
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
    const { status, data } = await api<Array<{ id: string }>>('/api/cdr/alerts');
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    if (alertId) {
      const found = data.find((a) => a.id === alertId);
      expect(found).toBeDefined();
    }
  });

  it('should soft-delete an alert', async () => {
    if (!alertId) return;
    const { status, data } = await api<{ success: boolean }>(`/api/cdr/alerts/${alertId}`, {
      method: 'DELETE',
    });
    expect(status).toBe(200);
    expect(data).toHaveProperty('success', true);

    const { data: alerts } = await api<Array<{ id: string }>>('/api/cdr/alerts');
    const found = alerts.find((a) => a.id === alertId);
    expect(found).toBeUndefined();
  });
});
