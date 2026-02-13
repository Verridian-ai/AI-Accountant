# Agent 5: SSE Streaming Service

## Role
Create the `StreamingService` that enables progressive SSE streaming of chat responses, including text tokens, tool execution events, and mutation proposals.

## Priority: SUB-WAVE 1 (No dependencies)

## Files to CREATE

### 1. `server/src/services/claude/streaming.ts`
**Purpose**: SSE streaming for progressive chat responses

```typescript
import type { Context } from 'hono';

/**
 * Types of SSE events sent during a streaming chat response.
 */
export type StreamEventType =
  | 'token'           // Progressive text token
  | 'tool_start'      // Agent started executing a tool
  | 'tool_end'        // Agent finished executing a tool
  | 'mutation_proposed'  // Agent proposed a DB mutation
  | 'agent_selected'  // Intent router selected an agent
  | 'progress'        // Progress update (step count, etc.)
  | 'error'           // Non-fatal error during processing
  | 'complete';       // Final response with full ChatResponse

/**
 * SSE event payload.
 */
export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: string;
}

/**
 * Writer interface for SSE streaming.
 * Wraps the Hono response to provide a clean API for sending events.
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

/**
 * StreamingService creates SSE streams for progressive chat responses.
 *
 * Usage:
 *   const stream = streamingService.createStream(c);
 *   stream.sendAgentSelected('gst_calculator', 0.95);
 *   stream.sendToken('Calculating');
 *   stream.sendToken(' your');
 *   stream.sendToken(' BAS...');
 *   stream.sendToolStart('calculate_gst');
 *   stream.sendToolEnd('calculate_gst', { total: 5000 });
 *   stream.sendComplete({ answer: 'Your BAS...', agentType: 'gst_calculator' });
 *
 * SSE wire format:
 *   event: token
 *   data: {"token":"Calculating","timestamp":"2026-02-13T..."}
 *
 *   event: tool_start
 *   data: {"tool":"calculate_gst","timestamp":"2026-02-13T..."}
 *
 *   event: complete
 *   data: {"response":{...},"timestamp":"2026-02-13T..."}
 */
export class StreamingService {
  /**
   * Create an SSE stream on a Hono response context.
   *
   * Sets the appropriate headers:
   * - Content-Type: text/event-stream
   * - Cache-Control: no-cache
   * - Connection: keep-alive
   * - X-Accel-Buffering: no (for nginx)
   */
  createStream(c: Context): StreamWriter {
    // Set SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no'); // Disable nginx buffering

    let open = true;
    const encoder = new TextEncoder();

    // Get the underlying writable stream
    const stream = new ReadableStream({
      start(controller) {
        // Store reference for the writer methods
        (c as any).__sseController = controller;
      },
      cancel() {
        open = false;
      },
    });

    const controller = () => (c as any).__sseController;

    const write = (eventType: string, data: unknown): void => {
      if (!open) return;
      try {
        const payload = JSON.stringify(data);
        const message = `event: ${eventType}\ndata: ${payload}\n\n`;
        controller()?.enqueue(encoder.encode(message));
      } catch (error) {
        console.warn('[StreamingService] Failed to write SSE event:', error);
        open = false;
      }
    };

    const writer: StreamWriter = {
      sendEvent(type: StreamEventType, data: unknown): void {
        write(type, { ...((typeof data === 'object' && data !== null) ? data : { value: data }), timestamp: new Date().toISOString() });
      },

      sendToken(token: string): void {
        write('token', { token, timestamp: new Date().toISOString() });
      },

      sendToolStart(toolName: string, toolInput?: unknown): void {
        write('tool_start', {
          tool: toolName,
          input: toolInput,
          timestamp: new Date().toISOString(),
        });
      },

      sendToolEnd(toolName: string, toolResult?: unknown): void {
        write('tool_end', {
          tool: toolName,
          result: toolResult,
          timestamp: new Date().toISOString(),
        });
      },

      sendMutationProposal(mutation: unknown): void {
        write('mutation_proposed', {
          mutation,
          timestamp: new Date().toISOString(),
        });
      },

      sendAgentSelected(agentType: string, confidence: number): void {
        write('agent_selected', {
          agentType,
          confidence,
          timestamp: new Date().toISOString(),
        });
      },

      sendProgress(step: number, total: number, description: string): void {
        write('progress', {
          step,
          total,
          description,
          timestamp: new Date().toISOString(),
        });
      },

      sendError(message: string): void {
        write('error', { message, timestamp: new Date().toISOString() });
      },

      sendComplete(response: unknown): void {
        write('complete', {
          response,
          timestamp: new Date().toISOString(),
        });
        // Auto-close after complete
        open = false;
        try {
          controller()?.close();
        } catch {
          // Already closed
        }
      },

      close(): void {
        open = false;
        try {
          controller()?.close();
        } catch {
          // Already closed
        }
      },

      isOpen(): boolean {
        return open;
      },
    };

    // Set the response body to the stream
    // Note: The actual response return is done by the route handler
    (c as any).__sseStream = stream;

    return writer;
  }

  /**
   * Helper to get the ReadableStream from a context after createStream().
   * The route handler should call this and return it as the response body.
   */
  getStream(c: Context): ReadableStream | null {
    return (c as any).__sseStream ?? null;
  }

  /**
   * Create a heartbeat interval that keeps the SSE connection alive.
   * Returns a cleanup function to stop the heartbeat.
   */
  startHeartbeat(writer: StreamWriter, intervalMs: number = 30000): () => void {
    const interval = setInterval(() => {
      if (writer.isOpen()) {
        writer.sendEvent('heartbeat' as StreamEventType, {});
      } else {
        clearInterval(interval);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }
}
```

#### Key Design Decisions:
- [ ] Follows existing SSE pattern from `events.ts` (`event: type\ndata: json\n\n` format)
- [ ] Uses Hono's `Context` for header setting (not raw Node.js response)
- [ ] ReadableStream-based (compatible with Hono's streaming response)
- [ ] Heartbeat support (30s default, matching existing SSE endpoint)
- [ ] Auto-close on `sendComplete()` — prevents leaked connections
- [ ] `X-Accel-Buffering: no` header for nginx compatibility
- [ ] Does NOT use Redis pub/sub (deferred to Wave 17/21)
- [ ] Does NOT modify the existing `GET /api/events` SSE endpoint

#### REVISION NOTE (D03-B1): SSE Scaling & Connection Cleanup
The EventEmitter-based approach won't scale beyond ~100 concurrent users. To prepare for Redis pub/sub migration:
1. **EventBus abstraction**: Create an `EventBus` interface with `emit()`, `subscribe()`, `unsubscribe()` methods. The current EventEmitter implementation is the first adapter; Redis pub/sub will be a drop-in replacement in Wave 17/21.
2. **Per-connection write timeout**: If `stream.write()` doesn't complete within 5 seconds, disconnect that client to prevent blocking other listeners.
3. **Connection cleanup on disconnect**: When `cancel()` fires on the ReadableStream, immediately remove the listener and clean up resources. Handle ungraceful disconnects (network drops, mobile sleep) by checking `isOpen()` before every write.
4. **Connection limit**: Increase `setMaxListeners` to at least 500 or use `EventEmitter({ captureRejections: true })`.

```typescript
// REVISION: EventBus abstraction for future Redis pub/sub swap
export interface EventBus {
  emit(channel: string, data: unknown): void;
  subscribe(channel: string, handler: (data: unknown) => void): () => void;
}

// Default implementation using Node.js EventEmitter
export class EventEmitterBus implements EventBus {
  private emitter: EventEmitter;
  constructor(emitter: EventEmitter) { this.emitter = emitter; }
  emit(channel: string, data: unknown): void { this.emitter.emit(channel, data); }
  subscribe(channel: string, handler: (data: unknown) => void): () => void {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }
}
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `StreamingService` class is exported
- [ ] `StreamWriter`, `StreamEvent`, `StreamEventType` types exported
- [ ] `createStream()` sets correct SSE headers
- [ ] `sendToken()`, `sendToolStart()`, `sendToolEnd()` produce valid SSE wire format
- [ ] `sendComplete()` closes the stream after sending
- [ ] `isOpen()` returns false after close
- [ ] `startHeartbeat()` returns a cleanup function
- [ ] No modifications to any existing files
- [ ] REVISION (D03-B1): `EventBus` interface is exported for future Redis pub/sub swap
- [ ] REVISION (D03-B1): Connection cleanup fires on client disconnect (ReadableStream cancel)
- [ ] Create marker file: `.agent-done-W02-05` (REVISION: zero-padded per D04/D05)

## Dependencies
- **Requires**: Nothing — Sub-Wave 1 task
- **Blocks**: Agent 7 (API endpoints need StreamingService for `/api/chat/stream`)
