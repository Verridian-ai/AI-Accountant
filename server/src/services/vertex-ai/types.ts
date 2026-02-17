/**
 * Vertex AI Type Definitions
 */

export interface VertexModel {
  id: string;
  name: string;
  provider: 'google' | 'anthropic' | 'meta' | 'mistral' | 'deepseek';
  category: 'reasoning' | 'fast' | 'vision' | 'code' | 'embedding';
  contextWindow: number;
  maxOutput: number;
  status: 'ga' | 'preview' | 'deprecated';
  pricing: { input: number; output: number }; // per 1M tokens
  features: string[];
}

export interface VertexAIConfig {
  projectId: string;
  region: string;
  apiKey?: string;
  models: VertexModel[];
}

export interface VertexAIRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface VertexAIResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}
