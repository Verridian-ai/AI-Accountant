# Skill: Coding Languages & Frameworks — Complete Reference

> Production patterns for every major language and framework.
> TypeScript, Python, Go, Rust, Java, C#, PHP, Swift, Kotlin, Lua, C/C++,
> React, Next.js, Hono, FastAPI, Django, Laravel, Spring, .NET, and more.

---

## TYPESCRIPT / JAVASCRIPT

### Type Safety Patterns
```ts
// Never use `any` — use unknown + narrowing
function processInput(input: unknown): string {
  if (typeof input === 'string') return input
  if (typeof input === 'number') return String(input)
  throw new Error(`Unexpected input type: ${typeof input}`)
}

// Discriminated unions (prefer over optional fields)
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Branded types (prevent primitive confusion)
type UserId = string & { readonly __brand: 'UserId' }
type TenantId = string & { readonly __brand: 'TenantId' }
const toUserId = (id: string): UserId => id as UserId

// Satisfies operator (validate without widening)
const config = {
  port: 3000,
  host: 'localhost',
} satisfies Record<string, string | number>

// Template literal types
type EventName = `on${Capitalize<string>}`
type CSSProperty = `${string}-${string}`

// Infer in conditional types
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never
```

### Async Patterns
```ts
// Never swallow errors
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user) return { ok: false, error: 'User not found' }
    return { ok: true, data: user }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Parallel with error handling
const [users, transactions] = await Promise.all([
  fetchUsers(tenantId),
  fetchTransactions(tenantId),
])

// Timeout wrapper
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))
  return Promise.race([promise, timeout])
}
```

### Zod Validation (always use for external data)
```ts
import { z } from 'zod'

const CreateTransactionSchema = z.object({
  amount: z.number().int().positive('Amount must be positive integer cents'),
  description: z.string().min(1).max(500),
  date: z.string().datetime(),
  categoryId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
})

type CreateTransaction = z.infer<typeof CreateTransactionSchema>

// Hono route with zValidator
app.post('/transactions', zValidator('json', CreateTransactionSchema), async (c) => {
  const body = c.req.valid('json') // fully typed
})
```

---

## REACT 19 — ADVANCED PATTERNS

### Server Components vs Client Components
```tsx
// Server Component (default) — no 'use client', runs on server
// Can: fetch data, access DB, use secrets
// Cannot: useState, useEffect, event handlers, browser APIs
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  return <ProfileCard user={user} />
}

// Client Component — add 'use client' at top
'use client'
import { useState, useTransition } from 'react'

export function InteractiveForm() {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    startTransition(async () => {
      await submitForm(value) // Server Action
    })
  }
}
```

### React 19 New APIs
```tsx
// use() hook — read promises and context
import { use } from 'react'

function UserCard({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise) // suspends until resolved
  return <div>{user.name}</div>
}

// useOptimistic — optimistic UI updates
import { useOptimistic } from 'react'

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(todos,
    (state, newTodo: Todo) => [...state, newTodo])

  const addTodo = async (text: string) => {
    const newTodo = { id: crypto.randomUUID(), text, done: false }
    addOptimistic(newTodo) // immediate UI update
    await createTodo(newTodo) // actual server call
  }
}

// useFormStatus — form submission state
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? 'Saving...' : 'Save'}</button>
}

// useActionState — form actions with state
import { useActionState } from 'react'

function Form() {
  const [state, action, isPending] = useActionState(submitAction, { error: null })
  return (
    <form action={action}>
      {state.error && <p className="text-red-500">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}
```

### TanStack Query v5 Patterns
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query with proper typing
function useTransactions(tenantId: string) {
  return useQuery({
    queryKey: ['transactions', tenantId],
    queryFn: () => api.transactions.list(tenantId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

// Optimistic mutation
function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTransaction) => api.transactions.create(data),
    onMutate: async (newTx) => {
      await qc.cancelQueries({ queryKey: ['transactions'] })
      const prev = qc.getQueryData<Transaction[]>(['transactions', newTx.tenantId])
      qc.setQueryData(['transactions', newTx.tenantId],
        (old: Transaction[] = []) => [...old, { ...newTx, id: 'temp' }])
      return { prev }
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['transactions'], ctx.prev)
    },
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: ['transactions', vars.tenantId] })
    },
  })
}
```

---

## HONO — TYPESCRIPT API FRAMEWORK

### Route Structure
```ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { jwt } from 'hono/jwt'
import { z } from 'zod'

const app = new Hono()

// Middleware chain
app.use('/api/*', jwt({ secret: process.env.JWT_SECRET! }))
app.use('/api/*', tenantAuthMiddleware)

// Route with validation
app.post('/api/transactions',
  zValidator('json', CreateTransactionSchema),
  async (c) => {
    const body = c.req.valid('json')
    const payload = c.get('jwtPayload')
    if (!payload?.sub) return c.json({ error: 'Unauthorized' }, 401)

    const result = await createTransaction({ ...body, userId: payload.sub })
    return c.json(result, 201)
  }
)

// Error handling
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})
```

### Drizzle ORM Patterns
```ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { eq, and, desc, sql } from 'drizzle-orm'

const db = drizzle(neon(process.env.NEON_DATABASE_URL!))

// Query with relations
const transactions = await db.query.transactions.findMany({
  where: and(
    eq(transactions.tenantId, tenantId),
    eq(transactions.status, 'active')
  ),
  with: { category: true, account: true },
  orderBy: desc(transactions.date),
  limit: 50,
  offset: page * 50,
})

// Aggregation
const totals = await db.select({
  total: sql<number>`sum(${transactions.amount})`,
  count: sql<number>`count(*)`,
}).from(transactions)
  .where(eq(transactions.tenantId, tenantId))
```

---

## PYTHON — MODERN PATTERNS

### Type Hints (Python 3.10+)
```python
from typing import TypeVar, Generic
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class Result(Generic[T]):
    ok: bool
    data: T | None = None
    error: str | None = None

# Match statement (Python 3.10+)
def process(command: str) -> str:
    match command.split():
        case ["quit"]: return "Goodbye"
        case ["go", direction]: return f"Going {direction}"
        case ["get", obj, *rest]: return f"Getting {obj}"
        case _: return "Unknown command"

# Protocol (structural typing)
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...
    def resize(self, factor: float) -> None: ...
```

### FastAPI Patterns
```python
from fastapi import FastAPI, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Annotated

app = FastAPI()

class TransactionCreate(BaseModel):
    amount: int = Field(gt=0, description="Amount in cents")
    description: str = Field(min_length=1, max_length=500)
    tenant_id: str

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise credentials_exception
    except JWTError:
        raise credentials_exception
    return await get_user(user_id)

@app.post("/transactions", status_code=201)
async def create_transaction(
    body: TransactionCreate,
    current_user: Annotated[User, Depends(get_current_user)]
) -> Transaction:
    return await transaction_service.create(body, current_user.id)
```

### Async Python
```python
import asyncio
import aiohttp

async def fetch_all(urls: list[str]) -> list[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)

# Context manager pattern
class DatabaseConnection:
    async def __aenter__(self):
        self.conn = await connect()
        return self.conn

    async def __aexit__(self, *args):
        await self.conn.close()
```

---

## GO — PRODUCTION PATTERNS

```go
// Error handling (always explicit)
func fetchUser(ctx context.Context, id string) (*User, error) {
    user, err := db.QueryRowContext(ctx, "SELECT * FROM users WHERE id = $1", id).Scan(&user)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
        }
        return nil, fmt.Errorf("fetchUser: %w", err)
    }
    return user, nil
}

// Goroutines with errgroup
import "golang.org/x/sync/errgroup"

func fetchParallel(ctx context.Context) error {
    g, ctx := errgroup.WithContext(ctx)
    g.Go(func() error { return fetchUsers(ctx) })
    g.Go(func() error { return fetchTransactions(ctx) })
    return g.Wait()
}

// Interface-based design
type Repository interface {
    FindByID(ctx context.Context, id string) (*Entity, error)
    Save(ctx context.Context, entity *Entity) error
    Delete(ctx context.Context, id string) error
}
```

---

## RUST — SYSTEMS PROGRAMMING

```rust
// Result and Option handling
fn parse_config(path: &str) -> Result<Config, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(path)?;
    let config: Config = serde_json::from_str(&content)?;
    Ok(config)
}

// Ownership and borrowing
fn process_data(data: &[u8]) -> Vec<u8> {
    data.iter().map(|&b| b.wrapping_add(1)).collect()
}

// Async with Tokio
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);

    tokio::spawn(async move {
        for i in 0..10 {
            tx.send(i).await.unwrap();
            sleep(Duration::from_millis(100)).await;
        }
    });

    while let Some(val) = rx.recv().await {
        println!("Got: {val}");
    }
    Ok(())
}

// Trait implementations
trait Serialize {
    fn serialize(&self) -> String;
}

#[derive(Debug, Clone)]
struct Transaction { amount: i64, description: String }

impl Serialize for Transaction {
    fn serialize(&self) -> String {
        format!("{{\"amount\":{},\"description\":\"{}\"}}", self.amount, self.description)
    }
}
```

---

## JAVA / KOTLIN — JVM PATTERNS

### Java (Spring Boot)
```java
@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
public class TransactionController {
    private final TransactionService service;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionDto create(
        @Valid @RequestBody CreateTransactionRequest request,
        @AuthenticationPrincipal UserDetails user
    ) {
        return service.create(request, user.getUsername());
    }

    @ExceptionHandler(TransactionNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(TransactionNotFoundException ex) {
        return new ErrorResponse(ex.getMessage());
    }
}
```

### Kotlin (idiomatic)
```kotlin
// Data classes + sealed classes
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}

// Extension functions
fun String.toSlug(): String = lowercase().replace(Regex("[^a-z0-9]+"), "-")

// Coroutines
suspend fun fetchUserData(userId: String): UserData = coroutineScope {
    val profile = async { profileService.fetch(userId) }
    val settings = async { settingsService.fetch(userId) }
    UserData(profile.await(), settings.await())
}

// Flow
fun transactionStream(tenantId: String): Flow<Transaction> = flow {
    while (true) {
        emit(fetchLatest(tenantId))
        delay(5000)
    }
}
```

---

## C# / .NET — PATTERNS

```csharp
// Records (immutable data)
public record Transaction(
    Guid Id,
    decimal Amount,
    string Description,
    DateTime Date,
    Guid TenantId
);

// Minimal API (ASP.NET Core)
app.MapPost("/api/transactions", async (
    CreateTransactionRequest request,
    ITransactionService service,
    ClaimsPrincipal user) =>
{
    var tenantId = user.FindFirst("tenant_id")?.Value
        ?? throw new UnauthorizedAccessException();
    var result = await service.CreateAsync(request, tenantId);
    return Results.Created($"/api/transactions/{result.Id}", result);
})
.RequireAuthorization()
.WithValidator<CreateTransactionRequest>();

// LINQ patterns
var summary = transactions
    .Where(t => t.Date >= startDate && t.TenantId == tenantId)
    .GroupBy(t => t.Category)
    .Select(g => new { Category = g.Key, Total = g.Sum(t => t.Amount), Count = g.Count() })
    .OrderByDescending(x => x.Total)
    .ToList();
```

---

## PHP / LARAVEL

```php
// Eloquent model
class Transaction extends Model {
    protected $fillable = ['amount', 'description', 'date', 'tenant_id'];
    protected $casts = ['date' => 'datetime', 'amount' => 'integer'];

    public function tenant(): BelongsTo {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeForTenant(Builder $query, string $tenantId): Builder {
        return $query->where('tenant_id', $tenantId);
    }
}

// Controller with Form Request validation
class TransactionController extends Controller {
    public function store(CreateTransactionRequest $request): JsonResponse {
        $transaction = Transaction::create([
            ...$request->validated(),
            'tenant_id' => auth()->user()->tenant_id,
        ]);
        return response()->json($transaction, 201);
    }
}

// Form Request
class CreateTransactionRequest extends FormRequest {
    public function rules(): array {
        return [
            'amount' => 'required|integer|min:1',
            'description' => 'required|string|max:500',
            'date' => 'required|date',
        ];
    }
}
```

---

## SWIFT — iOS/macOS

```swift
// SwiftUI + Combine
import SwiftUI
import Combine

@MainActor
class TransactionViewModel: ObservableObject {
    @Published var transactions: [Transaction] = []
    @Published var isLoading = false
    @Published var error: Error?

    private var cancellables = Set<AnyCancellable>()

    func fetchTransactions() {
        isLoading = true
        apiService.fetchTransactions()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion { self?.error = error }
                },
                receiveValue: { [weak self] transactions in
                    self?.transactions = transactions
                }
            )
            .store(in: &cancellables)
    }
}

// Async/await (Swift 5.5+)
func fetchUser(id: String) async throws -> User {
    let (data, response) = try await URLSession.shared.data(from: URL(string: "/users/\(id)")!)
    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
        throw APIError.invalidResponse
    }
    return try JSONDecoder().decode(User.self, from: data)
}
```

---

## LUA — SCRIPTING

```lua
-- Module pattern
local M = {}

-- Class-like pattern
local Transaction = {}
Transaction.__index = Transaction

function Transaction.new(amount, description)
    local self = setmetatable({}, Transaction)
    self.amount = amount
    self.description = description
    self.id = math.random(1, 1000000)
    return self
end

function Transaction:serialize()
    return string.format('{"id":%d,"amount":%d,"description":"%s"}',
        self.id, self.amount, self.description)
end

-- Coroutines
local function producer()
    local items = {1, 2, 3, 4, 5}
    for _, item in ipairs(items) do
        coroutine.yield(item)
    end
end

local co = coroutine.create(producer)
while true do
    local ok, value = coroutine.resume(co)
    if not ok or value == nil then break end
    print(value)
end

return M
```

---

## NEXT.JS 15 — APP ROUTER

```tsx
// app/transactions/page.tsx — Server Component
import { Suspense } from 'react'

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page = '1' } = await searchParams
  const transactions = await fetchTransactions(parseInt(page, 10))

  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsList initialData={transactions} />
    </Suspense>
  )
}

// Route Handler (app/api/transactions/route.ts)
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = CreateTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const result = await createTransaction(parsed.data)
  return NextResponse.json(result, { status: 201 })
}

// Server Action
'use server'
export async function createTransactionAction(formData: FormData) {
  const amount = parseInt(formData.get('amount') as string, 10)
  const description = formData.get('description') as string
  await db.insert(transactions).values({ amount, description })
  revalidatePath('/transactions')
}
```

---

## DOCKER & INFRASTRUCTURE

```dockerfile
# Multi-stage build (Node.js)
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml patterns
services:
  app:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      postgres:
        condition: service_healthy
```

---

## TESTING PATTERNS

```ts
// Vitest (TypeScript)
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('TransactionService', () => {
  let service: TransactionService
  let mockDb: MockDb

  beforeEach(() => {
    mockDb = createMockDb()
    service = new TransactionService(mockDb)
  })

  it('creates transaction with correct amount', async () => {
    const result = await service.create({ amount: 1000, description: 'Test' })
    expect(result.amount).toBe(1000)
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000 })
    )
  })

  it('rejects negative amounts', async () => {
    await expect(service.create({ amount: -100, description: 'Test' }))
      .rejects.toThrow('Amount must be positive')
  })
})
```

```python
# pytest (Python)
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_create_transaction():
    with patch('services.db.insert', new_callable=AsyncMock) as mock_insert:
        mock_insert.return_value = {'id': '123', 'amount': 1000}
        result = await transaction_service.create({'amount': 1000, 'description': 'Test'})
        assert result['amount'] == 1000
        mock_insert.assert_called_once()
```
