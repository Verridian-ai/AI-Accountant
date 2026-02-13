# Agent 8: UI Chat Enhancer

## Role
Enhance the FloatingChat and ChatInterface components to support structured agent responses, and create 3 new UI components for rich agent response rendering.

## Priority: SUB-WAVE 3 (After Agent 5)

## Files to CREATE

### 1. `client/src/features/chat/components/AgentResponseCard.tsx`
**Purpose**: Rich card component for rendering structured agent responses (replaces plain text for agent-sourced messages)

```typescript
interface AgentResponseCardProps {
  agentType: string;
  answer: string;
  data?: unknown;
  suggestedFollowups?: string[];
  onFollowupClick?: (followup: string) => void;
}
```

- [ ] Display agent type as a badge (e.g., "GST Calculator", "Budget Analyzer")
- [ ] Render `answer` as formatted markdown text
- [ ] If `data` contains tabular data, render as a simple styled table
- [ ] If `suggestedFollowups` present, render as clickable pill/chip buttons
- [ ] Use neumorphic styling: `neu-raised` class, gold accent color `#FFCC00`
- [ ] Agent type badge colors: map agent types to semantic colors (green for financial, blue for analysis, etc.)
- [ ] Lucide icons per agent type (Calculator for gst_calculator, PieChart for budget_analyzer, etc.)

### 2. `client/src/features/chat/components/IntentDebugPanel.tsx`
**Purpose**: Developer debug panel showing intent classification details. Only visible in dev mode.

```typescript
interface IntentDebugPanelProps {
  intentClassification?: {
    intent: string;
    confidence: number;
  };
  agentType?: string;
  visible: boolean;
}
```

- [ ] Compact collapsible panel below the chat input
- [ ] Show intent category, confidence score (as percentage bar), selected agent
- [ ] Green/yellow/red confidence indicator (>0.8 green, 0.6-0.8 yellow, <0.6 red)
- [ ] Only render when `visible` is true (toggled by a dev mode setting or keyboard shortcut)
- [ ] Styled with `neu-inset` class, muted text colors

### 3. `client/src/features/chat/components/AgentRoutingIndicator.tsx`
**Purpose**: Visual indicator showing which agent is currently processing the request

```typescript
interface AgentRoutingIndicatorProps {
  agentType?: string;
  isProcessing: boolean;
}
```

- [ ] Shows agent name + spinning icon while processing
- [ ] Agent name formatted nicely (e.g., `gst_calculator` → "GST Calculator")
- [ ] Uses `Loader2` icon with `animate-spin` from Lucide (matching existing pattern)
- [ ] Fades in/out with transition animation
- [ ] Positioned above the chat input area

## Files to MODIFY

### 4. `client/src/features/chat/FloatingChat.tsx`

#### Changes:
- [ ] Update message type from `{role, content}` to enhanced type:
```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'agent_response';
  agentType?: string;
  data?: unknown;
  intentClassification?: { intent: string; confidence: number };
  suggestedFollowups?: string[];
}
```
- [ ] Add state for `isProcessing` and `currentAgent`:
```typescript
const [isProcessing, setIsProcessing] = useState(false);
const [currentAgent, setCurrentAgent] = useState<string | undefined>();
```
- [ ] Update the send message handler to use the new response shape:
  - Before sending: `setIsProcessing(true)`
  - On response: extract `agentType`, `intentClassification`, `suggestedFollowups` from response
  - After response: `setIsProcessing(false)`, `setCurrentAgent(undefined)`
- [ ] Render `AgentRoutingIndicator` above the input when `isProcessing`
- [ ] Pass `onFollowupClick` to AgentResponseCard that triggers a new chat message

### 5. `client/src/features/chat/ChatInterface.tsx`

#### Changes:
- [ ] Import `AgentResponseCard` component
- [ ] In message rendering loop, check `message.type`:
  - If `'agent_response'` and `message.agentType` present → render `<AgentResponseCard>`
  - Otherwise → render existing plain text message
- [ ] Import and conditionally render `IntentDebugPanel` (check for dev mode)
- [ ] Add keyboard shortcut (Ctrl+Shift+D) to toggle debug panel visibility

### 6. `client/src/api.ts`

#### Changes:
- [ ] Update `sendChatMessage()` return type:
```typescript
interface ChatApiResponse {
  answer: string;
  agentType?: string;
  intentClassification?: { intent: string; confidence: number };
  actions?: Array<{ id: string; type: string; description: string; data: unknown }>;
  suggestedFollowups?: string[];
  data?: unknown;
}
```
- [ ] The function should return the full response object (not just `answer`)
- [ ] Ensure backward compatibility: if server returns only `{ answer }`, the enhanced fields are simply `undefined`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] AgentResponseCard renders agent badge + answer text + follow-up buttons
- [ ] IntentDebugPanel shows/hides with dev mode toggle
- [ ] AgentRoutingIndicator shows spinner with agent name during processing
- [ ] FloatingChat correctly handles both old `{role, content}` and new enhanced message types
- [ ] ChatInterface renders AgentResponseCard for agent-typed messages
- [ ] api.ts sendChatMessage accepts existing payload and handles enhanced response
- [ ] Clicking a follow-up chip sends that text as a new chat message
- [ ] Create marker file: `.agent-done-W01-08`

## Dependencies
- **Requires**: Agent 5 (chat endpoint must be rewritten to return enhanced response)
- **Reuses**: Existing Tailwind classes, Lucide icons, neumorphic styling patterns
