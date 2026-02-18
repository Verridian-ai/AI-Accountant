import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './core.js';

// ============================================================================
// EMPLOYEE MANAGEMENT (Wave 4)
// ============================================================================

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  dateOfBirth: text('date_of_birth'),
  address: text('address'), // JSON
  taxFileNumber: text('tax_file_number'), // AES-256-GCM encrypted
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull().default('active'),
  employmentType: text('employment_type').notNull().default('full_time'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeBankDetails = sqliteTable('employee_bank_details', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  bsb: text('bsb').notNull(), // AES-256-GCM encrypted
  accountNumber: text('account_number').notNull(), // AES-256-GCM encrypted
  accountName: text('account_name').notNull(),
  splitPercentage: real('split_percentage').notNull().default(100.0),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeSuperFunds = sqliteTable('employee_super_funds', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  fundName: text('fund_name').notNull(),
  fundABN: text('fund_abn'),
  usi: text('usi'),
  memberNumber: text('member_number'),
  contributionRate: real('contribution_rate').notNull().default(11.5),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeTaxDeclarations = sqliteTable('employee_tax_declarations', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  taxFreeThreshold: integer('tax_free_threshold', { mode: 'boolean' }).default(true),
  helpDebt: integer('help_debt', { mode: 'boolean' }).default(false),
  sfssDebt: integer('sfss_debt', { mode: 'boolean' }).default(false),
  claimDependents: integer('claim_dependents').default(0),
  taxOffsetEstimated: integer('tax_offset_estimated').default(0),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const payCategories = sqliteTable('pay_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rateType: text('rate_type').notNull().default('hourly'),
  defaultRate: integer('default_rate').default(0),
  multiplier: real('multiplier').default(1.0),
  isTaxable: integer('is_taxable', { mode: 'boolean' }).default(true),
  isSuperBearing: integer('is_super_bearing', { mode: 'boolean' }).default(true),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const payStructures = sqliteTable('pay_structures', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  payCategoryId: text('pay_category_id')
    .notNull()
    .references(() => payCategories.id),
  rate: integer('rate').notNull(),
  hoursPerWeek: real('hours_per_week'),
  annualSalary: integer('annual_salary'),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeDocuments = sqliteTable('employee_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  uploadedAt: text('uploaded_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Type exports
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type EmployeeBankDetail = typeof employeeBankDetails.$inferSelect;
export type NewEmployeeBankDetail = typeof employeeBankDetails.$inferInsert;
export type EmployeeSuperFund = typeof employeeSuperFunds.$inferSelect;
export type NewEmployeeSuperFund = typeof employeeSuperFunds.$inferInsert;
export type EmployeeTaxDeclaration = typeof employeeTaxDeclarations.$inferSelect;
export type NewEmployeeTaxDeclaration = typeof employeeTaxDeclarations.$inferInsert;
export type PayCategory = typeof payCategories.$inferSelect;
export type NewPayCategory = typeof payCategories.$inferInsert;
export type PayStructure = typeof payStructures.$inferSelect;
export type NewPayStructure = typeof payStructures.$inferInsert;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type NewEmployeeDocument = typeof employeeDocuments.$inferInsert;
