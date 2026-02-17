/**
 * Streaming Service — Type Definitions
 */

import type { StreamSession } from '../claude/types.js';

// ============================================================================
// INTERNAL SESSION STATE
// ============================================================================

export interface InternalSession extends StreamSession {
  abortController: AbortController;
  userId: string;
  createdAt: number;
}

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

export interface SSETokenEvent {
  event: 'token';
  data: {
    sessionId: string;
    content: string;
    done: false;
  };
}

export interface SSEDoneEvent {
  event: 'done';
  data: {
    sessionId: string;
    totalTokens: number;
    latencyMs: number;
  };
}

export interface SSEErrorEvent {
  event: 'error';
  data: {
    sessionId: string;
    error: string;
  };
}

export type SSEStreamEvent = SSETokenEvent | SSEDoneEvent | SSEErrorEvent;
