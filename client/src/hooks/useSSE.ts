import { useContext, useEffect } from 'react';
import { SSEContext } from '../context/SSEContextDef';
import type { SSEEventMap } from '../context/SSEContextDef';

export function useSSE(onUpdate: () => void) {
    const context = useContext(SSEContext);
    if (!context) {
        throw new Error('useSSE must be used within an SSEProvider');
    }

    useEffect(() => {
        return context.addListener(onUpdate);
    }, [context, onUpdate]);

    return { connected: context.connected, error: context.error };
}

export function useSSEEvent<K extends keyof SSEEventMap>(
    eventType: K,
    handler: (data: SSEEventMap[K]) => void,
) {
    const context = useContext(SSEContext);
    if (!context) {
        throw new Error('useSSEEvent must be used within an SSEProvider');
    }

    useEffect(() => {
        return context.addTypedListener(eventType, handler);
    }, [context, eventType, handler]);
}
