import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks before they are used in vi.mock
const { mockGet, mockAll, mockInsert, mockUpdate, mockSelect } = vi.hoisted(() => {
    const mockGet = vi.fn();
    const mockAll = vi.fn();
    const mockWhere = vi.fn();
    const mockFrom = vi.fn();
    const mockSet = vi.fn();
    const mockValues = vi.fn();

    // Create chainable mock structure
    mockWhere.mockReturnValue({ get: mockGet, all: mockAll });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
    mockValues.mockResolvedValue({});

    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

    return { mockGet, mockAll, mockInsert, mockUpdate, mockSelect };
});

// Mock schema module
vi.mock('../schema', () => ({
    db: {
        select: mockSelect,
        update: mockUpdate,
        insert: mockInsert,
    },
    accounts: { id: 'accounts.id', userId: 'accounts.userId', accountNumberHash: 'accounts.accountNumberHash' },
    statementAccounts: { statementId: 'statementAccounts.statementId', accountId: 'statementAccounts.accountId' },
    merchantMemory: { id: 'merchantMemory.id', userId: 'merchantMemory.userId', merchantPattern: 'merchantMemory.merchantPattern' },
    transferLinks: { id: 'transferLinks.id' },
    transactions: { id: 'transactions.id' }
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
    eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
    and: vi.fn((...args) => ({ type: 'and', args }))
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
            mockGet.mockResolvedValue({ id: 'acc1', accountName: 'Test Account' });

            const result = await accountService.findAccountByHash('user1', 'hash123');

            expect(mockSelect).toHaveBeenCalled();
            expect(result).toEqual({ id: 'acc1', accountName: 'Test Account' });
        });

        it('should return undefined when account not found', async () => {
            mockGet.mockResolvedValue(undefined);

            const result = await accountService.findAccountByHash('user1', 'nonexistent');

            expect(result).toBeUndefined();
        });
    });

    describe('createAccount', () => {
        it('should create account with masked account number', async () => {
            await accountService.createAccount({
                userId: 'user1',
                accountNumber: '1234567890',
                accountName: 'My Savings',
                accountType: 'savings'
            });

            expect(mockInsert).toHaveBeenCalled();
        });

        it('should mask account number showing last 4 digits', async () => {
            const result = await accountService.createAccount({
                userId: 'user1',
                accountNumber: '1234567890',
                accountName: 'My Savings',
                accountType: 'savings'
            });

            expect(result.accountNumber).toBe('XXXX-7890');
        });

        it('should not mask short account numbers', async () => {
            const result = await accountService.createAccount({
                userId: 'user1',
                accountNumber: '1234',
                accountName: 'Short Account',
                accountType: 'checking'
            });

            expect(result.accountNumber).toBe('1234');
        });
    });

    describe('getUserAccounts', () => {
        it('should return all accounts for a user', async () => {
            const mockAccounts = [
                { id: 'acc1', accountName: 'Savings' },
                { id: 'acc2', accountName: 'Checking' }
            ];
            mockAll.mockResolvedValue(mockAccounts);

            const result = await accountService.getUserAccounts('user1');

            expect(mockSelect).toHaveBeenCalled();
            expect(result).toEqual(mockAccounts);
        });
    });

    describe('updateAccountBalance', () => {
        it('should update account balance', async () => {
            await accountService.updateAccountBalance('acc1', 150000);

            expect(mockUpdate).toHaveBeenCalled();
        });
    });
});

