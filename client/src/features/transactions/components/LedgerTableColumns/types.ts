import type { MutableRefObject } from 'react';
import type { Transaction, Account } from '../../types/ledger';

export interface EditStateRef {
  editingId: string | null;
  editForm: Partial<Transaction>;
}

export interface BulkSelectRef {
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
}

export interface CreateColumnsParams {
  editStateRef: MutableRefObject<EditStateRef>;
  accounts: Account[];
  categories?: string[];
  setEditForm: (form: Partial<Transaction>) => void;
  handleEditStart: (tx: Transaction) => void;
  handleSave: (id: string) => void;
  handleDelete: (id: string) => void;
  handleSplitStart: (tx: Transaction) => void;
  setEditingId: (id: string | null) => void;
  bulkSelectRef?: MutableRefObject<BulkSelectRef | null>;
  onSelectAll?: () => void;
}
