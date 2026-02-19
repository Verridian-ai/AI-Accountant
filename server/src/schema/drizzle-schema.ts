/**
 * Drizzle-kit schema entry point — tables only, no DB connection.
 * Used by drizzle.config.postgres.ts for push/generate/migrate.
 */
export * from './core';
export * from './banking';
export * from './transactions';
export * from './tax';
export * from './accounting';
export * from './teams';
export * from './cognee';
export * from './agents';
export * from './multitenant';
export * from './reporting';
export * from './analytics';
export * from './documents';
export * from './payables';
export * from './pwa';
export * from './invoicing';
export * from './payroll';
export * from './ui';
