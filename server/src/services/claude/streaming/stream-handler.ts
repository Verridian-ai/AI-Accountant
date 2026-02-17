/**
 * SSE Stream Handler — StreamingService class for managing SSE connections.
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
 * - D03-B1: Per-connection write timeout (5s) and cleanup on disconnect
 * - Does NOT modify the existing `GET /api/events` SSE endpoint
 */

import type { Context } from 'hono';
import { stream as honoStream } from 'hono/streaming';
import { logger } from '../../../lib/logger.js';
import type { EventBus, StreamEventType, StreamEvent, StreamWriter } from './types.js';
import { EventEmitterBus, buildStreamWriter } from './formatters.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Per-connection write timeout in ms (D03-B1). */
const WRITE_TIMEOUT_MS = 5000;

/** Default heartbeat interval in ms (matches existing /api/events endpoint). */
const HEARTBEAT_INTERVAL_MS = 30000;

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
          if (writeResult && typeof (writeResult as any).then === 'function') {
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('SSE write timeout')), WRITE_TIMEOUT_MS),
            );
            Promise.race([writeResult, timeout]).catch(() => {
              logger.warn('[StreamingService] Write timeout — disconnecting client');
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
      (writer as any).isOpen = (): boolean => open && origIsOpen();

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
    (c as any).__sseStream = readableStream;

    return writer;
  }

  /**
   * Retrieve the ReadableStream created by createStream().
   * The route handler should return this as the Response body.
   */
  getStream(c: Context): ReadableStream | null {
    return (c as any).__sseStream ?? null;
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
