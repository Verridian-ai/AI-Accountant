/**
 * AI Proxy Types
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface EmbeddingRequest {
  model?: string;
  input: string | string[];
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface VisionRequest {
  model?: string;
  imageUrl?: string;
  imageBase64?: string;
  prompt: string;
  maxTokens?: number;
}

export const DEFAULT_MODELS = {
  chat: 'google/gemini-3-flash-preview',
  reasoning: 'openrouter/openai/o3-mini',
  code: 'openrouter/openai/gpt-4o',
  vision: 'google/gemini-3-flash-preview',
  embedding: 'openai/text-embedding-3-large',
  fast: 'google/gemini-3-flash-preview',
};
