/**
 * Streaming Service — Barrel Export
 */
export type {
  InternalSession,
  SSETokenEvent,
  SSEDoneEvent,
  SSEErrorEvent,
  SSEStreamEvent,
} from './types.js';
export { StreamingService } from './streaming-service.js';

import { StreamingService } from './streaming-service.js';
export const streamingService = new StreamingService();
