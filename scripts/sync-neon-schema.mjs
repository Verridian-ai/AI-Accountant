#!/usr/bin/env node
/**
 * Comprehensive Neon Cloud Schema Sync
 * 
 * This script ensures Neon Cloud PostgreSQL has ALL tables and columns
 * that the application expects based on the Drizzle schema definitions.
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Client } = pg;
const NEON_URL = 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

async function syncSchema() {
  const client = new Client({ connectionString: NEON_URL });
  
  try {
    await client.connect();
    console.log('✓ Connected to Neon Cloud\n');
    console.log('='.repeat(80));
    console.log('COMPREHENSIVE SCHEMA SYNC');
    console.log('='.repeat(80));
    console.log();

    // Add missing columns to existing tables
    const migrations = [
      // Multi-tenant tables - add missing columns
      {
        table: 'role_permissions',
        column: 'granted_by',
        sql: 'ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS granted_by TEXT REFERENCES users(id)',
      },
      {
        table: 'role_permissions',
        column: 'tenant_id',
        sql: 'ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE',
      },
      
      // Transactions table - add tenant_id
      {
        table: 'transactions',
        column: 'tenant_id',
        sql: 'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Accounts table - add tenant_id
      {
        table: 'accounts',
        column: 'tenant_id',
        sql: 'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Merchant memory - add tenant_id
      {
        table: 'merchant_memory',
        column: 'tenant_id',
        sql: 'ALTER TABLE merchant_memory ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // User categories - add tenant_id
      {
        table: 'user_categories',
        column: 'tenant_id',
        sql: 'ALTER TABLE user_categories ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // BAS periods - add tenant_id
      {
        table: 'bas_periods',
        column: 'tenant_id',
        sql: 'ALTER TABLE bas_periods ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Tax returns - add tenant_id
      {
        table: 'tax_returns',
        column: 'tenant_id',
        sql: 'ALTER TABLE tax_returns ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Budgets - add tenant_id
      {
        table: 'budgets',
        column: 'tenant_id',
        sql: 'ALTER TABLE budgets ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Reports - add tenant_id
      {
        table: 'reports',
        column: 'tenant_id',
        sql: 'ALTER TABLE reports ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Suppliers - add tenant_id
      {
        table: 'suppliers',
        column: 'tenant_id',
        sql: 'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Bills - add tenant_id
      {
        table: 'bills',
        column: 'tenant_id',
        sql: 'ALTER TABLE bills ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Employees - add tenant_id
      {
        table: 'employees',
        column: 'tenant_id',
        sql: 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Payroll runs - add tenant_id
      {
        table: 'payroll_runs',
        column: 'tenant_id',
        sql: 'ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Invoices - add tenant_id
      {
        table: 'invoices',
        column: 'tenant_id',
        sql: 'ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },
      
      // Customers - add tenant_id
      {
        table: 'customers',
        column: 'tenant_id',
        sql: 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES tenants(id)',
      },

      // Subscription history - add missing columns
      {
        table: 'subscription_history',
        column: 'billing_cycle',
        sql: 'ALTER TABLE subscription_history ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT \'monthly\'',
      },
      {
        table: 'subscription_history',
        column: 'current_period_start',
        sql: 'ALTER TABLE subscription_history ADD COLUMN IF NOT EXISTS current_period_start TEXT',
      },
      {
        table: 'subscription_history',
        column: 'current_period_end',
        sql: 'ALTER TABLE subscription_history ADD COLUMN IF NOT EXISTS current_period_end TEXT',
      },
      {
        table: 'subscription_history',
        column: 'cancel_at_period_end',
        sql: 'ALTER TABLE subscription_history ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false',
      },
      {
        table: 'subscription_history',
        column: 'cancelled_at',
        sql: 'ALTER TABLE subscription_history ADD COLUMN IF NOT EXISTS cancelled_at TEXT',
      },
      {
        table: 'subscription_history',
        column: 'trial_end',
        sql: 'ALTER TABLE subscription_history ADD COLUMN IF NOT EXISTS trial_end TEXT',
      },
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const migration of migrations) {
      try {
        await client.query(migration.sql);
        console.log(`✅ ${migration.table}.${migration.column}`);
        successCount++;
      } catch (err) {
        if (err.code === '42701') {
          // Column already exists
          console.log(`⏭️  ${migration.table}.${migration.column} (already exists)`);
          skipCount++;
        } else if (err.code === '42P01') {
          // Table doesn't exist
          console.log(`⚠️  ${migration.table}.${migration.column} (table not found)`);
          skipCount++;
        } else {
          console.log(`❌ ${migration.table}.${migration.column}: ${err.message}`);
          errorCount++;
        }
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Added: ${successCount} columns`);
    console.log(`⏭️  Skipped: ${skipCount} (already exist or table missing)`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log();

    if (errorCount === 0) {
      console.log('🎉 Schema sync complete!');
    } else {
      console.log('⚠️  Some migrations failed. Review errors above.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

syncSchema();

