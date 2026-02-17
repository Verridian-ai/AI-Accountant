import { API_URL, getAuthHeaders } from './client';
import { StreamEvent, MutationEvent, AuditEntry } from './types';

export async function sendChatMessage(query: string): Promise<{ answer: string }> {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Failed to send chat message');
  return res.json();
}

export const mutationApi = {
  /** Stream a chat query via SSE, returning an EventSource-like async iterator */
  streamChat: (_query: string, _sessionId?: string): EventSource => {
    // We use a POST via fetch + ReadableStream instead of EventSource (which is GET-only).
    // For simplicity, return a proxy that consumers can listen to.
    // Callers should use fetchStreamChat() below for the full streaming experience.
    throw new Error('Use fetchStreamChat() for POST-based SSE streaming');
  },

  /** POST-based SSE streaming chat — returns parsed events via callback */
  fetchStreamChat: async (
    query: string,
    onEvent: (event: StreamEvent) => void,
    sessionId?: string,
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ query, sessionId }),
    });

    if (!res.ok) throw new Error('Streaming chat failed');
    if (!res.body) throw new Error('No response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEventType) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent({ type: currentEventType, data });
          } catch {
            // Skip malformed JSON
          }
          currentEventType = '';
        }
      }
    }
  },

  /** Confirm a pending mutation */
  confirmMutation: async (
    actionId: string,
    reason?: string,
  ): Promise<{ success: boolean; mutation: MutationEvent }> => {
    const res = await fetch(`${API_URL}/chat/confirm/${actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to confirm mutation');
    return res.json();
  },

  /** Reject a pending mutation */
  rejectMutation: async (
    actionId: string,
    reason?: string,
  ): Promise<{ success: boolean; mutation: MutationEvent }> => {
    const res = await fetch(`${API_URL}/chat/reject/${actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject mutation');
    return res.json();
  },

  /** Fetch pending mutations for a session */
  fetchPendingMutations: async (sessionId: string): Promise<{ mutations: MutationEvent[] }> => {
    const res = await fetch(`${API_URL}/chat/pending?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch pending mutations');
    return res.json();
  },

  /** Fetch audit log entries */
  fetchAuditLog: async (options?: {
    agentType?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<{ entries: AuditEntry[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.agentType) params.set('agentType', options.agentType);
    if (options?.action) params.set('action', options.action);
    if (options?.from) params.set('from', options.from);
    if (options?.to) params.set('to', options.to);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/agent-audit${qs ? `?${qs}` : ''}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit log');
    return res.json();
  },
};

export const streamingApi = {
  /** Fetch stream session history */
  fetchHistory: (userId = 'default', limit = 50, offset = 0) =>
    fetch(`${API_URL}/stream/history?userId=${userId}&limit=${limit}&offset=${offset}`, {
      headers: getAuthHeaders(),
    }).then((r) => r.json()),

  /** Get a specific session's status */
  getSession: (sessionId: string) =>
    fetch(`${API_URL}/stream/session/${sessionId}`, {
      headers: getAuthHeaders(),
    }).then((r) => r.json()),

  /** Cancel an active stream session */
  cancelSession: (sessionId: string) =>
    fetch(`${API_URL}/stream/session/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then((r) => r.json()),
};

export const migrationApi = {
  /** List all agent migration statuses */
  fetchStatus: () =>
    fetch(`${API_URL}/migration/status`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Get migration benchmarks (legacy vs Vercel comparison) */
  fetchBenchmarks: () =>
    fetch(`${API_URL}/migration/benchmarks`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Rollback an agent to legacy mode */
  rollback: (agentType: string) =>
    fetch(`${API_URL}/migration/rollback/${agentType}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).then((r) => r.json()),
};

export const schemaApi = {
  /** List all registered schemas */
  fetchSchemas: () =>
    fetch(`${API_URL}/schemas`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Get schema for a specific agent type */
  getSchema: (agentType: string) =>
    fetch(`${API_URL}/schemas/${agentType}`, { headers: getAuthHeaders() }).then((r) => r.json()),

  /** Validate output against an agent's schema */
  validate: (agentType: string, output: unknown) =>
    fetch(`${API_URL}/schemas/${agentType}/validate`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ output }),
    }).then((r) => r.json()),

  /** Get validation stats for an agent type */
  getStats: (agentType: string) =>
    fetch(`${API_URL}/schemas/${agentType}/stats`, { headers: getAuthHeaders() }).then((r) =>
      r.json(),
    ),
};
