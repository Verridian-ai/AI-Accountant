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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([{ id: 'tx1' }]),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ count: 1 }),
      });

      const result = await transactionRepository.findMany(filters);

      expect(result.data).toEqual([{ id: 'tx1' }]);
      expect(result.total).toBe(1);
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('findById', () => {
    it('should query by id and userId', async () => {
      await transactionRepository.findById('user1', 'tx1');
      expect(db.select).toHaveBeenCalled();
      expect(db.from).toHaveBeenCalled();
      expect(db.where).toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('should insert multiple transactions', async () => {
      const txs = [{ id: '1' }, { id: '2' }];
      await transactionRepository.createMany(
        txs as Parameters<typeof transactionRepository.createMany>[0],
      );
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(txs);
    });
  });
});
