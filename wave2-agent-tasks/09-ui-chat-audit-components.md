# Agent 9: UI Chat & Audit Components

## Role
Create 4 new UI components for streaming messages, mutation confirmation, agent progress, and audit trail viewing. Also modify FloatingChat and api.ts for mutation/streaming support.

## Priority: SUB-WAVE 3 (After Agent 7 — needs API endpoints)

## Files to CREATE

### 1. `client/src/features/chat/components/StreamingMessage.tsx`
**Purpose**: Progressive text rendering with typing animation for SSE-streamed responses

```typescript
interface StreamingMessageProps {
  tokens: string[];
  isComplete: boolean;
  agentType?: string;
}
```

- [ ] Render tokens progressively as they arrive (append to displayed text)
- [ ] Show blinking cursor `|` while `isComplete` is false
- [ ] Apply typing animation: each token fades in with a short delay
- [ ] Once complete, remove cursor and render full message
- [ ] Use `neu-raised` styling, consistent with existing chat message styling
- [ ] Support markdown rendering in the accumulated text (reuse existing markdown rendering if available)
- [ ] Show agent type badge above the streaming text (like AgentResponseCard from Wave 1)

### 2. `client/src/features/chat/components/ConfirmationCard.tsx`
**Purpose**: Before/after diff preview for agent-proposed mutations

```typescript
interface ConfirmationCardProps {
  mutationId: string;
  agentType: string;
  description: string;
  targetTable: string;
  beforeState?: Record<string, unknown>;
  afterState: Record<string, unknown>;
  confidence?: number;
  onConfirm: (mutationId: string) => void;
  onReject: (mutationId: string, reason?: string) => void;
}
```

- [ ] Display mutation description in bold header text
- [ ] Show agent type badge (reuse agent badge pattern from AgentResponseCard)
- [ ] Render before/after as a two-column diff:
  - Left: "Before" with red-tinted values
  - Right: "After" with green-tinted values
  - Changed fields highlighted
- [ ] Show confidence as a percentage bar (green/yellow/red per Wave 1 IntentDebugPanel pattern)
- [ ] "Approve" button: green, calls `onConfirm(mutationId)`
- [ ] "Reject" button: red, optionally shows a text input for reason, calls `onReject(mutationId, reason)`
- [ ] Neumorphic card styling: `neu-raised` background, gold `#FFCC00` approve button glow
- [ ] Disable buttons while processing (loading state)
- [ ] Show "Expired" state if mutation has expired

### 3. `client/src/features/chat/components/AgentProgressBar.tsx`
**Purpose**: Real-time agent execution progress

```typescript
interface AgentProgressBarProps {
  step: number;
  total: number;
  description: string;
  agentType?: string;
  isComplete: boolean;
}
```

- [ ] Horizontal progress bar showing `step / total` filled
- [ ] Display description text below the bar
- [ ] Gold `#FFCC00` fill color for the progress bar
- [ ] Agent type as a small badge/chip above the bar
- [ ] Smooth animation when step increments (`transition-all duration-300`)
- [ ] When `isComplete`, show a checkmark icon and change bar to green
- [ ] Compact design — fits within chat message area without taking too much space
- [ ] Use `Loader2` spinning icon when not complete (matching existing pattern)

### 4. `client/src/features/transactions/components/AuditTrailViewer.tsx`
**Purpose**: View agent audit log with filtering

```typescript
interface AuditTrailViewerProps {
  /** If provided, show audit for this specific mutation */
  mutationId?: string;
  /** If provided, filter to this agent type */
  agentType?: string;
}
```

- [ ] Fetch audit entries from `GET /api/agent-audit` with query params
- [ ] Filter controls:
  - Agent type dropdown (list of all agent types)
  - Action type dropdown (mutation_proposed, mutation_confirmed, etc.)
  - Date range: from/to date inputs
- [ ] Results table with columns:
  - Timestamp (formatted as relative time, e.g., "2 hours ago")
  - Agent Type (badge)
  - Action (color-coded: green for confirmed/executed, red for rejected/failed, yellow for proposed/pending)
  - Target Table
  - Description (from metadata)
- [ ] Expandable row: click to see before/after JSON state
- [ ] Pagination: Load more button or infinite scroll
- [ ] Empty state: "No audit entries found" with filter-clearing action
- [ ] Neumorphic table styling: `neu-inset` for header, `neu-raised` for rows

## Files to MODIFY

### 5. `client/src/features/chat/FloatingChat.tsx`

#### Change 1: Add streaming state
```typescript
const [isStreaming, setIsStreaming] = useState(false);
const [streamTokens, setStreamTokens] = useState<string[]>([]);
const [pendingMutations, setPendingMutations] = useState<any[]>([]);
const [sessionId, setSessionId] = useState<string | undefined>();
const [progress, setProgress] = useState<{
  step: number; total: number; description: string;
} | null>(null);
```

#### Change 2: Add streaming message handler
```typescript
const handleStreamingChat = async (query: string) => {
  setIsStreaming(true);
  setStreamTokens([]);
  setProgress(null);

  try {
    const eventSource = api.streamChat(query, sessionId);

    eventSource.addEventListener('token', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setStreamTokens(prev => [...prev, data.token]);
    });

    eventSource.addEventListener('agent_selected', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setCurrentAgent(data.agentType);
    });

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setProgress({ step: data.step, total: data.total, description: data.description });
    });

    eventSource.addEventListener('mutation_proposed', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setPendingMutations(prev => [...prev, data.mutation]);
    });

    eventSource.addEventListener('complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      // Add the complete response as an assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response.answer,
        type: 'agent_response',
        agentType: data.response.agentType,
        data: data.response.data,
        intentClassification: data.response.intentClassification,
        suggestedFollowups: data.response.suggestedFollowups,
      }]);
      setSessionId(data.response.sessionId);
      setIsStreaming(false);
      setProgress(null);
      eventSource.close();
    });

    eventSource.addEventListener('error', () => {
      setIsStreaming(false);
      setProgress(null);
      eventSource.close();
    });
  } catch (error) {
    setIsStreaming(false);
    console.error('[FloatingChat] Streaming error:', error);
  }
};
```

#### Change 3: Add mutation confirmation handlers
```typescript
const handleConfirmMutation = async (mutationId: string) => {
  try {
    await api.confirmMutation(mutationId);
    setPendingMutations(prev => prev.filter(m => m.mutationId !== mutationId));
  } catch (error) {
    console.error('[FloatingChat] Confirm failed:', error);
  }
};

const handleRejectMutation = async (mutationId: string, reason?: string) => {
  try {
    await api.rejectMutation(mutationId, reason);
    setPendingMutations(prev => prev.filter(m => m.mutationId !== mutationId));
  } catch (error) {
    console.error('[FloatingChat] Reject failed:', error);
  }
};
```

#### Change 4: Render streaming and confirmation components
In the message rendering section:
- [ ] When `isStreaming`, render `<StreamingMessage>` with current tokens
- [ ] When `progress` is set, render `<AgentProgressBar>`
- [ ] For each item in `pendingMutations`, render `<ConfirmationCard>`
- [ ] Pass `handleConfirmMutation` and `handleRejectMutation` to ConfirmationCard

### 6. `client/src/api.ts`

#### Change: Add mutation and streaming API methods

```typescript
/**
 * Start an SSE streaming chat session.
 * Returns an EventSource-like object that emits typed events.
 */
streamChat(query: string, sessionId?: string): EventSource {
  // POST to /api/chat/stream with fetch, then create EventSource
  // Note: Standard EventSource only supports GET, so we use fetch + ReadableStream
  const url = `${BASE_URL}/api/chat/stream`;
  const body = JSON.stringify({ query, sessionId });

  // Use fetch with streaming response
  const eventTarget = new EventTarget();
  const abortController = new AbortController();

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body,
    signal: abortController.signal,
  }).then(async (response) => {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent) {
          const data = line.slice(6);
          eventTarget.dispatchEvent(
            new MessageEvent(currentEvent, { data })
          );
          currentEvent = '';
        }
      }
    }
  }).catch((error) => {
    if (error.name !== 'AbortError') {
      eventTarget.dispatchEvent(new Event('error'));
    }
  });

  // Return an EventSource-like object
  return {
    addEventListener: (type: string, handler: EventListenerOrEventListenerObject) =>
      eventTarget.addEventListener(type, handler),
    removeEventListener: (type: string, handler: EventListenerOrEventListenerObject) =>
      eventTarget.removeEventListener(type, handler),
    close: () => abortController.abort(),
  } as unknown as EventSource;
},

/**
 * Confirm a pending mutation.
 */
async confirmMutation(actionId: string, reason?: string): Promise<{ success: boolean; mutation: unknown }> {
  const res = await fetch(`${BASE_URL}/api/chat/confirm/${actionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ reason }),
  });
  return res.json();
},

/**
 * Reject a pending mutation.
 */
async rejectMutation(actionId: string, reason?: string): Promise<{ success: boolean; mutation: unknown }> {
  const res = await fetch(`${BASE_URL}/api/chat/reject/${actionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ reason }),
  });
  return res.json();
},

/**
 * Fetch pending mutations for the current session.
 */
async fetchPendingMutations(sessionId: string): Promise<{ mutations: unknown[] }> {
  const res = await fetch(`${BASE_URL}/api/chat/pending?sessionId=${sessionId}`, {
    headers: getAuthHeaders(),
  });
  return res.json();
},

/**
 * Fetch audit log entries.
 */
async fetchAuditLog(options?: {
  agentType?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ entries: unknown[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.agentType) params.set('agentType', options.agentType);
  if (options?.action) params.set('action', options.action);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.limit) params.set('limit', String(options.limit));

  const res = await fetch(`${BASE_URL}/api/agent-audit?${params}`, {
    headers: getAuthHeaders(),
  });
  return res.json();
},
```

#### Key Requirements:
- [ ] `streamChat()` uses fetch + ReadableStream (NOT native EventSource which only supports GET)
- [ ] SSE parsing handles `event:` and `data:` lines correctly
- [ ] `confirmMutation()` and `rejectMutation()` use POST method
- [ ] `fetchPendingMutations()` uses GET with query param
- [ ] `fetchAuditLog()` builds URLSearchParams from options
- [ ] All methods use `BASE_URL` and `getAuthHeaders()` from existing patterns
- [ ] Do NOT modify existing API methods

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] StreamingMessage renders progressive tokens with cursor animation
- [ ] ConfirmationCard shows before/after diff with approve/reject buttons
- [ ] AgentProgressBar shows step progress with animation
- [ ] AuditTrailViewer fetches and displays audit entries with filters
- [ ] FloatingChat handles SSE streaming and mutation confirmation
- [ ] api.ts `streamChat()` parses SSE events correctly
- [ ] All components use neumorphic styling
- [ ] Clicking approve calls `confirmMutation()`, reject calls `rejectMutation()`
- [ ] Create marker file: `.agent-done-W2-09`

## Dependencies
- **Requires**: Agent 7 (API endpoints must exist for client to connect)
- **Reuses**: Wave 1 components (AgentResponseCard badge pattern, IntentDebugPanel confidence display)
