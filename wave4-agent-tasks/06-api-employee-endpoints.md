# Agent 6: Employee API Endpoints Builder

## Role
Wire 15 new API routes for employee management in server/src/index.ts with Zod validation and pagination.

> **REVISION NOTE (D02 CRIT-01 — Auth Middleware):** All `/api/payroll/*` endpoints handle sensitive PII (TFN, bank details). These endpoints MUST require authentication once Wave 1's auth middleware is available. For now, they accept `userId` as a query/body parameter. When auth is wired, replace with JWT-extracted userId. Add a `// TODO(Wave 1): Replace userId extraction with JWT auth` comment on each endpoint.

> **REVISION NOTE (D05 H-05 — Error Handling):** Payroll operations must return structured errors. If employee save fails mid-batch, return `{ success: [], failed: [{ id, error }] }`. Encryption key missing in production = 503 Service Unavailable, not 500.

## Priority: SUB-WAVE 3 (After Agents 2, 3, 4 complete)

## Files to MODIFY

### 1. `server/src/index.ts`
**Purpose**: Add 15 employee/payroll API endpoints
**CRITICAL**: This file is large (~3400+ lines). Find the appropriate section for payroll routes. Do NOT modify any existing routes.

#### Step 1: Add imports
```typescript
import { employeeService } from './services/employee.js';
import { payStructureService } from './services/pay-structures.js';
import { validateTFN, validateBSB, isEncryptionConfigured } from './services/encryption.js';
```

#### Step 2: Add Zod schemas
```typescript
// Wave 4: Employee endpoint schemas
const createEmployeeSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(), // JSON
  taxFileNumber: z.string().regex(/^\d{8,9}$/, 'TFN must be 8-9 digits').optional(),
  startDate: z.string().min(1),
  employmentType: z.enum(['full_time', 'part_time', 'casual', 'contractor']),
});

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  taxFileNumber: z.string().regex(/^\d{8,9}$/).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['active', 'terminated', 'on_leave']).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'casual', 'contractor']).optional(),
});

const bankDetailsSchema = z.object({
  bsb: z.string().regex(/^\d{6}$/, 'BSB must be 6 digits'),
  accountNumber: z.string().min(4).max(12),
  accountName: z.string().min(1).max(200),
  splitPercentage: z.number().min(0).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

const superFundSchema = z.object({
  fundName: z.string().min(1).max(200),
  fundABN: z.string().regex(/^\d{11}$/, 'ABN must be 11 digits').optional(),
  usi: z.string().optional(),
  memberNumber: z.string().optional(),
  contributionRate: z.number().min(0).max(100).optional(),
});

const taxDeclarationSchema = z.object({
  taxFreeThreshold: z.boolean().optional(),
  helpDebt: z.boolean().optional(),
  sfssDebt: z.boolean().optional(),
  claimDependents: z.number().int().min(0).optional(),
  taxOffsetEstimated: z.number().int().min(0).optional(),
  effectiveDate: z.string().min(1),
});

const payCategorySchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(['ordinary', 'overtime', 'allowance', 'deduction', 'super', 'leave']),
  rateType: z.enum(['hourly', 'annual', 'fixed']),
  defaultRate: z.number().int().min(0).optional(),
  multiplier: z.number().min(0).optional(),
  isTaxable: z.boolean().optional(),
  isSuperBearing: z.boolean().optional(),
});

const payStructureSchema = z.object({
  payCategoryId: z.string().min(1),
  rate: z.number().int().min(0),
  hoursPerWeek: z.number().min(0).optional(),
  annualSalary: z.number().int().min(0).optional(),
  effectiveDate: z.string().min(1),
});
```

#### Step 3: Add 15 API routes

```typescript
// ============================================================================
// EMPLOYEE MANAGEMENT (Wave 4)
// ============================================================================

// --- Employee CRUD ---

app.get('/api/payroll/employees', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ error: 'userId required' }, 400);

    const page = parseInt(c.req.query('page') ?? '1');
    const limit = parseInt(c.req.query('limit') ?? '50');
    const status = c.req.query('status') ?? undefined;
    const search = c.req.query('search') ?? undefined;

    const result = await employeeService.listEmployees(userId, { page, limit, status, search });
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/payroll/employees', zValidator('json', createEmployeeSchema), async (c) => {
  try {
    const data = c.req.valid('json');

    // Validate TFN if provided
    if (data.taxFileNumber && !validateTFN(data.taxFileNumber)) {
      return c.json({ error: 'Invalid TFN format' }, 400);
    }

    // Warn if encryption not configured
    if (data.taxFileNumber && !isEncryptionConfigured()) {
      console.warn('WARNING: TFN_ENCRYPTION_KEY not set — TFN will be stored unencrypted');
    }

    const employee = await employeeService.createEmployee(data);
    return c.json(employee, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/api/payroll/employees/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const employee = await employeeService.getEmployee(id);
    if (!employee) return c.json({ error: 'Employee not found' }, 404);
    return c.json(employee);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.patch('/api/payroll/employees/:id', zValidator('json', updateEmployeeSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const data = c.req.valid('json');

    if (data.taxFileNumber && !validateTFN(data.taxFileNumber)) {
      return c.json({ error: 'Invalid TFN format' }, 400);
    }

    const employee = await employeeService.updateEmployee(id, data);
    if (!employee) return c.json({ error: 'Employee not found' }, 404);
    return c.json(employee);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete('/api/payroll/employees/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const employee = await employeeService.terminateEmployee(id);
    if (!employee) return c.json({ error: 'Employee not found' }, 404);
    return c.json(employee);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// --- Bank Details ---

app.get('/api/payroll/employees/:id/bank-details', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const details = await employeeService.getBankDetails(employeeId);
    return c.json({ data: details });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/payroll/employees/:id/bank-details', zValidator('json', bankDetailsSchema), async (c) => {
  try {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');

    if (!validateBSB(data.bsb)) {
      return c.json({ error: 'Invalid BSB format' }, 400);
    }

    const details = await employeeService.addBankDetails(employeeId, data);
    return c.json({ data: details }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// --- Super Funds ---

app.get('/api/payroll/employees/:id/super', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const funds = await employeeService.getSuperFund(employeeId);
    return c.json({ data: funds });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/payroll/employees/:id/super', zValidator('json', superFundSchema), async (c) => {
  try {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');
    const funds = await employeeService.addSuperFund(employeeId, data);
    return c.json({ data: funds }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// --- Tax Declaration ---

app.get('/api/payroll/employees/:id/tax-declaration', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const decl = await employeeService.getTaxDeclaration(employeeId);
    return c.json(decl ?? { message: 'No tax declaration on file' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/payroll/employees/:id/tax-declaration', zValidator('json', taxDeclarationSchema), async (c) => {
  try {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');
    const decl = await employeeService.submitTaxDeclaration(employeeId, data);
    return c.json(decl, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// --- Pay Categories ---

app.get('/api/payroll/pay-categories', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ error: 'userId required' }, 400);

    const page = parseInt(c.req.query('page') ?? '1');
    const limit = parseInt(c.req.query('limit') ?? '50');

    const result = await payStructureService.listPayCategories(userId, { page, limit });
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/payroll/pay-categories', zValidator('json', payCategorySchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const category = await payStructureService.createPayCategory(data);
    return c.json(category, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// --- Pay Structure ---

app.get('/api/payroll/employees/:id/pay-structure', async (c) => {
  try {
    const employeeId = c.req.param('id');
    const structure = await payStructureService.getPayStructure(employeeId);
    return c.json({ data: structure });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/payroll/employees/:id/pay-structure', zValidator('json', payStructureSchema), async (c) => {
  try {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');
    const structure = await payStructureService.setPayStructure({
      employeeId,
      ...data,
    });
    return c.json({ data: structure }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 15 endpoints compile and have correct HTTP methods
- [ ] POST endpoints use Zod validation
- [ ] GET list endpoints support pagination (?page=1&limit=50)
- [ ] TFN validation applied before creation
- [ ] BSB validation applied before bank detail creation
- [ ] DELETE performs soft-delete (terminates, doesn't remove)
- [ ] No existing routes are modified or broken
- [ ] Create marker file: `.agent-done-W04-06`

## Dependencies
- **Agent 2** must complete employee service
- **Agent 3** must complete pay structure service
- **Agent 4** must complete encryption utility
