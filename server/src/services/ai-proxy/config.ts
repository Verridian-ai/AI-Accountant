/**
 * AI Proxy Configuration
 */

import { config } from '../../lib/config.js';

export const AI_CONFIG = {
  /** Maximum number of messages per request */
  maxMessages: 50,
  /** Maximum characters per message content */
  maxMessageLength: 50000,
  /** Maximum total estimated tokens per request */
  maxEstimatedTokens: 100000,
  /** Request timeout in milliseconds */
  requestTimeoutMs: 120000, // 2 minutes
  /** Allowed URL protocols for vision requests */
  allowedImageProtocols: ['https:'],
  /** Base URL for OpenRouter API (can be overridden via env) */
  openrouterBaseUrl: config.openrouterBaseUrl,
  /** Base URL for OpenAI API (can be overridden via env) */
  openaiBaseUrl: config.openaiBaseUrl,
};

// Get API keys from environment (server-side only)
export const OPENROUTER_API_KEY = config.openrouterApiKey;
export const OPENAI_API_KEY = config.openaiApiKey;
