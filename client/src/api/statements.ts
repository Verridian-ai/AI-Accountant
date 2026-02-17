import { API_URL, getAuthHeaders } from './client';
import { Statement, BatchUploadResponse, BatchJobStatus, StatementGapAnalysis } from './types';

export async function fetchStatements(): Promise<Statement[]> {
  const res = await fetch(`${API_URL}/statements`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch statements');
  return res.json();
}

export async function uploadStatement(file: File): Promise<{
  id: string;
  message: string;
  isDuplicate?: boolean;
  existingFilename?: string;
  uploadedOn?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/statements/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (res.status === 409) {
    const data = await res.json();
    return {
      id: data.id,
      message: 'Duplicate file',
      isDuplicate: true,
      existingFilename: data.existingFilename,
      uploadedOn: data.uploadedOn,
    };
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Upload failed');
  }
  return res.json();
}

export async function reprocessStatement(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/statements/${id}/reprocess`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reprocess statement');
}

export async function uploadBatch(files: File[]): Promise<BatchUploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const res = await fetch(`${API_URL}/statements/batch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Batch upload failed' }));
    throw new Error(error.error || 'Batch upload failed');
  }
  return res.json();
}

export async function getBatchStatus(jobId: string): Promise<BatchJobStatus> {
  const res = await fetch(`${API_URL}/statements/batch/${jobId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to get batch status');
  return res.json();
}

export async function cancelBatch(jobId: string): Promise<{ cancelled: boolean }> {
  const res = await fetch(`${API_URL}/statements/batch/${jobId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to cancel batch');
  return res.json();
}

export async function retryBatch(jobId: string): Promise<{ retried: boolean }> {
  const res = await fetch(`${API_URL}/statements/batch/${jobId}/retry`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to retry batch');
  return res.json();
}

export async function fetchStatementGapAnalysis(): Promise<StatementGapAnalysis> {
  const res = await fetch(`${API_URL}/statements/gap-analysis`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch gap analysis');
  return res.json();
}
