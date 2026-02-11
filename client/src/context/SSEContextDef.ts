import { createContext } from 'react';

/** Typed payload map for all SSE event types from the backend. */
export interface SSEEventMap {
    update: undefined;
    batch_progress: { jobId: string; file: string; status: string; bank?: string; progress: { completed: number; total: number; failed: number } };
    parsing_complete: { statementId: string; transactionCount: number; accountId?: string | null; bankName?: string | null };
    transfer_detected: { sourceAccountId: string | null; destinationAccountId: string | null; amount: number; confidence: number; linkId: string };
    enrichment_status: { transactionId: string; status: 'pending' | 'enriched' | 'failed'; merchantName?: string; category?: string };
    vision_verification: { statementId: string; confidence: number; matches: number; discrepancies: number; needsReview: boolean };
    transfers_updated: Record<string, unknown>;
    pipeline_error: { statementId: string; errorType: string; message: string };
    statement_updated: { id: string; status: string; userId?: string; accountDetection?: unknown };
    transactions_updated: Record<string, unknown>;
    accounts_updated: Record<string, unknown>;
    bas_updated: { userId?: string };
    tax_updated: { userId?: string };
    merchant_memory_updated: Record<string, unknown>;
    account_setup_needed: { statementId: string; userId?: string; detectedInfo: unknown };
    statement_added: { id: string };
}

export interface SSEContextType {
    connected: boolean;
    error: boolean;
    addListener: (listener: () => void) => () => void;
    addTypedListener: <K extends keyof SSEEventMap>(
        eventType: K,
        listener: (data: SSEEventMap[K]) => void,
    ) => () => void;
}

export const SSEContext = createContext<SSEContextType | null>(null);
