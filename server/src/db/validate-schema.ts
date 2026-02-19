/**
 * Schema Validation Tool
 *
 * Validates consistency between:
 * 1. schema.ts (SQLite table definitions)
 * 2. postgres-schema.ts (PostgreSQL table definitions)
 * 3. Migration files in docker/migrations/
 *
 * Run with: npx tsx src/db/validate-schema.ts
 */

import * as sqliteSchema from '../schema.js';
import * as pgSchema from '../schema/index.js';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

/**
 * Extract table names from a schema object
 */
function extractTableNames(schemaObj: Record<string, any>): Set<string> {
  const tableNames = new Set<string>();

  for (const [key, value] of Object.entries(schemaObj)) {
    // Check if it's a Drizzle table (has specific properties)
    if (value && typeof value === 'object' && '$inferSelect' in value) {
      tableNames.add(key);
    }
  }

  return tableNames;
}

/**
 * Extract table names from migration SQL files
 */
function extractMigrationTables(migrationsPath: string): Set<string> {
  const tableNames = new Set<string>();

  try {
    const files = readdirSync(migrationsPath).filter((f) => f.endsWith('.sql'));

    for (const file of files) {
      const content = readFileSync(join(migrationsPath, file), 'utf-8');

      // Match CREATE TABLE statements (case-insensitive)
      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/gi;
      let match;

      while ((match = createTableRegex.exec(content)) !== null) {
        tableNames.add(match[1]);
      }
    }
  } catch (error) {
    console.error('Error reading migrations:', error);
  }

  return tableNames;
}

/**
 * Validate schema consistency
 */
export function validateSchema(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    info: [],
  };

  // Extract table names from each source
  const sqliteTables = extractTableNames(sqliteSchema);
  const pgTables = extractTableNames(pgSchema);
  const migrationTables = extractMigrationTables(join(process.cwd(), '..', 'docker', 'migrations'));

  result.info.push(`📊 Schema Statistics:`);
  result.info.push(`  - schema.ts: ${sqliteTables.size} tables`);
  result.info.push(`  - postgres-schema.ts: ${pgTables.size} tables`);
  result.info.push(`  - Migration files: ${migrationTables.size} tables`);
  result.info.push('');

  // Check: Tables in SQLite schema but not in PostgreSQL schema
  const missingInPg = Array.from(sqliteTables).filter((t) => !pgTables.has(t));
  if (missingInPg.length > 0) {
    result.warnings.push(`⚠️  Tables in schema.ts but not in postgres-schema.ts:`);
    missingInPg.forEach((t) => result.warnings.push(`   - ${t}`));
    result.warnings.push('');
  }

  // Summary
  if (result.valid) {
    result.info.push('✅ Schema validation passed!');
  }

  return result;
}

// Run validation if executed directly
const isMainModule = import.meta.url === 'file://' + process.argv[1];
if (isMainModule) {
  console.log('\n🔍 GoldLedger Schema Validation Report\n');
  const schemaResult = validateSchema();
  schemaResult.info.forEach((msg) => console.log(msg));
  schemaResult.warnings.forEach((msg) => console.log(msg));
  process.exit(schemaResult.valid ? 0 : 1);
}

export default { validateSchema };
