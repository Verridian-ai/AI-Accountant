/**
 * SSE Streaming Service (Wave 2 — Agent 05)
 *
 * Provides progressive SSE streaming of chat responses, including text tokens,
 * tool execution events, mutation proposals, and agent selection notifications.
 *
 * Architecture:
 * - StreamWriter: per-request writer that sends typed SSE events
 * - EventBus: abstraction over Node.js EventEmitter (swappable for Redis pub/sub)
 * - StreamingService: factory that creates StreamWriters and manages the EventBus
 *
 * Wire format matches the existing `/api/events` pattern:
 *   event: {type}\ndata: {json}\n\n
 *
 * REVISION NOTES:
 * - D03-B1: EventBus abstraction for future Redis pub/sub swap
 * - D03-B1: Per-connection write timeout (5s) and cleanup on disconnect
 * - Does NOT modify the existing `GET /api/events` SSE endpoint
 */

import { EventEmitter } from 'events';
import type { Context } from 'hono';
import { stream as honoStream } from 'hono/streaming';

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

/**
 * Default EventBus implementation using Node.js EventEmitter.
 */
export class EventEmitterBus implements EventBus {
  private emitter: EventEmitter;

  constructor(emitter?: EventEmitter) {
    this.emitter = emitter ?? new EventEmitter();
    // D03-B1: Scale for concurrent SSE connections
    this.emitter.setMaxListeners(500);
  }

  emit(channel: string, data: unknown): void {
    this.emitter.emit(channel, data);
  }

  subscribe(channel: string, handler: (data: unknown) => void): () => void {
    this.emitter.on(channel, handler);
    return () => {
      this.emitter.off(channel, handler);
    };
  }
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

// ============================================================================
// CONSTANTS
// ============================================================================

/** Per-connection write timeout in ms (D03-B1). */
const WRITE_TIMEOUT_MS = 5000;

/** Default heartbeat interval in ms (matches existing /api/events endpoint). */
const HEARTBEAT_INTERVAL_MS = 30000;

// ============================================================================
// STREAM WRITER FACTORY (internal)
// ============================================================================

/**
 * Build a StreamWriter backed by a raw write function.
 * Used by both handleSSE() and createWriter().
 */
function buildStreamWriter(writeFn: (raw: string) => void, onClose?: () => void): StreamWriter {
  let open = true;

  const writeSSE = (eventType: string, data: unknown): void => {
    if (!open) return;
    try {
      const payload = JSON.stringify(data);
      writeFn(`event: ${eventType}\ndata: ${payload}\n\n`);
    } catch (err) {
      console.warn('[StreamingService] Failed to write SSE event:', err);
      open = false;
    }
  };

  const ts = (): string => new Date().toISOString();

  return {
    sendEvent(type: StreamEventType, data: unknown): void {
      const envelope =
        typeof data === 'object' && data !== null
          ? { ...data, timestamp: ts() }
          : { value: data, timestamp: ts() };
      writeSSE(type, envelope);
    },

    sendToken(token: string): void {
      writeSSE('token', { token, timestamp: ts() });
    },

    sendToolStart(toolName: string, toolInput?: unknown): void {
      writeSSE('tool_start', { tool: toolName, input: toolInput, timestamp: ts() });
    },

    sendToolEnd(toolName: string, toolResult?: unknown): void {
      writeSSE('tool_end', { tool: toolName, result: toolResult, timestamp: ts() });
    },

    sendMutationProposal(mutation: unknown): void {
      writeSSE('mutation_proposed', { mutation, timestamp: ts() });
    },

    sendAgentSelected(agentType: string, confidence: number): void {
      writeSSE('agent_selected', { agentType, confidence, timestamp: ts() });
    },

    sendProgress(step: number, total: number, description: string): void {
      writeSSE('progress', { step, total, description, timestamp: ts() });
    },

    sendError(message: string): void {
      writeSSE('error', { message, timestamp: ts() });
    },

    sendComplete(response: unknown): void {
      writeSSE('complete', { response, timestamp: ts() });
      // Auto-close after sending the final event
      open = false;
      onClose?.();
    },

    close(): void {
      open = false;
      onClose?.();
    },

    isOpen(): boolean {
      return open;
    },
  };
}

// ============================================================================
// STREAMING SERVICE
// ============================================================================

/**
 * StreamingService creates SSE streams for progressive chat responses.
 *
 * Primary usage via handleSSE() in a Hono route:
 *
 *   app.post('/api/chat/stream', (c) => {
 *     return chatStreamingService.handleSSE(c, async (writer) => {
 *       writer.sendAgentSelected('gst_calculator', 0.95);
 *       writer.sendToken('Calculating');
 *       writer.sendToken(' your');
 *       writer.sendToken(' BAS...');
 *       writer.sendToolStart('calculate_gst');
 *       writer.sendToolEnd('calculate_gst', { total: 5000 });
 *       writer.sendComplete({ answer: 'Your BAS...', agentType: 'gst_calculator' });
 *     });
 *   });
 *
 * SSE wire format:
 *   event: token
 *   data: {"token":"Calculating","timestamp":"2026-02-13T..."}
 *
 *   event: complete
 *   data: {"response":{...},"timestamp":"2026-02-13T..."}
 */
export class StreamingService {
  private eventBus: EventBus;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? new EventEmitterBus();
  }

  /** Get the underlying EventBus for cross-service event broadcasting. */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Handle an SSE streaming response using Hono's stream() helper.
   *
   * Follows the same pattern as the existing `/api/events` endpoint:
   * - Sets SSE headers (Content-Type, Cache-Control, X-Accel-Buffering)
   * - Creates a StreamWriter backed by Hono's stream.write()
   * - Runs a heartbeat to keep the connection alive
   * - Cleans up on client disconnect via stream.onAbort()
   *
   * @param c - Hono Context
   * @param handler - Async function that receives the StreamWriter and sends events
   * @returns Hono streaming Response
   */
  handleSSE(c: Context, handler: (writer: StreamWriter) => Promise<void>): Response {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no'); // Disable nginx buffering

    return honoStream(c, async (sseStream) => {
      let open = true;

      /**
       * D03-B1: Write with per-connection timeout.
       * If stream.write() doesn't complete within 5s, disconnect the client.
       */
      const timedWrite = (raw: string): void => {
        if (!open) return;
        try {
          const writeResult = sseStream.write(raw);
          // If write returns a promise, race against timeout
          if (writeResult && typeof (writeResult as unknown as Record<string, unknown>).then === 'function') {
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('SSE write timeout')), WRITE_TIMEOUT_MS),
            );
            Promise.race([writeResult, timeout]).catch(() => {
              console.warn('[StreamingService] Write timeout — disconnecting client');
              open = false;
            });
          }
        } catch {
          open = false;
        }
      };

      const writer = buildStreamWriter(timedWrite, () => {
        open = false;
      });

      // Override isOpen to also check our local `open` flag
      const origIsOpen = writer.isOpen.bind(writer);
      (writer as unknown as Record<string, unknown>).isOpen = (): boolean => open && origIsOpen();

      // D03-B1: Clean up on client disconnect
      sseStream.onAbort(() => {
        open = false;
      });

      // Heartbeat — SSE comment format (matches /api/events)
      const heartbeatInterval = setInterval(() => {
        if (open) {
          try {
            timedWrite(': heartbeat\n\n');
          } catch {
            clearInterval(heartbeatInterval);
          }
        } else {
          clearInterval(heartbeatInterval);
        }
      }, HEARTBEAT_INTERVAL_MS);

      try {
        await handler(writer);
      } catch (err) {
        if (open) {
          const message = err instanceof Error ? err.message : 'Internal streaming error';
          writer.sendError(message);
        }
      } finally {
        clearInterval(heartbeatInterval);
        open = false;
      }
    }) as unknown as Response;
  }

  /**
   * Legacy API: Create an SSE stream on a Hono response context using ReadableStream.
   *
   * Sets the appropriate headers and creates a ReadableStream with a writer
   * that can be used to send events. The stream is stored on the context
   * for retrieval via getStream().
   *
   * Prefer handleSSE() for new code — it uses Hono's stream() helper and
   * automatically handles heartbeat and cleanup.
   */
  createStream(c: Context): StreamWriter {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    let controllerRef: ReadableStreamDefaultController | null = null;
    let open = true;
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      start(controller) {
        controllerRef = controller;
      },
      cancel() {
        // D03-B1: Client disconnected — clean up
        open = false;
        controllerRef = null;
      },
    });

    const writeFn = (raw: string): void => {
      if (!open || !controllerRef) return;
      try {
        controllerRef.enqueue(encoder.encode(raw));
      } catch {
        open = false;
        controllerRef = null;
      }
    };

    const writer = buildStreamWriter(writeFn, () => {
      open = false;
      try {
        controllerRef?.close();
      } catch {
        // Already closed
      }
      controllerRef = null;
    });

    // Store stream for retrieval
    (c as unknown as Record<string, unknown>).__sseStream = readableStream;

    return writer;
  }

  /**
   * Retrieve the ReadableStream created by createStream().
   * The route handler should return this as the Response body.
   */
  getStream(c: Context): ReadableStream | null {
    return ((c as unknown as Record<string, unknown>).__sseStream ?? null) as ReadableStream | null;
  }

  /**
   * Create a standalone StreamWriter from a raw write function.
   *
   * Useful for contexts where Hono's stream() helper is not available
   * (e.g., piping into an EventBus subscriber or unit testing).
   */
  createWriter(writeFn: (raw: string) => void, onClose?: () => void): StreamWriter {
    return buildStreamWriter(writeFn, onClose);
  }

  /**
   * Start a heartbeat that keeps the SSE connection alive.
   * Returns a cleanup function to stop the heartbeat.
   *
   * Uses SSE comment format (`: heartbeat\n\n`) matching the existing
   * `/api/events` endpoint pattern.
   */
  startHeartbeat(writer: StreamWriter, intervalMs: number = HEARTBEAT_INTERVAL_MS): () => void {
    const interval = setInterval(() => {
      if (writer.isOpen()) {
        // Use sendEvent for heartbeats — lightweight data
        writer.sendEvent('heartbeat' as StreamEventType, {});
      } else {
        clearInterval(interval);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * Broadcast an event to all subscribers on a channel via the EventBus.
   * Used by ConfirmationFlowService to notify connected clients of
   * mutation state changes (proposed, confirmed, rejected, executed).
   */
  broadcast(channel: string, event: StreamEvent): void {
    this.eventBus.emit(channel, event);
  }

  /**
   * Subscribe to events on a channel via the EventBus.
   * Returns an unsubscribe function.
   */
  subscribe(channel: string, handler: (event: unknown) => void): () => void {
    return this.eventBus.subscribe(channel, handler);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const chatStreamingService = new StreamingService();
