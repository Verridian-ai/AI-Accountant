/**
 * SSE Stream Formatters — EventBus implementation and StreamWriter factory.
 *
 * REVISION NOTES:
 * - D03-B1: EventBus abstraction for future Redis pub/sub swap
 */

import { EventEmitter } from 'events';
import { logger } from '../../../lib/logger.js';
import type { EventBus, StreamEventType, StreamWriter } from './types.js';

// ============================================================================
// EVENT EMITTER BUS (Default EventBus implementation)
// ============================================================================

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
// STREAM WRITER FACTORY
// ============================================================================

/**
 * Build a StreamWriter backed by a raw write function.
 * Used by both handleSSE() and createWriter().
 */
export function buildStreamWriter(
  writeFn: (raw: string) => void,
  onClose?: () => void,
): StreamWriter {
  let open = true;

  const writeSSE = (eventType: string, data: unknown): void => {
    if (!open) return;
    try {
      const payload = JSON.stringify(data);
      writeFn(`event: ${eventType}\ndata: ${payload}\n\n`);
    } catch (err) {
      logger.warn({ err: err }, '[StreamingService] Failed to write SSE event:');
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
