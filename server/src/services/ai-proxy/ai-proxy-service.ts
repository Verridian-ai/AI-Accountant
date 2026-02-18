/**
 * AI Proxy Service — Core class
 *
 * Backend proxy for AI API calls to keep API keys secure.
 * Thin facade that delegates all logic to sub-modules.
 */

import dotenv from 'dotenv';
import { logger } from '../../lib/logger.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  VisionRequest,
} from './types.js';
import { AI_CONFIG, OPENROUTER_API_KEY, OPENAI_API_KEY } from './config.js';
import { chatCompletionImpl, streamChatCompletionImpl } from './ai-proxy-chat.js';
import { generateEmbeddingsImpl } from './ai-proxy-embeddings.js';
import { processVisionImpl, completeImpl, extractJSONImpl } from './ai-proxy-vision.js';

dotenv.config({ path: '../env.local' });

if (!OPENROUTER_API_KEY && !OPENAI_API_KEY) {
  logger.warn('Warning: No AI API keys configured. AI features will be unavailable.');
}

export class AIProxy {
  private openrouterKey: string | undefined;
  private openaiKey: string | undefined;
  private baseUrl: string;
  private openaiBaseUrl: string;

  constructor() {
    this.openrouterKey = OPENROUTER_API_KEY;
    this.openaiKey = OPENAI_API_KEY;
    this.baseUrl = AI_CONFIG.openrouterBaseUrl;
    this.openaiBaseUrl = AI_CONFIG.openaiBaseUrl;
  }

  isAvailable(): boolean {
    return !!(this.openrouterKey || this.openaiKey);
  }

  getAvailableModels(): string[] {
    const models: string[] = [];
    if (this.openrouterKey) {
      models.push(
        'google/gemini-3-flash-preview',
        'openrouter/openai/o3-mini',
        'openrouter/openai/gpt-4o',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
      );
    }
    if (this.openaiKey) {
      models.push(
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'text-embedding-3-large',
        'text-embedding-3-small',
      );
    }
    return models;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.openrouterKey) throw new Error('AI service not configured');
    return chatCompletionImpl(this.openrouterKey, this.baseUrl, request);
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.openrouterKey) throw new Error('AI service not configured');
    yield* streamChatCompletionImpl(this.openrouterKey, this.baseUrl, request);
  }

  async generateEmbeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return generateEmbeddingsImpl(
      this.openrouterKey,
      this.openaiKey,
      this.baseUrl,
      this.openaiBaseUrl,
      request,
    );
  }

  async processVision(request: VisionRequest): Promise<ChatCompletionResponse> {
    if (!this.openrouterKey) throw new Error('AI service not configured');
    return processVisionImpl(this.openrouterKey, this.baseUrl, request);
  }

  async complete(
    prompt: string,
    options?: { model?: string; systemPrompt?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.openrouterKey) throw new Error('AI service not configured');
    return completeImpl(this.openrouterKey, this.baseUrl, prompt, options);
  }

  async extractJSON<T>(prompt: string, options?: { model?: string; schema?: string }): Promise<T> {
    if (!this.openrouterKey) throw new Error('AI service not configured');
    return extractJSONImpl<T>(this.openrouterKey, this.baseUrl, prompt, options);
  }
}

export const aiProxy = new AIProxy();
