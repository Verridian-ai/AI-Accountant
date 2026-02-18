import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accountRepository } from './account-repository.js';
import { db } from '../schema.js';

// Mock the db
vi.mock('../schema.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn(),
  },
  accounts: { userId: 'userId', accountNumberHash: 'hash', id: 'id' },
  merchantMemory: { userId: 'userId', merchantPattern: 'pattern', id: 'id' },
  pendingCategorization: { userId: 'userId', status: 'status', id: 'id' },
  transferLinks: { userId: 'userId', id: 'id' },
  accountBalanceHistory: { accountId: 'accountId', balanceDate: 'balanceDate' },
  reconciliationAlerts: {
    userId: 'userId',
    isResolved: 'isResolved',
    createdAt: 'createdAt',
    id: 'id',
  },
  chartOfAccounts: { userId: 'userId', accountCode: 'accountCode' },
  statementAccounts: {},
}));

describe('AccountRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByHash', () => {
    it('should query accounts by hash', async () => {
      await accountRepository.findByHash('user1', 'hash1');
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should query all accounts with filters', async () => {
      await accountRepository.findAll('user1', { search: 'test' });
      expect(db.select).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should insert account', async () => {
      await accountRepository.create({ id: '1' } as Parameters<typeof accountRepository.create>[0]);
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalled();
    });
  });

  // Add more tests as needed for coverage, but basic structure is proven
});
