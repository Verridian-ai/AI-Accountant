/**
 * Claude Agent Framework — Anthropic SDK Client
 *
 * Singleton client for all Claude agent interactions.
 */

import Anthropic from '@anthropic-ai/sdk';

let clientInstance: Anthropic | null = null;

/**
 * Get the shared Anthropic client instance.
 * Creates on first call; returns cached instance thereafter.
 */
export function getClient(): Anthropic {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[Claude] ANTHROPIC_API_KEY not set — agent calls will fail.');
  }

  clientInstance = new Anthropic({ apiKey: apiKey || '' });
  return clientInstance;
}
