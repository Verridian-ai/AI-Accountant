import { BASE_URL, getAuthHeaders } from './client';

export async function fetchEmployees(
  userId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  },
): Promise<{ data: any[]; total: number }> {
  const qp = new URLSearchParams({ userId });
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  if (params?.status) qp.set('status', params.status);
  if (params?.search) qp.set('search', params.search);
  const res = await fetch(`${BASE_URL}/api/payroll/employees?${qp}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch employees');
  return res.json();
}

export async function createEmployee(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create employee');
  return res.json();
}

export async function fetchEmployee(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch employee');
  return res.json();
}

export async function updateEmployee(id: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update employee');
  return res.json();
}

export async function deleteEmployee(id: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete employee');
  return res.json();
}

export async function fetchBankDetails(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/bank-details`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch bank details');
  return res.json();
}

export async function addBankDetails(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/bank-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add bank details');
  return res.json();
}

export async function fetchSuperFund(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/super`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch super fund');
  return res.json();
}

export async function addSuperFund(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/super`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add super fund');
  return res.json();
}

export async function fetchTaxDeclaration(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/tax-declaration`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tax declaration');
  return res.json();
}

export async function submitTaxDeclaration(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/tax-declaration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to submit tax declaration');
  return res.json();
}

export async function fetchPayCategories(
  userId: string,
  params?: {
    page?: number;
    limit?: number;
  },
): Promise<{ data: any[]; total: number }> {
  const qp = new URLSearchParams({ userId });
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));
  const res = await fetch(`${BASE_URL}/api/payroll/pay-categories?${qp}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch pay categories');
  return res.json();
}

export async function createPayCategory(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/pay-categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create pay category');
  return res.json();
}

export async function seedDefaultPayCategories(userId: string): Promise<void> {
  const defaults = [
    { userId, name: 'Base Hourly', type: 'ordinary', rateType: 'hourly' },
    { userId, name: 'Base Salary', type: 'ordinary', rateType: 'annual' },
    { userId, name: 'Overtime 1.5x', type: 'overtime', rateType: 'hourly' },
    { userId, name: 'Overtime 2.0x', type: 'overtime', rateType: 'hourly' },
    { userId, name: 'Meal Allowance', type: 'allowance', rateType: 'fixed' },
    { userId, name: 'Travel Allowance', type: 'allowance', rateType: 'fixed' },
    { userId, name: 'Union Fees', type: 'deduction', rateType: 'fixed' },
    { userId, name: 'Super Guarantee', type: 'super', rateType: 'fixed' },
    { userId, name: 'Salary Sacrifice Super', type: 'super', rateType: 'fixed' },
    { userId, name: 'Annual Leave', type: 'leave', rateType: 'hourly' },
    { userId, name: 'Personal/Carer Leave', type: 'leave', rateType: 'hourly' },
    { userId, name: 'Long Service Leave', type: 'leave', rateType: 'hourly' },
  ];
  for (const cat of defaults) {
    await createPayCategory(cat);
  }
}

export async function fetchPayStructure(employeeId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/pay-structure`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch pay structure');
  return res.json();
}

export async function setPayStructure(employeeId: string, data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/employees/${employeeId}/pay-structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to set pay structure');
  return res.json();
}
