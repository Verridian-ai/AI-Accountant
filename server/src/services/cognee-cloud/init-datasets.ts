/**
 * Initialize all datasets in Cognee Cloud.
 *
 * Creates all 39 datasets (6 shared + 33 tenant) in Cognee Cloud Premium.
 * Run this script once to set up the knowledge graph infrastructure.
 *
 * Usage:
 *   npx tsx src/services/cognee-cloud/init-datasets.ts
 */

import { getCogneeCloudClient } from './client.js';
import { getSharedDatasets, getTenantDatasets, type DatasetDefinition } from './datasets.js';

async function createDataset(datasetDef: DatasetDefinition, retries = 3): Promise<boolean> {
  const client = getCogneeCloudClient();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Creating dataset: ${datasetDef.name} (attempt ${attempt}/${retries})`);
      console.log(`  Description: ${datasetDef.description}`);
      console.log(`  Category: ${datasetDef.category}`);
      console.log(`  Public: ${datasetDef.isPublic}`);

      // Add a placeholder document to create the dataset
      const result = await client.addData(
        `# ${datasetDef.name}\n\n${datasetDef.description}\n\nThis is a placeholder document to initialize the dataset.`,
        datasetDef.name,
      );

      console.log(`  ✅ Created: ${result.dataset_id}`);
      console.log(`  Status: ${result.status}`);
      console.log();

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (attempt < retries && errorMsg.includes('Could not refresh instance')) {
        console.log(`  ⚠️  Retry ${attempt}/${retries}: ${errorMsg}`);
        // Wait 2 seconds before retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      console.log(`  ❌ Error: ${errorMsg}`);
      console.log();
      return false;
    }
  }

  return false;
}

async function createAllDatasets(): Promise<number> {
  console.log('='.repeat(80));
  console.log('Cognee Cloud Dataset Initialization');
  console.log('='.repeat(80));
  console.log();

  const sharedDatasets = getSharedDatasets();
  const tenantDatasets = getTenantDatasets();

  console.log(`📊 Total datasets to create: ${sharedDatasets.length + tenantDatasets.length}`);
  console.log(`   - Shared (public): ${sharedDatasets.length}`);
  console.log(`   - Per-tenant: ${tenantDatasets.length}`);
  console.log();

  // Create shared datasets
  console.log('='.repeat(80));
  console.log('SHARED DATASETS (Public Knowledge)');
  console.log('='.repeat(80));
  console.log();

  let sharedSuccess = 0;
  for (const dataset of sharedDatasets) {
    if (await createDataset(dataset)) {
      sharedSuccess++;
    }
    // Small delay between datasets to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`✅ Shared datasets created: ${sharedSuccess}/${sharedDatasets.length}`);
  console.log();

  // Create tenant datasets
  console.log('='.repeat(80));
  console.log('TENANT DATASETS (Per-User Financial Data)');
  console.log('='.repeat(80));
  console.log();

  let tenantSuccess = 0;
  for (const dataset of tenantDatasets) {
    if (await createDataset(dataset)) {
      tenantSuccess++;
    }
    // Small delay between datasets to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`✅ Tenant datasets created: ${tenantSuccess}/${tenantDatasets.length}`);
  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(
    `Total datasets created: ${sharedSuccess + tenantSuccess}/${sharedDatasets.length + tenantDatasets.length}`,
  );
  console.log();

  if (sharedSuccess + tenantSuccess === sharedDatasets.length + tenantDatasets.length) {
    console.log('🎉 All datasets created successfully!');
    return 0;
  } else {
    console.log('⚠️  Some datasets failed to create. Check errors above.');
    return 1;
  }
}

async function testConnection(): Promise<boolean> {
  console.log('Testing connection to Cognee Cloud...');
  console.log();

  try {
    const client = getCogneeCloudClient();

    // Try a simple add operation
    const result = await client.addData('Test connection to Cognee Cloud', 'test_connection');

    console.log('✅ Connection successful!');
    console.log(`   Dataset ID: ${result.dataset_id}`);
    console.log(`   Status: ${result.status}`);
    console.log();

    return true;
  } catch (error) {
    console.log(`❌ Connection failed: ${error instanceof Error ? error.message : String(error)}`);
    console.log();
    return false;
  }
}

async function main(): Promise<number> {
  // Test connection first
  if (!(await testConnection())) {
    console.log('❌ Cannot connect to Cognee Cloud. Check your API key.');
    return 1;
  }

  // Create all datasets
  return await createAllDatasets();
}

// Run if executed directly
main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { main, testConnection, createAllDatasets };
