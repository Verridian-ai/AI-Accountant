/**
 * SSE Streaming Types — Event types and interfaces for SSE streaming.
 */

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

/**
 * Types of SSE events sent during a streaming chat response.
 */
export type StreamEventType =
  | 'token' // Progressive text token
  | 'tool_start' // Agent started executing a tool
  | 'tool_end' // Agent finished executing a tool
  | 'mutation_proposed' // Agent proposed a DB mutation
  | 'agent_selected' // Intent router selected an agent
  | 'progress' // Progress update (step count, etc.)
  | 'error' // Non-fatal error during processing
  | 'complete'; // Final response with full ChatResponse

/**
 * SSE event payload.
 */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: string;
}

// ============================================================================
// EVENT BUS ABSTRACTION (D03-B1: swappable for Redis pub/sub)
// ============================================================================

/**
 * EventBus interface — abstraction layer for SSE event delivery.
 * Current implementation: Node.js EventEmitter (in-process).
 * Future: Redis pub/sub adapter in Wave 17/21.
 */
export interface EventBus {
  emit(channel: string, data: unknown): void;
  subscribe(channel: string, handler: (data: unknown) => void): () => void;
}

// ============================================================================
// STREAM WRITER INTERFACE
// ============================================================================

/**
 * Writer interface for SSE streaming.
 * Wraps a write function to provide a clean, typed API for sending events.
 */
export interface StreamWriter {
  /** Send a typed SSE event */
  sendEvent(type: StreamEventType, data: unknown): void;
  /** Send a text token (shorthand for sendEvent('token', ...)) */
  sendToken(token: string): void;
  /** Send tool execution start event */
  sendToolStart(toolName: string, toolInput?: unknown): void;
  /** Send tool execution end event */
  sendToolEnd(toolName: string, toolResult?: unknown): void;
  /** Send mutation proposal event */
  sendMutationProposal(mutation: unknown): void;
  /** Send agent selection event */
  sendAgentSelected(agentType: string, confidence: number): void;
  /** Send progress update */
  sendProgress(step: number, total: number, description: string): void;
  /** Send error event (non-fatal) */
  sendError(message: string): void;
  /** Send final complete event with full response */
  sendComplete(response: unknown): void;
  /** Close the SSE stream */
  close(): void;
  /** Check if the stream is still open */
  isOpen(): boolean;
}
