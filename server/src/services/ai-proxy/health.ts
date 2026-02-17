/**
 * AI Service Health Check
 */

import { AIProxy } from './ai-proxy-service.js';
import { OPENROUTER_API_KEY, OPENAI_API_KEY } from './config.js';

export async function checkAIServiceHealth(): Promise<{
  available: boolean;
  providers: { openrouter: boolean; openai: boolean };
  models: string[];
}> {
  const proxy = new AIProxy();
  return {
    available: proxy.isAvailable(),
    providers: { openrouter: !!OPENROUTER_API_KEY, openai: !!OPENAI_API_KEY },
    models: proxy.getAvailableModels(),
  };
}
