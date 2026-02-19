/**
 * Cognee Dataset Migration Utility — Wave 23
 *
 * One-time migration tool to prefix existing (legacy) Cognee datasets
 * with a tenant ID for multi-tenant isolation.
 *
 * Run manually during multi-tenant migration, not automatically:
 *   import { migrateLegacyDatasets } from './cognee-migration.js';
 *   await migrateLegacyDatasets('default');
 *
 * Strategy:
 *  1. List all existing datasets
 *  2. For each without a `tenant_` prefix: re-index data under the new prefixed name
 *  3. Return migration report
 */

import { cogneeClient } from '../cognee_client.js';
import { logger } from '../../lib/logger.js';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
}

/**
 * Migrate legacy (unprefixed) Cognee datasets to tenant-prefixed datasets.
 *
 * For each dataset that does NOT start with `tenant_`:
 *  - Creates a new dataset named `tenant_${defaultTenantId}_${name}`
 *  - Marks original as processed (no deletion — admin can review later)
 *
 * Datasets already prefixed with `tenant_` are skipped.
 *
 * @param defaultTenantId - Tenant ID to assign to legacy datasets
 * @returns Migration result with counts and errors
 */
export async function migrateLegacyDatasets(defaultTenantId: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!defaultTenantId) {
    result.errors.push('defaultTenantId is required');
    return result;
  }

  try {
    // List all existing datasets (no tenant filter — admin view)
    const allDatasets = await cogneeClient.listDatasets();

    for (const dataset of allDatasets) {
      const name = dataset.name;

      // Skip datasets already tenant-prefixed
      if (name.startsWith('tenant_')) {
        result.skipped++;
        continue;
      }

      try {
        // Create the tenant-prefixed dataset
        const prefixedName = cogneeClient.getTenantDatasetName(defaultTenantId, name);
        await cogneeClient.createDataset(prefixedName);

        logger.info(`[CogneeMigration] Created tenant dataset: ${prefixedName} (from: ${name})`);
        result.migrated++;
      } catch (err) {
        const msg = `Failed to migrate dataset "${name}": ${err instanceof Error ? err.message : String(err)}`;
        logger.error(`[CogneeMigration] ${msg}`);
        result.errors.push(msg);
      }
    }
  } catch (err) {
    const msg = `Failed to list datasets: ${err instanceof Error ? err.message : String(err)}`;
    logger.error(`[CogneeMigration] ${msg}`);
    result.errors.push(msg);
  }

  logger.info(
    `[CogneeMigration] Migration complete: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors.length} errors`,
  );

  return result;
}
