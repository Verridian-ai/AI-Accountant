import { z } from 'zod';
import { rateLimiter } from 'hono-rate-limiter';

export const streamChatSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  sessionId: z.string().optional(),
});

export const actionReasonSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const getRateLimitKey = (
  c: Parameters<typeof rateLimiter>[0]['keyGenerator'] extends (c: infer C) => unknown ? C : never,
) => {
  const realIp = c.req.header('x-real-ip');
  const env = c.env as Record<string, unknown> | undefined;
  const incoming = env?.incoming as Record<string, unknown> | undefined;
  const socket = incoming?.socket as Record<string, unknown> | undefined;
  const remoteAddr = (socket?.remoteAddress as string | undefined) || 'unknown';
  return realIp || (typeof remoteAddr === 'string' ? remoteAddr : 'unknown');
};

export const chatLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  keyGenerator: getRateLimitKey,
  message: { error: 'Chat limit reached. Please wait a minute before trying again.' },
});

/**
 * Build a structured prompt for the Neon-enabled chat path.
 * Instructs Claude to use get_exact_totals instead of summing [[amt:ID]] tokens.
 */
export function buildChatPrompt(query: string, context: Record<string, unknown>): string {
  return `You are a helpful financial assistant. Transaction amounts appear as [[amt:ID]] tokens — use the get_exact_totals tool for any dollar calculations instead of attempting to sum these tokens yourself.

Context:
${JSON.stringify(context, null, 2)}

User question: ${query}`;
}
