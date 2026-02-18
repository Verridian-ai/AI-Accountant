export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'pending';
  createdAt: string;
  lastLoginAt?: string;
  transactionCount: number;
  statementCount: number;
  subscriptionPlan?: string;
}

export interface UserManagementProps {
  onViewUser?: (userId: string) => void;
  onSuspendUser?: (userId: string) => Promise<void>;
  onDeleteUser?: (userId: string) => Promise<void>;
  onExportUsers?: (format: 'csv' | 'json') => void;
  className?: string;
}
