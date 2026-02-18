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

export {
  sseStreamMiddleware,
  streamingRateLimiter,
  getActiveStreamCount,
  getTotalActiveStreams,
} from './middleware.js';
export { StreamingRegistry, streamingRegistry } from './registry.js';
