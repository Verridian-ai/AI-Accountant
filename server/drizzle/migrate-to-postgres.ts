/**
 * SQLite to PostgreSQL Migration Script
 *
 * This script migrates data from the SQLite database to PostgreSQL.
 * It handles data type transformations and ensures data integrity
 * for financial data.
 *
 * Usage:
 *   npx tsx server/drizzle/migrate-to-postgres.ts [options]
 *
 * Options:
 *   --dry-run     Preview migration without writing to PostgreSQL
 *   --batch-size  Number of records per batch (default: 1000)
 *   --table       Migrate only a specific table
 */

import { createClient } from '@libsql/client';
import { drizzle as drizzleSQLite } from 'drizzle-orm/libsql';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as readline from 'readline';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface MigrationConfig {
    sqliteUrl: string;
    postgresConfig: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        ssl?: boolean;
    };
    batchSize: number;
    dryRun: boolean;
    specificTable?: string;
}

function getConfig(): MigrationConfig {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
    const tableArg = args.find((a) => a.startsWith('--table='));

    return {
        sqliteUrl: process.env.SQLITE_URL || 'file:sqlite.db',
        postgresConfig: {
            host: process.env.PG_HOST || process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || process.env.DB_PORT || '5432', 10),
            database: process.env.PG_DATABASE || process.env.DB_NAME || 'ai_accountant',
            user: process.env.PG_USER || process.env.DB_USER || 'postgres',
            password: process.env.PG_PASSWORD || process.env.DB_PASSWORD || '',
            ssl: process.env.PG_SSL === 'true' || process.env.DB_SSL === 'true',
        },
        batchSize: batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 1000,
        dryRun,
        specificTable: tableArg ? tableArg.split('=')[1] : undefined,
    };
}

// =============================================================================
// LOGGING
// =============================================================================

const LOG_LEVELS = {
    INFO: '\x1b[36m[INFO]\x1b[0m',
    SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
    PROGRESS: '\x1b[35m[PROGRESS]\x1b[0m',
};

function log(level: keyof typeof LOG_LEVELS, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} ${LOG_LEVELS[level]} ${message}`);
}

function logProgress(current: number, total: number, tableName: string): void {
    const percentage = Math.round((current / total) * 100);
    const bar = '='.repeat(Math.floor(percentage / 2)) + ' '.repeat(50 - Math.floor(percentage / 2));
    process.stdout.write(`\r${LOG_LEVELS.PROGRESS} [${bar}] ${percentage}% - ${tableName}: ${current}/${total}`);
}

// =============================================================================
// DATA TYPE TRANSFORMATIONS
// =============================================================================

/**
 * Transform SQLite boolean (0/1) to PostgreSQL boolean
 */
function transformBoolean(value: unknown): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    return value === 1 || value === '1' || value === 'true';
}

/**
 * Transform SQLite date string to PostgreSQL timestamp
 * Handles both ISO strings and SQLite datetime format
 */
function transformTimestamp(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;

    // Already ISO format
    if (value.includes('T')) {
        return value;
    }

    // SQLite YYYY-MM-DD HH:MM:SS format
    if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        return value.replace(' ', 'T') + 'Z';
    }

    // Date only
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return value + 'T00:00:00Z';
    }

    return value;
}

/**
 * Transform currency values
 * Ensures integers are preserved for cent values
 */
function transformCurrency(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') return Math.round(parseFloat(value));
    return null;
}

/**
 * Escape string for PostgreSQL
 */
function escapeString(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Format value for PostgreSQL INSERT
 */
function formatValue(value: unknown, columnType: string): string {
    if (value === null || value === undefined) {
        return 'NULL';
    }

    switch (columnType) {
        case 'boolean':
            return transformBoolean(value) ? 'TRUE' : 'FALSE';
        case 'integer':
        case 'bigint':
        case 'real':
        case 'numeric':
            if (typeof value === 'number') return value.toString();
            if (typeof value === 'string') return value;
            return 'NULL';
        case 'timestamp':
        case 'timestamptz':
            const ts = transformTimestamp(value);
            return ts ? `'${escapeString(ts)}'` : 'NULL';
        case 'text':
        case 'varchar':
        default:
            return `'${escapeString(String(value))}'`;
    }
}

// =============================================================================
// TABLE DEFINITIONS
// =============================================================================

interface ColumnDef {
    name: string;
    sqliteType: string;
    pgType: string;
}

interface TableDef {
    name: string;
    columns: ColumnDef[];
    dependencies: string[]; // Tables that must be migrated first
}

const TABLES: TableDef[] = [
    {
        name: 'users',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'username', sqliteType: 'text', pgType: 'text' },
            { name: 'password_hash', sqliteType: 'text', pgType: 'text' },
        ],
        dependencies: [],
    },
    {
        name: 'user_settings',
        columns: [
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'model_parsing_text', sqliteType: 'text', pgType: 'text' },
            { name: 'model_parsing_vision', sqliteType: 'text', pgType: 'text' },
            { name: 'model_categorization', sqliteType: 'text', pgType: 'text' },
            { name: 'model_chat', sqliteType: 'text', pgType: 'text' },
            { name: 'model_embedding', sqliteType: 'text', pgType: 'text' },
        ],
        dependencies: ['users'],
    },
    {
        name: 'accounts',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'account_number', sqliteType: 'text', pgType: 'text' },
            { name: 'account_number_hash', sqliteType: 'text', pgType: 'text' },
            { name: 'account_name', sqliteType: 'text', pgType: 'text' },
            { name: 'account_type', sqliteType: 'text', pgType: 'text' },
            { name: 'bank_name', sqliteType: 'text', pgType: 'text' },
            { name: 'current_balance', sqliteType: 'integer', pgType: 'integer' },
            { name: 'last_statement_date', sqliteType: 'text', pgType: 'text' },
            { name: 'interest_rate', sqliteType: 'real', pgType: 'real' },
            { name: 'credit_limit', sqliteType: 'integer', pgType: 'integer' },
            { name: 'minimum_payment', sqliteType: 'integer', pgType: 'integer' },
            { name: 'payment_due_day', sqliteType: 'integer', pgType: 'integer' },
            { name: 'linked_payment_account_id', sqliteType: 'text', pgType: 'text' },
            { name: 'is_active', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
            { name: 'updated_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['users'],
    },
    {
        name: 'statements',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'filename', sqliteType: 'text', pgType: 'text' },
            { name: 'hash', sqliteType: 'text', pgType: 'text' },
            { name: 'upload_date', sqliteType: 'text', pgType: 'timestamptz' },
            { name: 'parsing_status', sqliteType: 'text', pgType: 'text' },
            { name: 'ai_model_used', sqliteType: 'text', pgType: 'text' },
            { name: 'error_message', sqliteType: 'text', pgType: 'text' },
            { name: 'error_type', sqliteType: 'text', pgType: 'text' },
            { name: 'error_details', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'period_start_date', sqliteType: 'text', pgType: 'text' },
            { name: 'period_end_date', sqliteType: 'text', pgType: 'text' },
            { name: 'opening_balance', sqliteType: 'integer', pgType: 'integer' },
            { name: 'closing_balance', sqliteType: 'integer', pgType: 'integer' },
            { name: 'transaction_count', sqliteType: 'integer', pgType: 'integer' },
            { name: 'is_complete', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'validation_errors', sqliteType: 'text', pgType: 'text' },
        ],
        dependencies: ['users'],
    },
    {
        name: 'statement_accounts',
        columns: [
            { name: 'statement_id', sqliteType: 'text', pgType: 'text' },
            { name: 'account_id', sqliteType: 'text', pgType: 'text' },
        ],
        dependencies: ['statements', 'accounts'],
    },
    {
        name: 'transactions',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'date', sqliteType: 'text', pgType: 'text' },
            { name: 'description', sqliteType: 'text', pgType: 'text' },
            { name: 'amount', sqliteType: 'integer', pgType: 'integer' },
            { name: 'balance', sqliteType: 'integer', pgType: 'integer' },
            { name: 'category', sqliteType: 'text', pgType: 'text' },
            { name: 'gst_applicable', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'ai_reasoning_notes', sqliteType: 'text', pgType: 'text' },
            { name: 'confidence_score', sqliteType: 'real', pgType: 'real' },
            { name: 'is_edited', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'is_transfer', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'transfer_link_id', sqliteType: 'text', pgType: 'text' },
            { name: 'merchant_normalized', sqliteType: 'text', pgType: 'text' },
            { name: 'parent_transaction_id', sqliteType: 'text', pgType: 'text' },
            { name: 'statement_id', sqliteType: 'text', pgType: 'text' },
            { name: 'account_id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
        ],
        dependencies: ['statements', 'accounts', 'users'],
    },
    {
        name: 'transaction_history',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'transaction_id', sqliteType: 'text', pgType: 'text' },
            { name: 'change_type', sqliteType: 'text', pgType: 'text' },
            { name: 'old_data', sqliteType: 'text', pgType: 'text' },
            { name: 'new_data', sqliteType: 'text', pgType: 'text' },
            { name: 'timestamp', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['transactions'],
    },
    {
        name: 'transfer_links',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'source_transaction_id', sqliteType: 'text', pgType: 'text' },
            { name: 'destination_transaction_id', sqliteType: 'text', pgType: 'text' },
            { name: 'source_account_id', sqliteType: 'text', pgType: 'text' },
            { name: 'destination_account_id', sqliteType: 'text', pgType: 'text' },
            { name: 'amount', sqliteType: 'integer', pgType: 'integer' },
            { name: 'transfer_date', sqliteType: 'text', pgType: 'text' },
            { name: 'confidence', sqliteType: 'real', pgType: 'real' },
            { name: 'is_user_confirmed', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['users', 'transactions', 'accounts'],
    },
    {
        name: 'user_categories',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'category_name', sqliteType: 'text', pgType: 'text' },
            { name: 'parent_category', sqliteType: 'text', pgType: 'text' },
            { name: 'icon', sqliteType: 'text', pgType: 'text' },
            { name: 'color', sqliteType: 'text', pgType: 'text' },
            { name: 'is_income', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'is_transfer', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'is_hidden', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'sort_order', sqliteType: 'integer', pgType: 'integer' },
        ],
        dependencies: ['users'],
    },
    {
        name: 'merchant_memory',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'merchant_pattern', sqliteType: 'text', pgType: 'text' },
            { name: 'merchant_display_name', sqliteType: 'text', pgType: 'text' },
            { name: 'category', sqliteType: 'text', pgType: 'text' },
            { name: 'gst_applicable', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'times_used', sqliteType: 'integer', pgType: 'integer' },
            { name: 'last_used', sqliteType: 'text', pgType: 'timestamptz' },
            { name: 'is_user_confirmed', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['users'],
    },
    {
        name: 'pending_categorization',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'transaction_id', sqliteType: 'text', pgType: 'text' },
            { name: 'suggested_category', sqliteType: 'text', pgType: 'text' },
            { name: 'suggested_confidence', sqliteType: 'real', pgType: 'real' },
            { name: 'ai_reasoning', sqliteType: 'text', pgType: 'text' },
            { name: 'alternative_categories', sqliteType: 'text', pgType: 'text' },
            { name: 'status', sqliteType: 'text', pgType: 'text' },
            { name: 'user_selected_category', sqliteType: 'text', pgType: 'text' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
            { name: 'resolved_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['users', 'transactions'],
    },
    {
        name: 'reconciliation_alerts',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'account_id', sqliteType: 'text', pgType: 'text' },
            { name: 'alert_type', sqliteType: 'text', pgType: 'text' },
            { name: 'expected_value', sqliteType: 'integer', pgType: 'integer' },
            { name: 'actual_value', sqliteType: 'integer', pgType: 'integer' },
            { name: 'difference', sqliteType: 'integer', pgType: 'integer' },
            { name: 'description', sqliteType: 'text', pgType: 'text' },
            { name: 'statement_id', sqliteType: 'text', pgType: 'text' },
            { name: 'is_resolved', sqliteType: 'integer', pgType: 'boolean' },
            { name: 'resolved_at', sqliteType: 'text', pgType: 'timestamptz' },
            { name: 'resolution_notes', sqliteType: 'text', pgType: 'text' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['users', 'accounts', 'statements'],
    },
    {
        name: 'account_balance_history',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'account_id', sqliteType: 'text', pgType: 'text' },
            { name: 'balance', sqliteType: 'integer', pgType: 'integer' },
            { name: 'balance_date', sqliteType: 'text', pgType: 'text' },
            { name: 'source', sqliteType: 'text', pgType: 'text' },
            { name: 'statement_id', sqliteType: 'text', pgType: 'text' },
            { name: 'notes', sqliteType: 'text', pgType: 'text' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['accounts', 'statements'],
    },
    {
        name: 'debt_payoff_scenarios',
        columns: [
            { name: 'id', sqliteType: 'text', pgType: 'text' },
            { name: 'user_id', sqliteType: 'text', pgType: 'text' },
            { name: 'name', sqliteType: 'text', pgType: 'text' },
            { name: 'strategy', sqliteType: 'text', pgType: 'text' },
            { name: 'accounts_included', sqliteType: 'text', pgType: 'text' },
            { name: 'monthly_budget', sqliteType: 'integer', pgType: 'integer' },
            { name: 'projected_payoff_date', sqliteType: 'text', pgType: 'text' },
            { name: 'total_interest_cost', sqliteType: 'integer', pgType: 'integer' },
            { name: 'total_payments', sqliteType: 'integer', pgType: 'integer' },
            { name: 'monthly_breakdown', sqliteType: 'text', pgType: 'text' },
            { name: 'created_at', sqliteType: 'text', pgType: 'timestamptz' },
            { name: 'updated_at', sqliteType: 'text', pgType: 'timestamptz' },
        ],
        dependencies: ['users'],
    },
];

// =============================================================================
// MIGRATION FUNCTIONS
// =============================================================================

async function migrateTable(
    sqliteDb: ReturnType<typeof drizzleSQLite>,
    pgPool: Pool,
    table: TableDef,
    config: MigrationConfig
): Promise<{ success: boolean; rowCount: number; errors: string[] }> {
    const errors: string[] = [];
    let totalRows = 0;

    try {
        // Count rows in SQLite
        const countResult = await sqliteDb.all(
            sql.raw(`SELECT COUNT(*) as count FROM ${table.name}`)
        );
        const totalCount = (countResult[0] as { count: number }).count;

        if (totalCount === 0) {
            log('INFO', `Table ${table.name}: No rows to migrate`);
            return { success: true, rowCount: 0, errors: [] };
        }

        log('INFO', `Table ${table.name}: Migrating ${totalCount} rows`);

        // Disable foreign key checks temporarily in PostgreSQL
        if (!config.dryRun) {
            await pgPool.query('SET session_replication_role = replica;');
        }

        // Read data in batches
        let offset = 0;
        while (offset < totalCount) {
            const rows = await sqliteDb.all(
                sql.raw(`SELECT * FROM ${table.name} LIMIT ${config.batchSize} OFFSET ${offset}`)
            );

            if (rows.length === 0) break;

            // Build INSERT statement
            const columnNames = table.columns.map((c) => c.name).join(', ');
            const values: string[] = [];

            for (const row of rows) {
                const rowRecord = row as Record<string, unknown>;
                const rowValues = table.columns.map((col) => {
                    const value = rowRecord[col.name];
                    return formatValue(value, col.pgType);
                });
                values.push(`(${rowValues.join(', ')})`);
            }

            const insertSql = `INSERT INTO ${table.name} (${columnNames}) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`;

            if (config.dryRun) {
                log('INFO', `[DRY RUN] Would insert ${rows.length} rows into ${table.name}`);
            } else {
                try {
                    await pgPool.query(insertSql);
                } catch (err) {
                    const errorMsg = `Error inserting batch at offset ${offset}: ${err instanceof Error ? err.message : String(err)}`;
                    errors.push(errorMsg);
                    log('ERROR', errorMsg);
                }
            }

            totalRows += rows.length;
            offset += config.batchSize;
            logProgress(Math.min(offset, totalCount), totalCount, table.name);
        }

        console.log(''); // New line after progress bar

        // Re-enable foreign key checks
        if (!config.dryRun) {
            await pgPool.query('SET session_replication_role = DEFAULT;');
        }

        return { success: errors.length === 0, rowCount: totalRows, errors };
    } catch (err) {
        const errorMsg = `Failed to migrate table ${table.name}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        log('ERROR', errorMsg);
        return { success: false, rowCount: totalRows, errors };
    }
}

function topologicalSort(tables: TableDef[]): TableDef[] {
    const sorted: TableDef[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(tableName: string): void {
        if (visited.has(tableName)) return;
        if (visiting.has(tableName)) {
            throw new Error(`Circular dependency detected involving table: ${tableName}`);
        }

        visiting.add(tableName);
        const table = tables.find((t) => t.name === tableName);
        if (table) {
            for (const dep of table.dependencies) {
                visit(dep);
            }
            visited.add(tableName);
            visiting.delete(tableName);
            sorted.push(table);
        }
    }

    for (const table of tables) {
        visit(table.name);
    }

    return sorted;
}

async function verifyDataIntegrity(
    sqliteDb: ReturnType<typeof drizzleSQLite>,
    pgPool: Pool,
    tables: TableDef[]
): Promise<{ table: string; sqliteCount: number; pgCount: number; match: boolean }[]> {
    const results: { table: string; sqliteCount: number; pgCount: number; match: boolean }[] = [];

    for (const table of tables) {
        const sqliteResult = await sqliteDb.all(
            sql.raw(`SELECT COUNT(*) as count FROM ${table.name}`)
        );
        const sqliteCount = (sqliteResult[0] as { count: number }).count;

        const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${table.name}`);
        const pgCount = parseInt(pgResult.rows[0].count, 10);

        results.push({
            table: table.name,
            sqliteCount,
            pgCount,
            match: sqliteCount === pgCount,
        });
    }

    return results;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    const config = getConfig();

    console.log('\n========================================');
    console.log('  SQLite to PostgreSQL Migration Tool');
    console.log('  AI Accountant - Fintech Application');
    console.log('========================================\n');

    if (config.dryRun) {
        log('WARN', 'Running in DRY RUN mode - no data will be written to PostgreSQL');
    }

    log('INFO', `SQLite source: ${config.sqliteUrl}`);
    log('INFO', `PostgreSQL target: ${config.postgresConfig.host}:${config.postgresConfig.port}/${config.postgresConfig.database}`);
    log('INFO', `Batch size: ${config.batchSize}`);

    // Initialize connections
    log('INFO', 'Connecting to SQLite...');
    const sqliteClient = createClient({ url: config.sqliteUrl });
    const sqliteDb = drizzleSQLite(sqliteClient);

    log('INFO', 'Connecting to PostgreSQL...');
    const pgPool = new Pool({
        host: config.postgresConfig.host,
        port: config.postgresConfig.port,
        database: config.postgresConfig.database,
        user: config.postgresConfig.user,
        password: config.postgresConfig.password,
        ssl: config.postgresConfig.ssl ? { rejectUnauthorized: false } : undefined,
    });

    // Test connections
    try {
        await sqliteDb.all(sql.raw('SELECT 1'));
        log('SUCCESS', 'SQLite connection successful');
    } catch (err) {
        log('ERROR', `SQLite connection failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    try {
        await pgPool.query('SELECT 1');
        log('SUCCESS', 'PostgreSQL connection successful');
    } catch (err) {
        log('ERROR', `PostgreSQL connection failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    // Sort tables by dependencies
    const sortedTables = topologicalSort(TABLES);
    const tablesToMigrate = config.specificTable
        ? sortedTables.filter((t) => t.name === config.specificTable)
        : sortedTables;

    if (tablesToMigrate.length === 0) {
        log('ERROR', `Table not found: ${config.specificTable}`);
        process.exit(1);
    }

    log('INFO', `Tables to migrate: ${tablesToMigrate.map((t) => t.name).join(', ')}`);

    // Confirmation prompt
    if (!config.dryRun) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
            rl.question('\nThis will migrate data to PostgreSQL. Continue? (yes/no): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'yes') {
            log('INFO', 'Migration cancelled');
            process.exit(0);
        }
    }

    console.log('\n--- Starting Migration ---\n');

    // Migrate each table
    const migrationResults: { table: string; success: boolean; rowCount: number; errors: string[] }[] = [];

    for (const table of tablesToMigrate) {
        const result = await migrateTable(sqliteDb, pgPool, table, config);
        migrationResults.push({ table: table.name, ...result });
    }

    // Summary
    console.log('\n--- Migration Summary ---\n');

    let totalRows = 0;
    let failedTables = 0;

    for (const result of migrationResults) {
        const status = result.success ? LOG_LEVELS.SUCCESS : LOG_LEVELS.ERROR;
        console.log(`${status} ${result.table}: ${result.rowCount} rows migrated`);
        totalRows += result.rowCount;
        if (!result.success) failedTables++;
    }

    console.log(`\nTotal rows migrated: ${totalRows}`);
    console.log(`Failed tables: ${failedTables}`);

    // Verify data integrity
    if (!config.dryRun) {
        console.log('\n--- Data Integrity Check ---\n');
        const integrityResults = await verifyDataIntegrity(sqliteDb, pgPool, tablesToMigrate);

        for (const result of integrityResults) {
            const status = result.match ? LOG_LEVELS.SUCCESS : LOG_LEVELS.WARN;
            console.log(
                `${status} ${result.table}: SQLite=${result.sqliteCount}, PostgreSQL=${result.pgCount} ${result.match ? '(match)' : '(MISMATCH)'}`
            );
        }
    }

    // Cleanup
    await pgPool.end();

    console.log('\n--- Migration Complete ---\n');
    process.exit(failedTables > 0 ? 1 : 0);
}

main().catch((err) => {
    log('ERROR', `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
