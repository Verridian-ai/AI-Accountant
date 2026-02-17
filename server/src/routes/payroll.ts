import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { employeeService } from '../services/employee.js';
import { payStructureService } from '../services/pay-structures.js';
import { validateTFN, validateBSB, isEncryptionConfigured } from '../services/encryption.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';

const payrollRoutes = new Hono();

// --- Validation Schemas ---

const createEmployeeSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  dateOfBirth: z.string().optional(),
  taxFileNumber: z
    .string()
    .regex(/^\d{8,9}$/)
    .optional(),
  startDate: z.string().min(1),
  employmentType: z.enum(['full_time', 'part_time', 'casual', 'contractor']),
});

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(),
  taxFileNumber: z
    .string()
    .regex(/^\d{8,9}$/)
    .optional(),
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
  fundABN: z
    .string()
    .regex(/^\d{11}$/, 'ABN must be 11 digits')
    .optional(),
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

// --- Employee CRUD ---

payrollRoutes.get('/employees', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId required' }, 400);

  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '50')));
  const status = c.req.query('status') ?? undefined;
  const search = c.req.query('search') ?? undefined;

  const page = Math.floor(offset / limit) + 1;
  const result = await employeeService.listEmployees(userId, { page, limit, status, search });
  return c.json(result);
});

payrollRoutes.post('/employees', zValidator('json', createEmployeeSchema), async (c) => {
  const data = c.req.valid('json');

  if (data.taxFileNumber && !validateTFN(data.taxFileNumber)) {
    return c.json({ error: 'Invalid TFN format' }, 400);
  }

  if (data.taxFileNumber && !isEncryptionConfigured()) {
    if (config.isProduction) {
      return c.json({ error: 'Encryption service unavailable — cannot store TFN' }, 503);
    }
    logger.warn('WARNING: TFN_ENCRYPTION_KEY not set — TFN will be stored unencrypted');
  }

  const employee = await employeeService.createEmployee(data);
  return c.json(employee, 201);
});

payrollRoutes.get('/employees/:id', async (c) => {
  const id = c.req.param('id');
  const employee = await employeeService.getEmployee(id);
  if (!employee) return c.json({ error: 'Employee not found' }, 404);
  return c.json(employee);
});

payrollRoutes.patch('/employees/:id', zValidator('json', updateEmployeeSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  if (data.taxFileNumber && !validateTFN(data.taxFileNumber)) {
    return c.json({ error: 'Invalid TFN format' }, 400);
  }

  const employee = await employeeService.updateEmployee(id, data);
  if (!employee) return c.json({ error: 'Employee not found' }, 404);
  return c.json(employee);
});

payrollRoutes.delete('/employees/:id', async (c) => {
  const id = c.req.param('id');
  const employee = await employeeService.terminateEmployee(id);
  if (!employee) return c.json({ error: 'Employee not found' }, 404);
  return c.json(employee);
});

// --- Bank Details ---

payrollRoutes.get('/employees/:id/bank-details', async (c) => {
  const employeeId = c.req.param('id');
  const details = await employeeService.getBankDetails(employeeId);
  return c.json({ data: details });
});

payrollRoutes.post(
  '/employees/:id/bank-details',
  zValidator('json', bankDetailsSchema),
  async (c) => {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');

    if (!validateBSB(data.bsb)) {
      return c.json({ error: 'Invalid BSB format — must be 6 digits' }, 400);
    }

    if (!isEncryptionConfigured()) {
      if (config.isProduction) {
        return c.json(
          { error: 'Encryption service unavailable — cannot store bank details' },
          503,
        );
      }
    }

    const details = await employeeService.addBankDetails(employeeId, data);
    return c.json({ data: details }, 201);
  },
);

// --- Super Funds ---

payrollRoutes.get('/employees/:id/super', async (c) => {
  const employeeId = c.req.param('id');
  const funds = await employeeService.getSuperFund(employeeId);
  return c.json({ data: funds });
});

payrollRoutes.post('/employees/:id/super', zValidator('json', superFundSchema), async (c) => {
  const employeeId = c.req.param('id');
  const data = c.req.valid('json');
  const funds = await employeeService.addSuperFund(employeeId, data);
  return c.json({ data: funds }, 201);
});

// --- Tax Declaration ---

payrollRoutes.get('/employees/:id/tax-declaration', async (c) => {
  const employeeId = c.req.param('id');
  const decl = await employeeService.getTaxDeclaration(employeeId);
  return c.json(decl ?? { message: 'No tax declaration on file' });
});

payrollRoutes.post(
  '/employees/:id/tax-declaration',
  zValidator('json', taxDeclarationSchema),
  async (c) => {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');
    const decl = await employeeService.submitTaxDeclaration(employeeId, data);
    return c.json(decl, 201);
  },
);

// --- Pay Categories ---

payrollRoutes.get('/pay-categories', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId required' }, 400);

  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0'));
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '50')));

  const page = Math.floor(offset / limit) + 1;
  const result = await payStructureService.listPayCategories(userId, { page, limit });
  return c.json(result);
});

payrollRoutes.post('/pay-categories', zValidator('json', payCategorySchema), async (c) => {
  const data = c.req.valid('json');
  const category = await payStructureService.createPayCategory(data);
  return c.json(category, 201);
});

// --- Pay Structure ---

payrollRoutes.get('/employees/:id/pay-structure', async (c) => {
  const employeeId = c.req.param('id');
  const structure = await payStructureService.getPayStructure(employeeId);
  return c.json({ data: structure });
});

payrollRoutes.post(
  '/employees/:id/pay-structure',
  zValidator('json', payStructureSchema),
  async (c) => {
    const employeeId = c.req.param('id');
    const data = c.req.valid('json');
    const structure = await payStructureService.setPayStructure({
      employeeId,
      ...data,
    });
    return c.json({ data: structure }, 201);
  },
);

export default payrollRoutes;
