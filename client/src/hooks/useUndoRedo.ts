import { useState, useCallback, useRef } from 'react';
import type { Transaction } from '../api';
import { api } from '../api';

// Command pattern for undo history (infinite rollback)
export interface EditCommand {
    id: string;
    type: 'edit' | 'split';
    transactionId: string;
    transactionDescription: string;
    previousData: Partial<Transaction>;
    newData: Partial<Transaction>;
    timestamp: Date;
}

export function useUndoRedo(onDataChange?: () => void) {
    const [undoStack, setUndoStack] = useState<EditCommand[]>([]);
    const isProcessingRef = useRef(false);

    // Execute an edit and add it to the undo stack (infinite history)
    const executeEdit = useCallback(async (
        transactionId: string,
        previousData: Partial<Transaction>,
        newData: Partial<Transaction>,
        transactionDescription?: string
    ): Promise<boolean> => {
        try {
            await api.updateTransaction(transactionId, newData);

            const command: EditCommand = {
                id: crypto.randomUUID(),
                type: 'edit',
                transactionId,
                transactionDescription: transactionDescription || `Transaction ${transactionId.slice(0, 8)}`,
                previousData,
                newData,
                timestamp: new Date()
            };

            setUndoStack(prev => [...prev, command]);

            onDataChange?.();
            return true;
        } catch (error) {
            console.error('Edit failed:', error);
            return false;
        }
    }, [onDataChange]);

    // Undo the last edit (one step at a time)
    const undo = useCallback(async (): Promise<boolean> => {
        if (undoStack.length === 0 || isProcessingRef.current) return false;

        isProcessingRef.current = true;
        const command = undoStack[undoStack.length - 1];
        if (!command) return false;

        try {
            // Apply the previous data to revert the change
            await api.updateTransaction(command.transactionId, command.previousData);

            setUndoStack(prev => prev.slice(0, -1));

            onDataChange?.();
            return true;
        } catch (error) {
            console.error('Undo failed:', error);
            return false;
        } finally {
            isProcessingRef.current = false;
        }
    }, [undoStack, onDataChange]);

    // Clear all history
    const clearHistory = useCallback(() => {
        setUndoStack([]);
    }, []);

    // Get the last command for tooltip display
    const lastUndoCommand = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;

    return {
        canUndo: undoStack.length > 0,
        undoCount: undoStack.length,
        executeEdit,
        undo,
        clearHistory,
        lastUndoCommand
    };
}

