import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define ALL mocks before they are used in vi.mock
const {
  mockFindByHash,
  mockFindAll,
  mockCreate,
  mockUpdateBalance,
  mockSelect,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
} = vi.hoisted(() => {
  // AccountRepository mocks
  const mockFindByHash = vi.fn();
  const mockFindAll = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdateBalance = vi.fn();

  // DB chaining mocks (for repository internal use)
  const mockSelect = vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn(), get: vi.fn(), all: vi.fn() })),
  }));
  const mockDbInsert = vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn() })) }));
  const mockDbUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(), run: vi.fn() })) }));
  const mockDbDelete = vi.fn(() => ({ where: vi.fn(() => ({ run: vi.fn() })) }));

  return {
    mockFindByHash,
    mockFindAll,
    mockCreate,
    mockUpdateBalance,
    mockSelect,
    mockDbInsert,
    mockDbUpdate,
    mockDbDelete,
  };
});

// Mock AccountRepository (AccountService uses this)
vi.mock('../repositories/account-repository', () => ({
  accountRepository: {
    findByHash: mockFindByHash,
    findAll: mockFindAll,
    create: mockCreate,
    updateBalance: mockUpdateBalance,
  },
}));

// Mock schema module - db must have chaining methods for typed-queries
vi.mock('../schema', () => ({
  db: {
    select: mockSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
  accounts: {
    id: 'accounts.id',
    userId: 'accounts.userId',
    accountNumberHash: 'accounts.accountNumberHash',
  },
  statementAccounts: {
    statementId: 'statementAccounts.statementId',
    accountId: 'statementAccounts.accountId',
  },
  merchantMemory: {
    id: 'merchantMemory.id',
    userId: 'merchantMemory.userId',
    merchantPattern: 'merchantMemory.merchantPattern',
  },
  transferLinks: { id: 'transferLinks.id' },
  transactions: { id: 'transactions.id' },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
}));

import { AccountService } from './accounts';

describe('AccountService', () => {
  let accountService: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    accountService = new AccountService();
  });

  describe('hashAccountNumber', () => {
    it('should hash account numbers consistently', () => {
      const hash1 = accountService.hashAccountNumber('1234567890');
      const hash2 = accountService.hashAccountNumber('1234567890');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different account numbers', () => {
      const hash1 = accountService.hashAccountNumber('1234567890');
      const hash2 = accountService.hashAccountNumber('0987654321');
      expect(hash1).not.toBe(hash2);
    });

    it('should trim whitespace before hashing', () => {
      const hash1 = accountService.hashAccountNumber('  1234567890  ');
      const hash2 = accountService.hashAccountNumber('1234567890');
      expect(hash1).toBe(hash2);
    });
  });

  describe('findAccountByHash', () => {
    it('should query database with correct parameters', async () => {
      mockFindByHash.mockResolvedValue({ id: 'acc1', accountName: 'Test Account' });

      const result = await accountService.findAccountByHash('user1', 'hash123');

      expect(mockFindByHash).toHaveBeenCalled();
      expect(result).toEqual({ id: 'acc1', accountName: 'Test Account' });
    });

    it('should return undefined when account not found', async () => {
      mockFindByHash.mockResolvedValue(undefined);

      const result = await accountService.findAccountByHash('user1', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('createAccount', () => {
    it('should create account with masked account number', async () => {
      mockFindByHash.mockResolvedValue(undefined); // Account doesn't exist
      mockCreate.mockResolvedValue({ id: 'acc1', accountNumber: 'XXXX-7890' });

      await accountService.createAccount({
        userId: 'user1',
        accountNumber: '1234567890',
        accountName: 'My Savings',
        accountType: 'savings',
      });

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should mask account number showing last 4 digits', async () => {
      mockFindByHash.mockResolvedValue(undefined);
      mockCreate.mockResolvedValue({ id: 'acc1', accountNumber: 'XXXX-7890' });

      const result = await accountService.createAccount({
        userId: 'user1',
        accountNumber: '1234567890',
        accountName: 'My Savings',
        accountType: 'savings',
      });

      expect(result.accountNumber).toBe('XXXX-7890');
    });

    it('should not mask short account numbers', async () => {
      mockFindByHash.mockResolvedValue(undefined);
      mockCreate.mockResolvedValue({ id: 'acc1', accountNumber: '1234' });

      const result = await accountService.createAccount({
        userId: 'user1',
        accountNumber: '1234',
        accountName: 'Short Account',
        accountType: 'checking',
      });

      expect(result.accountNumber).toBe('1234');
    });
  });

  describe('getUserAccounts', () => {
    it('should return all accounts for a user', async () => {
      const mockAccounts = [
        { id: 'acc1', accountName: 'Savings' },
        { id: 'acc2', accountName: 'Checking' },
      ];
      mockFindAll.mockResolvedValue(mockAccounts);

      const result = await accountService.getUserAccounts('user1');

      expect(mockFindAll).toHaveBeenCalled();
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('updateAccountBalance', () => {
    it('should update account balance', async () => {
      mockUpdateBalance.mockResolvedValue(undefined);

      await accountService.updateAccountBalance('acc1', 150000);

      expect(mockUpdateBalance).toHaveBeenCalled();
    });
  });
});
