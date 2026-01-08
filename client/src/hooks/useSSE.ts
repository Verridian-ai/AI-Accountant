import { useContext, useEffect } from 'react';
import { SSEContext } from '../context/SSEContextDef';

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

