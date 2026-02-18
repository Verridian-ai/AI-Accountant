import type { User } from './types';

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'john.doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    lastLoginAt: '2024-01-28T08:45:00Z',
    transactionCount: 245,
    statementCount: 12,
    subscriptionPlan: 'pro',
  },
  {
    id: '2',
    username: 'jane.smith',
    email: 'jane@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2023-11-20T14:20:00Z',
    lastLoginAt: '2024-01-27T16:30:00Z',
    transactionCount: 567,
    statementCount: 24,
    subscriptionPlan: 'enterprise',
  },
  {
    id: '3',
    username: 'bob.wilson',
    email: 'bob@example.com',
    role: 'user',
    status: 'suspended',
    createdAt: '2024-01-05T09:15:00Z',
    transactionCount: 0,
    statementCount: 0,
    subscriptionPlan: 'free',
  },
];
