/**
 * AI Proxy — Chat completion implementations
 * Standalone functions that the AIProxy class delegates to.
 */

import type { ChatCompletionRequest, ChatCompletionResponse } from './types.js';
import { AI_CONFIG } from './config.js';
import { validateChatMessages, fetchWithTimeout, sanitizeErrorMessage } from './validation.js';
import { DEFAULT_MODELS } from './types.js';

export async function chatCompletionImpl(
  openrouterKey: string,
  baseUrl: string,
  request: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  validateChatMessages(request.messages);
  const model = request.model || DEFAULT_MODELS.chat;

  try {
    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://goldledger.com.au',
        'X-Title': 'GoldLedger',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      await response.json().catch(() => ({}));
      const statusMessage =
        response.status === 429
          ? 'Rate limit exceeded'
          : response.status === 401
            ? 'Authentication failed'
            : response.status >= 500
              ? 'AI service temporarily unavailable'
              : 'AI request failed';
      throw new Error(`${statusMessage} (${response.status})`);
    }

    const data = await response.json();
    return {
      id: data.id,
      content: data.choices?.[0]?.message?.content || '',
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  } catch (error) {
    throw new Error(sanitizeErrorMessage(error));
  }
}

export async function* streamChatCompletionImpl(
  openrouterKey: string,
  baseUrl: string,
  request: ChatCompletionRequest,
): AsyncGenerator<string, void, unknown> {
  validateChatMessages(request.messages);
  const model = request.model || DEFAULT_MODELS.chat;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.requestTimeoutMs * 2);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://goldledger.com.au',
        'X-Title': 'GoldLedger',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const statusMessage =
        response.status === 429
          ? 'Rate limit exceeded'
          : response.status === 401
            ? 'Authentication failed'
            : response.status >= 500
              ? 'AI service temporarily unavailable'
              : 'AI streaming request failed';
      throw new Error(`${statusMessage} (${response.status})`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              /* Skip invalid JSON */
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error('Streaming request timed out');
    throw new Error(sanitizeErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}
