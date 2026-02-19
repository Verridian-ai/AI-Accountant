import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transactionRepository } from './transaction-repository.js';
import { db } from '../schema.js';

// Mock the db
vi.mock('../schema.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    run: vi.fn(),
  },
  transactions: {
    userId: 'userId',
    accountId: 'accountId',
    date: 'date',
    category: 'category',
    description: 'description',
    id: 'id',
  },
  transactionHistory: {},
}));

type MockedDb = Record<string, ReturnType<typeof vi.fn>>;
const mockDb = db as unknown as MockedDb;

describe('TransactionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('should build correct query with filters', async () => {
      const filters = {
        userId: 'user1',
        accountId: 'acc1',
        search: 'test',
        limit: 10,
        offset: 5,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([{ id: 'tx1' }]),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ count: 1 }),
      });

      const result = await transactionRepository.findMany(filters);

      expect(result.data).toEqual([{ id: 'tx1' }]);
      expect(result.total).toBe(1);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('findById', () => {
    it('should query by id and userId', async () => {
      await transactionRepository.findById('user1', 'tx1');
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('should insert multiple transactions', async () => {
      const txs = [{ id: '1' }, { id: '2' }];
      await transactionRepository.createMany(
        txs as Parameters<typeof transactionRepository.createMany>[0],
      );
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(txs);
    });
  });
});
