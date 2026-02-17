/**
 * AI Proxy Service — Barrel re-export
 */

export type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  VisionRequest,
} from './types.js';
export { DEFAULT_MODELS } from './types.js';
export { AIProxy, aiProxy } from './ai-proxy-service.js';
export { checkAIServiceHealth } from './health.js';
