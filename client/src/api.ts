const API_URL = 'http://localhost:3000/api';

export interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    balance?: number;
    category?: string;
    gstApplicable: boolean;
    confidenceScore: number;
    aiReasoningNotes?: string;
    isEdited?: boolean;
    parentTransactionId?: string;
    statementId?: string;
    userId?: string;
}


export interface Statement {
    id: string;
    filename: string;
    hash: string;
    uploadDate: string;
    parsingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    aiModelUsed: string | null;
    errorMessage?: string | null;
    errorType?: 'PDF_READ_ERROR' | 'AI_PARSE_ERROR' | 'EMPTY_STATEMENT' | 'CRITICAL_ERROR' | null;
    errorDetails?: string | null;
    userId: string | null;
}

export interface TransactionStats {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    categoryBreakdown: Record<string, number>;
}

export const api = {
    fetchTransactions: async (): Promise<Transaction[]> => {
        const res = await fetch(`${API_URL}/transactions`);
        if (!res.ok) throw new Error('Failed to fetch transactions');
        return res.json();
    },

    fetchStatements: async (): Promise<Statement[]> => {
        const res = await fetch(`${API_URL}/statements`);
        if (!res.ok) throw new Error('Failed to fetch statements');
        return res.json();
    },

    sendChatMessage: async (query: string): Promise<{ answer: string }> => {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        if (!res.ok) throw new Error('Failed to send chat message');
        return res.json();
    },

    calculateStats: (transactions: Transaction[]): TransactionStats => {
        const income = transactions
            .filter(t => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions
            .filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const categoryBreakdown: Record<string, number> = {};
        transactions.forEach(t => {
            const cat = t.category || 'Uncategorized';
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + Math.abs(t.amount);
        });

        return {
            totalIncome: income,
            totalExpenses: expenses,
            netFlow: income - expenses,
            transactionCount: transactions.length,
            categoryBreakdown
        };
    },

    updateTransaction: async (id: string, updates: Partial<Transaction>): Promise<void> => {
        const res = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update transaction');
    },

    splitTransaction: async (id: string, splits: Array<{ category: string, amount: number, description: string, gst: boolean }>): Promise<void> => {
        const res = await fetch(`${API_URL}/transactions/${id}/split`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ splits })
        });
        if (!res.ok) throw new Error('Failed to split transaction');
    },

    uploadStatement: async (file: File): Promise<{ id: string; message: string; isDuplicate?: boolean }> => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_URL}/statements/upload`, {
            method: 'POST',
            body: formData
        });
        if (res.status === 409) {
            const data = await res.json();
            return { id: data.id, message: 'Duplicate file', isDuplicate: true };
        }
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(error.error || 'Upload failed');
        }
        return res.json();
    },

    reprocessStatement: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/statements/${id}/reprocess`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to reprocess statement');
    }
};

