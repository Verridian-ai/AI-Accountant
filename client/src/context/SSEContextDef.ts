import { createContext } from 'react';

export interface SSEContextType {
    connected: boolean;
    error: boolean;
    addListener: (listener: () => void) => () => void;
}

export const SSEContext = createContext<SSEContextType | null>(null);

