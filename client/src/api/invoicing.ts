import { API_URL, getAuthHeaders } from './client';

export const invoicingApi = {
  // ── Customers ──
  listCustomers: async (options?: {
    offset?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.search) params.set('search', options.search);
    if (options?.isActive !== undefined) params.set('isActive', String(options.isActive));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/customers${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch customers');
    return res.json();
  },

  getCustomer: async (id: string) => {
    const res = await fetch(`${API_URL}/customers/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch customer');
    return res.json();
  },

  createCustomer: async (data: any) => {
    const res = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create customer');
    return res.json();
  },

  updateCustomer: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update customer');
    return res.json();
  },

  archiveCustomer: async (id: string) => {
    const res = await fetch(`${API_URL}/customers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to archive customer');
    return res.json();
  },

  listContacts: async (customerId: string) => {
    const res = await fetch(`${API_URL}/customers/${customerId}/contacts`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch contacts');
    return res.json();
  },

  addContact: async (customerId: string, data: any) => {
    const res = await fetch(`${API_URL}/customers/${customerId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add contact');
    return res.json();
  },

  // ── Invoices ──
  listInvoices: async (options?: {
    offset?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const params = new URLSearchParams();
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.customerId) params.set('customerId', options.customerId);
    if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options?.dateTo) params.set('dateTo', options.dateTo);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/invoices${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch invoices');
    return res.json();
  },

  getInvoice: async (id: string) => {
    const res = await fetch(`${API_URL}/invoices/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch invoice');
    return res.json();
  },

  createInvoice: async (data: any) => {
    const res = await fetch(`${API_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create invoice');
    return res.json();
  },

  updateInvoice: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update invoice');
    return res.json();
  },

  sendInvoice: async (id: string) => {
    const res = await fetch(`${API_URL}/invoices/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to send invoice');
    return res.json();
  },

  voidInvoice: async (id: string) => {
    const res = await fetch(`${API_URL}/invoices/${id}/void`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to void invoice');
    return res.json();
  },

  downloadInvoicePDF: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/invoices/${id}/pdf`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to download invoice PDF');
    return res.blob();
  },

  recordPayment: async (invoiceId: string, data: any) => {
    const res = await fetch(`${API_URL}/invoices/${invoiceId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record payment');
    return res.json();
  },

  createCreditNote: async (data: any) => {
    const res = await fetch(`${API_URL}/invoices/credit-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create credit note');
    return res.json();
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const res = await fetch(`${API_URL}/invoices/next-number`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get next invoice number');
    const json = await res.json();
    return json.nextNumber;
  },

  getInvoiceSummary: async () => {
    const res = await fetch(`${API_URL}/invoices/summary`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch invoice summary');
    return res.json();
  },
};
