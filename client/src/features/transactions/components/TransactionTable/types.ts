import type { Transaction, Account } from '@/api';

export interface TransactionTableProps {
  transactions: Transaction[];
  accounts?: Account[];
  loading?: boolean;
  onDataChange?: () => void;
}
