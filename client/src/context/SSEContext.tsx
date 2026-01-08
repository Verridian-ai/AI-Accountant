import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SSEContext } from './SSEContextDef';

export function SSEProvider({ children }: { children: React.ReactNode }) {
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(false);
    const listenersRef = useRef<Set<() => void>>(new Set());
    const eventSourceRef = useRef<EventSource | null>(null);

    const addListener = useCallback((listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
            listenersRef.current.delete(listener);
        };
    }, []);

    useEffect(() => {
        function connect() {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const es = new EventSource('http://localhost:3000/api/events');

            es.onopen = () => {
                console.log('SSE connection opened');
                setConnected(true);
                setError(false);
            };

            es.addEventListener('update', () => {
                console.log('SSE update received, notifying listeners');
                listenersRef.current.forEach(listener => listener());
            });

            es.onerror = (err) => {
                console.error('SSE error:', err);
                setConnected(false);
                setError(true);
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
        <SSEContext.Provider value={{ connected, error, addListener }}>
            {children}
        </SSEContext.Provider>
    );
}


