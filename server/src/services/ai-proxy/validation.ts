/**
 * AI Proxy Input Validation and Security Helpers
 */

import type { ChatMessage } from './types.js';
import { AI_CONFIG } from './config.js';

/**
 * Estimate token count from text (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validate chat messages for security and size limits
 */
export function validateChatMessages(messages: ChatMessage[]): void {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  if (messages.length === 0) {
    throw new Error('At least one message is required');
  }

  if (messages.length > AI_CONFIG.maxMessages) {
    throw new Error(`Too many messages. Maximum allowed: ${AI_CONFIG.maxMessages}`);
  }

  let totalEstimatedTokens = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== 'object') {
      throw new Error(`Invalid message at index ${i}`);
    }

    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw new Error(`Invalid role at index ${i}. Must be 'system', 'user', or 'assistant'`);
    }

    if (typeof msg.content !== 'string') {
      throw new Error(`Message content at index ${i} must be a string`);
    }

    if (msg.content.length > AI_CONFIG.maxMessageLength) {
      throw new Error(
        `Message at index ${i} exceeds maximum length of ${AI_CONFIG.maxMessageLength} characters`,
      );
    }

    totalEstimatedTokens += estimateTokens(msg.content);
  }

  if (totalEstimatedTokens > AI_CONFIG.maxEstimatedTokens) {
    throw new Error(
      `Request too large. Estimated tokens: ${totalEstimatedTokens}, maximum: ${AI_CONFIG.maxEstimatedTokens}`,
    );
  }
}

/**
 * Validate image URL for vision requests
 */
export function validateImageUrl(url: string): void {
  try {
    const parsed = new URL(url);

    if (!AI_CONFIG.allowedImageProtocols.includes(parsed.protocol)) {
      throw new Error(
        `Invalid image URL protocol. Allowed: ${AI_CONFIG.allowedImageProtocols.join(', ')}`,
      );
    }

    // Block localhost and private IPs to prevent SSRF
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.local')
    ) {
      throw new Error('Image URLs to private/local addresses are not allowed');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Image URL')) {
      throw error;
    }
    throw new Error('Invalid image URL format');
  }
}

/**
 * Create a fetch request with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = AI_CONFIG.requestTimeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sanitize error messages to prevent sensitive data leakage
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    const sanitized = message
      .replace(/Bearer [a-zA-Z0-9_-]+/gi, 'Bearer [REDACTED]')
      .replace(/sk-[a-zA-Z0-9]+/gi, '[REDACTED_KEY]')
      .replace(/api[_-]?key[=:]\s*[a-zA-Z0-9_-]+/gi, 'api_key=[REDACTED]');
    return sanitized;
  }
  return 'An unexpected error occurred';
}
