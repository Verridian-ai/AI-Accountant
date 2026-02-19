# Testing & Quality Assurance Patterns

## Overview
Comprehensive testing ensures reliability, maintainability, and performance. This skill covers unit testing, integration testing, end-to-end testing, test organization, mocking strategies, and coverage targets for Node.js backends and React frontends.

## Key Patterns

### Pattern 1: Unit Tests with Vitest and Table-Driven Tests
Table-driven tests reduce repetition and improve readability for functions with multiple scenarios.

```typescript
// src/services/__tests__/password.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

describe('Password Service', () => {
  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'MySecurePassword123!'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toEqual(password)
      expect(hash).toMatch(/^\$2a\$/) // bcrypt format
    })

    it('should reject short passwords', async () => {
      const password = 'short'

      expect(hashPassword(password)).rejects.toThrow('at least 12 characters')
    })

    it('should produce different hashes for same password', async () => {
      const password = 'MySecurePassword123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toEqual(hash2) // Different salts
    })
  })

  describe('verifyPassword', () => {
    // Table-driven tests
    it.each([
      { password: 'MySecurePassword123!', valid: true },
      { password: 'WrongPassword', valid: false },
      { password: '', valid: false },
    ])('should verify password correctly: "$password" -> $valid', async ({ password, valid }) => {
      const correctPassword = 'MySecurePassword123!'
      const hash = await hashPassword(correctPassword)

      const result = await verifyPassword(password, hash)

      expect(result).toBe(valid)
    })
  })
})
```

**Why table-driven tests**:
- Reduces code duplication; many scenarios in minimal code
- Easy to add new test cases; just add a row
- Clear test matrix; all variations visible at a glance
- Better coverage with less effort

### Pattern 2: Integration Tests with Database
Test database operations with real (or mocked) database connections.

```typescript
// src/services/__tests__/transaction.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTransaction, getTransactionsByAccount } from '../transaction'
import { db } from '../../db'

describe('Transaction Service', () => {
  const testTenantId = 'tenant-123'
  const testAccountId = 1

  beforeAll(async () => {
    // Setup: Create test data
    await db.insert(accounts).values({
      tenantId: testTenantId,
      accountName: 'Test Account',
      accountNumber: '123456789',
      balance: 100000, // $1000.00 in cents
    })
  })

  afterAll(async () => {
    // Teardown: Clean up test data
    await db.delete(transactions).where(eq(transactions.tenantId, testTenantId))
    await db.delete(accounts).where(eq(accounts.tenantId, testTenantId))
  })

  it('should create transaction and update balance', async () => {
    const txnData = {
      accountId: testAccountId,
      amount: -5000, // $50 debit
      description: 'Test withdrawal',
      transactionDate: new Date(),
    }

    const result = await createTransaction(testTenantId, txnData)

    expect(result).toHaveProperty('id')
    expect(result.amount).toBe(-5000)

    // Verify balance was updated
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, testAccountId),
    })
    expect(account?.balance).toBe(95000) // $1000 - $50
  })

  it('should retrieve transactions for account', async () => {
    // Insert multiple transactions
    const txns = [
      { amount: 5000, description: 'Deposit 1' },
      { amount: -2000, description: 'Withdrawal 1' },
      { amount: 10000, description: 'Deposit 2' },
    ]

    for (const txn of txns) {
      await createTransaction(testTenantId, {
        ...txn,
        accountId: testAccountId,
        transactionDate: new Date(),
      })
    }

    const retrieved = await getTransactionsByAccount(testTenantId, testAccountId)

    expect(retrieved).toHaveLength(txns.length)
    expect(retrieved[0].amount).toBe(txns[0].amount)
  })

  it('should enforce tenant isolation', async () => {
    const otherTenantId = 'tenant-456'

    // Attempt to access other tenant's transactions
    const result = await getTransactionsByAccount(otherTenantId, testAccountId)

    expect(result).toHaveLength(0) // No data leaked
  })
})
```

### Pattern 3: Hono Route Testing
Test HTTP endpoints with mock requests.

```typescript
// src/routes/__tests__/transactions.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import transactionsRoutes from '../transactions'

describe('Transactions Routes', () => {
  const app = new Hono()
  app.route('/api/transactions', transactionsRoutes)

  it('POST /api/transactions should create transaction', async () => {
    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token',
        'X-Tenant-Id': 'tenant-123',
      },
      body: JSON.stringify({
        accountId: 1,
        amount: -5000,
        description: 'Test payment',
        transactionDate: new Date().toISOString(),
      }),
    })

    const res = await app.request(req)

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data).toHaveProperty('id')
    expect(data.amount).toBe(-5000)
  })

  it('GET /api/transactions should return 401 without token', async () => {
    const req = new Request('http://localhost/api/transactions', {
      method: 'GET',
      headers: {
        'X-Tenant-Id': 'tenant-123',
        // Missing Authorization header
      },
    })

    const res = await app.request(req)

    expect(res.status).toBe(401)
  })

  it('GET /api/transactions?page=2&limit=20 should paginate', async () => {
    const req = new Request('http://localhost/api/transactions?page=2&limit=20', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer mock-token',
        'X-Tenant-Id': 'tenant-123',
      },
    })

    const res = await app.request(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Page-Count')).toBeDefined()
  })

  it('should return 403 for tenant mismatch', async () => {
    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token-for-tenant-123',
        'X-Tenant-Id': 'tenant-456', // Mismatch
      },
      body: JSON.stringify({ accountId: 1, amount: 5000 }),
    })

    const res = await app.request(req)

    expect(res.status).toBe(403)
  })
})
```

### Pattern 4: End-to-End Tests with Playwright
Test complete user workflows from UI to backend.

```typescript
// e2e/transactions.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Transactions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', 'user@example.com')
    await page.fill('input[name="password"]', 'ValidPassword123!')
    await page.click('button[type="submit"]')
    await page.waitForNavigation()

    // Navigate to transactions
    await page.goto('http://localhost:3000/transactions')
  })

  test('should display transaction list', async ({ page }) => {
    const table = page.locator('table tbody')

    // Wait for data to load
    await expect(table).toContainText('Deposit')

    const rows = await page.locator('table tbody tr').count()
    expect(rows).toBeGreaterThan(0)
  })

  test('should create new transaction', async ({ page }) => {
    // Click "New Transaction" button
    await page.click('button:has-text("New Transaction")')

    // Fill form
    await page.fill('input[name="description"]', 'Test Payment')
    await page.fill('input[name="amount"]', '50.00')
    await page.selectOption('select[name="category"]', 'expense')

    // Submit
    await page.click('button[type="submit"]')

    // Verify success message
    await expect(page.locator('text=Transaction created')).toBeVisible()

    // Verify new transaction in list
    await expect(page.locator('table')).toContainText('Test Payment')
  })

  test('should filter transactions by date range', async ({ page }) => {
    // Set date filter
    await page.fill('input[name="startDate"]', '2024-01-01')
    await page.fill('input[name="endDate"]', '2024-01-31')

    // Apply filter
    await page.click('button:has-text("Apply")')

    // Wait for filtered results
    await page.waitForLoadState('networkidle')

    // Verify only filtered transactions shown
    const rows = await page.locator('table tbody tr').all()
    for (const row of rows) {
      const dateText = await row.locator('td:nth-child(3)').textContent()
      expect(dateText).toMatch(/^Jan 20[24]$/)
    }
  })

  test('should show error on invalid input', async ({ page }) => {
    await page.click('button:has-text("New Transaction")')

    // Try empty amount
    await page.fill('input[name="description"]', 'Test')
    await page.click('button[type="submit"]')

    // Verify error message
    await expect(page.locator('text=Amount is required')).toBeVisible()
  })
})
```

### Pattern 5: Test Fixtures and Mocking
Reusable test data and mocked dependencies.

```typescript
// src/__tests__/fixtures/users.ts
import { faker } from '@faker-js/faker'

export const createMockUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  passwordHash: 'hashed_password',
  tenantId: 'tenant-123',
  role: 'accountant' as const,
  createdAt: faker.date.past(),
  ...overrides,
})

export const createMockAccount = (overrides = {}) => ({
  id: faker.number.int({ min: 1, max: 1000 }),
  tenantId: 'tenant-123',
  accountName: faker.finance.accountName(),
  accountNumber: faker.finance.accountNumber({ length: 10 }),
  balance: faker.number.int({ min: -100000, max: 100000 }), // cents
  createdAt: faker.date.past(),
  ...overrides,
})

// Usage in tests
import { describe, it, expect, vi } from 'vitest'
import { createMockUser, createMockAccount } from './__tests__/fixtures/users'

describe('User Service', () => {
  it('should fetch user details', async () => {
    const mockUser = createMockUser({ role: 'admin' })

    const userService = {
      getUser: vi.fn().mockResolvedValue(mockUser),
    }

    const result = await userService.getUser(mockUser.id)

    expect(result.role).toBe('admin')
    expect(userService.getUser).toHaveBeenCalledWith(mockUser.id)
  })
})
```

## Best Practices

- **Test behavior, not implementation**: Test what the function does, not how
- **Keep tests focused**: One assertion per test; one concept per test
- **Use descriptive test names**: `should reject short passwords` not `test1`
- **Isolate tests**: Each test should be independent; no shared state
- **Mock external dependencies**: Don't call real APIs; mock them
- **Aim for 80%+ coverage**: Coverage metric; don't chase 100%
- **Test error paths**: Not just happy path; test failures and edge cases
- **Use fixtures for test data**: Reusable, maintainable test data
- **Run tests in CI/CD**: Automate; don't rely on manual testing
- **Keep tests fast**: Unit tests should run in < 1 second; use test parallelization

## Common Pitfalls

- **Testing implementation details**: Tests break when refactoring; test the contract
- **Skipping error cases**: Most bugs in error handling; test failures
- **Brittle selectors**: UI tests break with minor CSS changes; use data-testid
- **Hard-coded test data**: Use fixtures; makes tests easy to modify
- **No test isolation**: Shared state causes flaky tests; use beforeEach/afterEach
- **Slow tests**: Tests get skipped; optimize database queries, mock APIs
- **Testing everything equally**: Focus on critical paths; less on boilerplate
- **No coverage tracking**: Don't know what's untested; use coverage tools
- **Ignoring test failures**: Fix flaky tests immediately; don't ignore
- **Testing after development**: Write tests first (TDD) or during development

## GoldLedger Application

GoldLedger's testing strategy:

1. **Unit tests** for business logic (validation, calculations, auth)
2. **Integration tests** for database operations with Drizzle
3. **Route tests** for Hono endpoints with mock requests
4. **E2E tests** for critical user workflows with Playwright
5. **Fixtures** for consistent test data (users, accounts, transactions)
6. **CI/CD enforcement**: Tests must pass before merge to main

**Example from GoldLedger** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/__tests__/',
      ],
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
})
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Testing](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Effective Testing with Faker.js](https://fakerjs.dev/)
- [Jest Matchers Reference](https://jestjs.io/docs/expect)
