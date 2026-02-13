import { db, accounts, statementAccounts, merchantMemory } from '../schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';

export class AccountService {
  // Hash account number for secure matching
  hashAccountNumber(accountNumber: string): string {
    return crypto.createHash('sha256').update(accountNumber.trim()).digest('hex');
  }

  // Find account by account number hash
  async findAccountByHash(userId: string, accountNumberHash: string) {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.accountNumberHash, accountNumberHash)))
      .get();
  }

  // Create a new account
  async createAccount(data: {
    userId: string;
    accountNumber: string;
    accountName: string;
    accountType: string;
    bankName?: string;
    interestRate?: number;
    creditLimit?: number;
    minimumPayment?: number;
    paymentDueDay?: number;
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const accountNumberHash = this.hashAccountNumber(data.accountNumber);

    // Mask the account number for display (show last 4 digits)
    const masked =
      data.accountNumber.length > 4 ? 'XXXX-' + data.accountNumber.slice(-4) : data.accountNumber;

    await db.insert(accounts).values({
      id,
      userId: data.userId,
      accountNumber: masked,
      accountNumberHash,
      accountName: data.accountName,
      accountType: data.accountType,
      bankName: data.bankName || null,
      interestRate: data.interestRate || null,
      creditLimit: data.creditLimit || null,
      minimumPayment: data.minimumPayment || null,
      paymentDueDay: data.paymentDueDay || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { id, accountNumber: masked, accountNumberHash };
  }

  // Link a statement to an account
  async linkStatementToAccount(statementId: string, accountId: string) {
    await db.insert(statementAccounts).values({
      statementId,
      accountId,
    });
  }

  // Get all accounts for a user
  async getUserAccounts(userId: string) {
    return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
  }

  // Get merchant memory for intelligent categorization
  async getMerchantMemory(userId: string) {
    return db.select().from(merchantMemory).where(eq(merchantMemory.userId, userId)).all();
  }

  // Update or create merchant memory entry
  async updateMerchantMemory(data: {
    userId: string;
    merchantPattern: string;
    merchantDisplayName?: string;
    category: string;
    gstApplicable: boolean;
    isUserConfirmed: boolean;
  }) {
    const existing = await db
      .select()
      .from(merchantMemory)
      .where(
        and(
          eq(merchantMemory.userId, data.userId),
          eq(merchantMemory.merchantPattern, data.merchantPattern),
        ),
      )
      .get();

    const now = new Date().toISOString();

    if (existing) {
      await db
        .update(merchantMemory)
        .set({
          category: data.category,
          gstApplicable: data.gstApplicable,
          merchantDisplayName: data.merchantDisplayName,
          timesUsed: (existing.timesUsed || 0) + 1,
          lastUsed: now,
          isUserConfirmed: data.isUserConfirmed || existing.isUserConfirmed,
        })
        .where(eq(merchantMemory.id, existing.id));
    } else {
      await db.insert(merchantMemory).values({
        id: crypto.randomUUID(),
        userId: data.userId,
        merchantPattern: data.merchantPattern,
        merchantDisplayName: data.merchantDisplayName || null,
        category: data.category,
        gstApplicable: data.gstApplicable,
        timesUsed: 1,
        lastUsed: now,
        isUserConfirmed: data.isUserConfirmed,
        createdAt: now,
      });
    }
  }

  // Update account balance
  async updateAccountBalance(accountId: string, balance: number) {
    await db
      .update(accounts)
      .set({
        currentBalance: balance,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));
  }

  // Batch update merchant memory
  async batchUpdateMerchantMemory(
    userId: string,
    updates: Array<{
      merchantPattern: string;
      merchantDisplayName?: string;
      category: string;
      gstApplicable: boolean;
      isUserConfirmed: boolean;
      createdAt: string;
    }>,
  ) {
    if (updates.length === 0) return;

    // Deduplicate updates by pattern, favoring the latest one
    const uniqueUpdates = new Map<string, (typeof updates)[0]>();
    updates.forEach((u) => uniqueUpdates.set(u.merchantPattern, u));

    const patterns = Array.from(uniqueUpdates.keys());
    if (patterns.length === 0) return;

    // 1. Fetch existing memories for these patterns
    const existingMemories = await db
      .select()
      .from(merchantMemory)
      .where(
        and(eq(merchantMemory.userId, userId), inArray(merchantMemory.merchantPattern, patterns)),
      )
      .all();

    const existingMap = new Map(existingMemories.map((m: any) => [m.merchantPattern, m]));
    const now = new Date().toISOString();

    const toInsert: (typeof merchantMemory.$inferInsert)[] = [];
    const updatePromises: Promise<any>[] = [];

    for (const [pattern, data] of uniqueUpdates) {
      const existing = existingMap.get(pattern) as any;
      if (existing) {
        updatePromises.push(
          db
            .update(merchantMemory)
            .set({
              category: data.category,
              gstApplicable: data.gstApplicable,
              merchantDisplayName: data.merchantDisplayName,
              timesUsed: (existing.timesUsed || 0) + 1,
              lastUsed: now,
              isUserConfirmed: data.isUserConfirmed || existing.isUserConfirmed,
            })
            .where(eq(merchantMemory.id, existing.id)),
        );
      } else {
        toInsert.push({
          id: crypto.randomUUID(),
          userId,
          merchantPattern: data.merchantPattern,
          merchantDisplayName: data.merchantDisplayName || null,
          category: data.category,
          gstApplicable: data.gstApplicable,
          timesUsed: 1,
          lastUsed: now,
          isUserConfirmed: data.isUserConfirmed,
          createdAt: now,
        });
      }
    }

    if (toInsert.length > 0) {
      await db.insert(merchantMemory).values(toInsert);
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
  }
}

export const accountService = new AccountService();
