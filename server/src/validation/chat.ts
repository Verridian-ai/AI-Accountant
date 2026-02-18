/**
 * Chat, agent request, and model settings validation schemas
 */

import { z } from 'zod';
import { uuidSchema, dateSchema } from './common.js';

export const chatMessageSchema = z.object({
  query: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  context: z
    .object({
      transactionIds: z.array(uuidSchema).optional(),
      accountIds: z.array(uuidSchema).optional(),
      dateRange: z
        .object({
          start: dateSchema,
          end: dateSchema,
        })
        .optional(),
    })
    .optional(),
  sessionId: z.string().max(200).optional(),
});

export const agentRequestSchema = z.object({
  agentType: z.enum(['financial-analyst', 'bas', 'tax', 'reconciliation']),
  query: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
  skipCache: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export const modelSettingsSchema = z.object({
  modelParsingText: z.string().max(100).optional(),
  modelParsingVision: z.string().max(100).optional(),
  modelCategorization: z.string().max(100).optional(),
  modelChat: z.string().max(100).optional(),
  modelEmbedding: z.string().max(100).optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;
