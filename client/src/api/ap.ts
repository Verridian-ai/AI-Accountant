import { API_URL, getAuthHeaders } from './client';
import { Supplier, Bill, PurchaseOrder, APAgingReport, PaymentRun } from './types';

export const apApi = {
  // ── Suppliers ──
  fetchSuppliers: async (options?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<{ suppliers: Supplier[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.search) params.set('search', options.search);
    if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/suppliers${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  fetchSupplier: async (id: string): Promise<Supplier> => {
    const res = await fetch(`${API_URL}/suppliers/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch supplier');
    return res.json();
  },

  createSupplier: async (data: Partial<Supplier>): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create supplier');
    return res.json();
  },

  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<void> => {
    const res = await fetch(`${API_URL}/suppliers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update supplier');
  },

  archiveSupplier: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/suppliers/${id}/archive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to archive supplier');
  },

  // ── Bills ──
  fetchBills: async (options?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
  }): Promise<{ bills: Bill[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.supplierId) params.set('supplierId', options.supplierId);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/bills${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bills');
    return res.json();
  },

  fetchBill: async (id: string): Promise<Bill> => {
    const res = await fetch(`${API_URL}/bills/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch bill');
    return res.json();
  },

  createBill: async (data: Partial<Bill>): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bill');
    return res.json();
  },

  updateBill: async (id: string, data: Partial<Bill>): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bill');
  },

  approveBill: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to approve bill');
  },

  rejectBill: async (id: string, reason: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject bill');
  },

  payBill: async (
    id: string,
    data: { paymentDate: string; paymentMethod?: string; reference?: string },
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record bill payment');
  },

  voidBill: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/bills/${id}/void`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to void bill');
  },

  // ── AP Aging ──
  fetchAPAging: async (asOfDate?: string): Promise<APAgingReport> => {
    const params = new URLSearchParams();
    if (asOfDate) params.set('asOfDate', asOfDate);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/ap/aging${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch AP aging');
    return res.json();
  },

  // ── Supplier Bills (for detail view) ──
  fetchSupplierBills: async (
    supplierId: string,
    limit = 10,
  ): Promise<{ bills: Bill[]; total: number }> => {
    const res = await fetch(`${API_URL}/suppliers/${supplierId}/bills?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch supplier bills');
    return res.json();
  },

  // ── Purchase Orders ──
  fetchPurchaseOrders: async (options?: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
  }): Promise<{ orders: PurchaseOrder[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.supplierId) params.set('supplierId', options.supplierId);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/purchase-orders${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch purchase orders');
    return res.json();
  },

  fetchPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch purchase order');
    return res.json();
  },

  createPurchaseOrder: async (data: Partial<PurchaseOrder>): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create purchase order');
    return res.json();
  },

  updatePurchaseOrder: async (id: string, data: Partial<PurchaseOrder>): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update purchase order');
  },

  sendPurchaseOrder: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to send purchase order');
  },

  receivePurchaseOrder: async (
    id: string,
    data: {
      receiptDate: string;
      notes?: string;
      lines: Array<{ lineId: string; quantity: number }>;
    },
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to receive purchase order');
  },

  cancelPurchaseOrder: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/purchase-orders/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to cancel purchase order');
  },

  fetchThreeWayMatch: async (poId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/purchase-orders/${poId}/three-way-match`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch three-way match');
    return res.json();
  },

  // ── Payment Runs ──
  createPaymentRun: async (data: {
    paymentDate: string;
    bankReference?: string;
    billIds: string[];
  }): Promise<{ id: string }> => {
    const res = await fetch(`${API_URL}/supplier-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create payment run');
    const json = await res.json();
    return json.data ?? json;
  },

  fetchPaymentRun: async (id: string): Promise<PaymentRun> => {
    const res = await fetch(`${API_URL}/supplier-payments/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch payment run');
    const json = await res.json();
    return json.data ?? json;
  },

  processPaymentRun: async (id: string): Promise<void> => {
    // Process payment by marking each bill in the run as paid
    const run: any = await apApi.fetchPaymentRun(id);
    const billIds = run.billIds ?? run.bill_ids ?? [];
    const payDate = run.paymentDate ?? run.payment_date ?? new Date().toISOString().split('T')[0];
    for (const billId of billIds) {
      await apApi.payBill(billId, { paymentDate: payDate });
    }
  },

  // ── Push Notifications & Sync (Wave 24) ──
  getVapidKey: async (): Promise<{ publicKey: string; configured: boolean }> => {
    const res = await fetch(`${API_URL}/push/vapid-key`);
    if (!res.ok) throw new Error('Failed to get VAPID key');
    return res.json();
  },
  subscribePush: async (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    deviceName?: string,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ subscription, deviceName }),
    });
    if (!res.ok) throw new Error('Failed to subscribe to push');
    return res.json();
  },
  unsubscribePush: async (endpoint: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) throw new Error('Failed to unsubscribe from push');
    return res.json();
  },
  fetchNotificationPreferences: async (): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_URL}/notifications/preferences`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch notification preferences');
    return res.json();
  },
  updateNotificationPreferences: async (
    prefs: Record<string, unknown>,
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error('Failed to update notification preferences');
    return res.json();
  },
  syncOfflineChanges: async (operations: unknown[]): Promise<unknown> => {
    const res = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ operations }),
    });
    if (!res.ok) throw new Error('Sync failed');
    return res.json();
  },
  getSyncConflicts: async (): Promise<{ conflicts: unknown[]; count: number }> => {
    const res = await fetch(`${API_URL}/sync/conflicts`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get sync conflicts');
    return res.json();
  },
  resolveSyncConflict: async (
    conflictId: string,
    resolution: 'client_wins' | 'server_wins',
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/sync/resolve/${conflictId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ resolution }),
    });
    if (!res.ok) throw new Error('Failed to resolve conflict');
    return res.json();
  },
  getSyncLog: async (limit = 20, offset = 0): Promise<{ log: unknown[]; count: number }> => {
    const res = await fetch(`${API_URL}/sync/log?limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get sync log');
    return res.json();
  },
};
