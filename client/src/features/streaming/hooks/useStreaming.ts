/**
 * useStreaming — React hook for consuming streaming agent responses via SSE
 *
 * Uses fetch() + ReadableStream to handle POST-based SSE endpoints
 * (EventSource only supports GET, so we manually parse the SSE protocol).
 */

import { useState, useCallback, useRef } from 'react';
import { BASE_URL } from '../../../api';

const API_URL = `${BASE_URL}/api`;

export interface UseStreamingResult {
  /** Start a streaming request to the given agent */
  stream: (input: Record<string, unknown>) => void;
  /** Accumulated response text from token events */
  text: string;
  /** Whether tokens are currently arriving */
  isStreaming: boolean;
  /** Current session ID (if any) */
  sessionId: string | null;
  /** Number of tokens received so far */
  tokenCount: number;
  /** Milliseconds since stream started */
  latencyMs: number;
  /** Error message if stream failed */
  error: string | null;
  /** Abort the current stream */
  cancel: () => void;
}

/**
 * Hook for consuming streaming agent responses.
 *
 * @param agentType - The agent type to stream from (e.g. 'budget_analyzer')
 * @param userId - Optional user ID (defaults to 'default')
 */
export function useStreaming(agentType: string, userId = 'default'): UseStreamingResult {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const latencyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }
  }, []);

  const stream = useCallback(
    async (input: Record<string, unknown>) => {
      // Reset state
      setText('');
      setError(null);
      setTokenCount(0);
      setLatencyMs(0);
      setSessionId(null);
      setIsStreaming(true);

      // Abort any previous stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      startTimeRef.current = Date.now();
      latencyIntervalRef.current = setInterval(() => {
        setLatencyMs(Date.now() - startTimeRef.current);
      }, 100);

      try {
        const res = await fetch(
          `${API_URL}/stream/agent/${agentType}?userId=${encodeURIComponent(userId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error('No response body — streaming not supported');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);

                switch (eventType) {
                  case 'token':
                    setText((prev) => prev + (data.token ?? ''));
                    setTokenCount((prev) => prev + 1);
                    break;
                  case 'agent_selected':
                    setSessionId(data.sessionId ?? null);
                    break;
                  case 'complete':
                    setIsStreaming(false);
                    setLatencyMs(Date.now() - startTimeRef.current);
                    break;
                  case 'error':
                    setError(data.message ?? 'Stream error');
                    setIsStreaming(false);
                    break;
                  // progress, tool_start, tool_end, heartbeat — ignored for now
                }
              } catch {
                // Non-JSON data line — skip
              }
              eventType = '';
            }
          }
        }

        // Stream ended naturally
        setIsStreaming(false);
        setLatencyMs(Date.now() - startTimeRef.current);
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') {
          // User cancelled — not an error
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setIsStreaming(false);
      } finally {
        if (latencyIntervalRef.current) {
          clearInterval(latencyIntervalRef.current);
          latencyIntervalRef.current = null;
        }
      }
    },
    [agentType, userId],
  );

  return { stream, text, isStreaming, sessionId, tokenCount, latencyMs, error, cancel };
}
