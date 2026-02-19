import React, { useEffect, useRef, useReducer, useCallback } from 'react';
import { SSEContext } from './SSEContextDef';
import type { SSEEventMap } from './SSEContextDef';
import { getToken, BASE_URL } from '../api';

/** All typed event names (excluding 'update' which uses the legacy path). */
const TYPED_EVENT_NAMES: Array<keyof SSEEventMap> = [
  'batch_progress',
  'parsing_complete',
  'transfer_detected',
  'enrichment_status',
  'vision_verification',
  'transfers_updated',
  'pipeline_error',
  'statement_updated',
  'transactions_updated',
  'accounts_updated',
  'bas_updated',
  'tax_updated',
  'merchant_memory_updated',
  'account_setup_needed',
  'statement_added',
];

type SSEState = { connected: boolean; error: boolean };
type SSEAction = { type: 'open' } | { type: 'err' };

function sseReducer(_: SSEState, action: SSEAction): SSEState {
  if (action.type === 'open') return { connected: true, error: false };
  return { connected: false, error: true };
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const [{ connected, error }, dispatch] = useReducer(sseReducer, { connected: false, error: false });
  const listenersRef = useRef<Set<() => void>>(new Set());
  const typedListenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);

  const addListener = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const addTypedListener = useCallback(
    <K extends keyof SSEEventMap>(eventType: K, listener: (data: SSEEventMap[K]) => void) => {
      const key = eventType as string;
      if (!typedListenersRef.current.has(key)) {
        typedListenersRef.current.set(key, new Set());
      }
      const listenerSet = typedListenersRef.current.get(key)!;
      const wrappedListener = listener as (data: unknown) => void;
      listenerSet.add(wrappedListener);
      return () => {
        listenerSet.delete(wrappedListener);
      };
    },
    [],
  );

  useEffect(() => {
    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const token = getToken();
      if (!token) {
        // Not logged in, don't connect to SSE
        return;
      }

      const es = new EventSource(`${BASE_URL}/api/events?token=${token}`);

      es.onopen = () => {
        dispatch({ type: 'open' });
      };

      // Legacy 'update' listener — backward compatibility
      es.addEventListener('update', () => {
        listenersRef.current.forEach((listener) => listener());
      });

      // Typed event listeners
      for (const eventName of TYPED_EVENT_NAMES) {
        es.addEventListener(eventName, (e: MessageEvent) => {
          const listeners = typedListenersRef.current.get(eventName);
          if (!listeners || listeners.size === 0) return;

          try {
            const data: unknown = JSON.parse(e.data as string);
            listeners.forEach((listener) => listener(data));
          } catch (err) {
            console.error(`SSE: failed to parse ${eventName} data`, err);
          }
        });
      }

      es.onerror = (err) => {
        console.error('SSE error:', err);
        dispatch({ type: 'err' });
        es.close();
        setTimeout(connect, 5000); // Reconnect after 5s
      };

      eventSourceRef.current = es;
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <SSEContext.Provider value={{ connected, error, addListener, addTypedListener }}>
      {children}
    </SSEContext.Provider>
  );
}
