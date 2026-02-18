import { pgTable, text, integer, real, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './core.js';

// =============================================================================
// EMPLOYEE MANAGEMENT (Wave 4)
// =============================================================================

export const pgEmployees = pgTable(
  'employees',
  {
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userStatusIdx: index('idx_employees_user_status').on(table.userId, table.status),
    userNameIdx: index('idx_employees_user_name').on(table.userId, table.lastName, table.firstName),
  }),
);

export const pgEmployeeBankDetails = pgTable(
  'employee_bank_details',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => pgEmployees.id, { onDelete: 'cascade' }),
    bsb: text('bsb').notNull(), // AES-256-GCM encrypted
    accountNumber: text('account_number').notNull(), // AES-256-GCM encrypted
    accountName: text('account_name').notNull(),
    splitPercentage: real('split_percentage').notNull().default(100.0),
    isPrimary: boolean('is_primary').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeIdx: index('idx_employee_bank_details_employee').on(table.employeeId),
  }),
);

export const pgEmployeeSuperFunds = pgTable(
  'employee_super_funds',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => pgEmployees.id, { onDelete: 'cascade' }),
    fundName: text('fund_name').notNull(),
    fundABN: text('fund_abn'),
    usi: text('usi'),
    memberNumber: text('member_number'),
    contributionRate: real('contribution_rate').notNull().default(11.5),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeIdx: index('idx_employee_super_funds_employee').on(table.employeeId),
  }),
);

export const pgEmployeeTaxDeclarations = pgTable(
  'employee_tax_declarations',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => pgEmployees.id, { onDelete: 'cascade' }),
    taxFreeThreshold: boolean('tax_free_threshold').default(true),
    helpDebt: boolean('help_debt').default(false),
    sfssDebt: boolean('sfss_debt').default(false),
    claimDependents: integer('claim_dependents').default(0),
    taxOffsetEstimated: integer('tax_offset_estimated').default(0),
    effectiveDate: text('effective_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeDateIdx: index('idx_employee_tax_declarations_employee_date').on(
      table.employeeId,
      table.effectiveDate,
    ),
  }),
);

export const pgPayCategories = pgTable(
  'pay_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    rateType: text('rate_type').notNull().default('hourly'),
    defaultRate: integer('default_rate').default(0),
    multiplier: real('multiplier').default(1.0),
    isTaxable: boolean('is_taxable').default(true),
    isSuperBearing: boolean('is_super_bearing').default(true),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userTypeIdx: index('idx_pay_categories_user_type').on(table.userId, table.type),
    userActiveIdx: index('idx_pay_categories_user_active').on(table.userId, table.isActive),
  }),
);

export const pgPayStructures = pgTable(
  'pay_structures',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => pgEmployees.id, { onDelete: 'cascade' }),
    payCategoryId: text('pay_category_id')
      .notNull()
      .references(() => pgPayCategories.id),
    rate: integer('rate').notNull(),
    hoursPerWeek: real('hours_per_week'),
    annualSalary: integer('annual_salary'),
    effectiveDate: text('effective_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeDateIdx: index('idx_pay_structures_employee_date').on(
      table.employeeId,
      table.effectiveDate,
    ),
    payCategoryIdx: index('idx_pay_structures_pay_category').on(table.payCategoryId),
  }),
);

export const pgEmployeeDocuments = pgTable(
  'employee_documents',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => pgEmployees.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeTypeIdx: index('idx_employee_documents_employee_type').on(
      table.employeeId,
      table.documentType,
    ),
  }),
);

export type PgEmployee = typeof pgEmployees.$inferSelect;
export type NewPgEmployee = typeof pgEmployees.$inferInsert;
export type PgEmployeeBankDetail = typeof pgEmployeeBankDetails.$inferSelect;
export type NewPgEmployeeBankDetail = typeof pgEmployeeBankDetails.$inferInsert;
export type PgEmployeeSuperFund = typeof pgEmployeeSuperFunds.$inferSelect;
export type NewPgEmployeeSuperFund = typeof pgEmployeeSuperFunds.$inferInsert;
export type PgEmployeeTaxDeclaration = typeof pgEmployeeTaxDeclarations.$inferSelect;
export type NewPgEmployeeTaxDeclaration = typeof pgEmployeeTaxDeclarations.$inferInsert;
export type PgPayCategory = typeof pgPayCategories.$inferSelect;
export type NewPgPayCategory = typeof pgPayCategories.$inferInsert;
export type PgPayStructure = typeof pgPayStructures.$inferSelect;
export type NewPgPayStructure = typeof pgPayStructures.$inferInsert;
export type PgEmployeeDocument = typeof pgEmployeeDocuments.$inferSelect;
export type NewPgEmployeeDocument = typeof pgEmployeeDocuments.$inferInsert;
