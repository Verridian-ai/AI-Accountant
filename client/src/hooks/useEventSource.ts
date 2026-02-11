import { useEffect, useRef } from 'react';
import { BASE_URL } from '../api';

export type SSEEvent = {
    type: 'statement_added' | 'statement_updated' | 'transaction_added';
    id?: string;
    userId?: string;
    status?: string;
};

export function useEventSource(onEvent: (event: SSEEvent) => void) {
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Use token in query param for standard EventSource
        const url = `${BASE_URL}/api/events?token=${token}`;

        console.log('[SSE] Connecting to', url);
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                console.log('[SSE] Event received:', data);
                onEvent(data);
            } catch (err) {
                console.error('[SSE] Failed to parse event data:', err);
            }
        };

        es.onerror = (e) => {
            console.error('[SSE] Connection error:', e);
            // Browser handles reconnection automatically for EventSource
        };

        return () => {
            console.log('[SSE] Closing connection');
            es.close();
            eventSourceRef.current = null;
        };
    }, [onEvent]);
}
