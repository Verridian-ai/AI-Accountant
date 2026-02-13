import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import type { Transaction } from '../types/ledger';
import type { Account } from '@/api';
import { TransactionCard } from './TransactionCard';

interface TransactionCardListProps {
  transactions: Transaction[];
  accounts: Account[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onSplit: (tx: Transaction) => void;
  editingId: string | null;
  editForm: Partial<Transaction>;
  setEditForm: (form: Partial<Transaction>) => void;
  onSave: (id: string) => void;
  onCancelEdit: () => void;
}

export function TransactionCardList({
  transactions,
  accounts,
  onEdit,
  onDelete,
  onSplit,
  editingId,
  editForm,
  setEditForm,
  onSave,
  onCancelEdit,
}: TransactionCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated card height including margin
    overscan: 5,
  });

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <Search className="h-8 w-8 mb-2 opacity-50" />
        <span className="text-xs font-bold uppercase tracking-widest">No transactions found</span>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[calc(100vh-200px)] overflow-auto px-4">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const tx = transactions[virtualItem.index];
          if (!tx) return null;
          return (
            <div
              key={tx.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TransactionCard
                transaction={tx}
                accounts={accounts}
                onEdit={onEdit}
                onDelete={onDelete}
                onSplit={onSplit}
                isEditing={editingId === tx?.id}
                editForm={editForm}
                setEditForm={setEditForm}
                onSave={onSave}
                onCancelEdit={onCancelEdit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
