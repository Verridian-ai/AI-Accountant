/**
 * Cognify transaction data in Cognee Cloud
 *
 * Builds knowledge graph from uploaded transaction data
 */

import { getCogneeCloudClient } from './client.js';

async function cognifyTransactions() {
  console.log('='.repeat(80));
  console.log('Cognify Transaction Data');
  console.log('='.repeat(80));
  console.log();

  const client = getCogneeCloudClient();

  console.log('Building knowledge graph from transaction data...');
  console.log('This may take several minutes for 6520 transactions.\n');

  try {
    // Get dataset IDs first
    console.log('Fetching dataset IDs...');
    const response = await fetch('https://api.cognee.ai/api/datasets', {
      method: 'GET',
      headers: {
        'X-Api-Key':
          process.env.COGWIT_API_KEY || 'f056b134c9fe54f4adb59bf77b855af01a9ce5081886e3d7',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch datasets: ${response.status}`);
    }

    const datasets = (await response.json()) as Array<{ id: string; name: string }>;

    const bankTransactionsDataset = datasets.find((d) => d.name === 'bank_transactions');
    const merchantMappingsDataset = datasets.find((d) => d.name === 'merchant_mappings');

    if (!bankTransactionsDataset) {
      throw new Error('bank_transactions dataset not found');
    }
    if (!merchantMappingsDataset) {
      throw new Error('merchant_mappings dataset not found');
    }

    console.log(`  ✅ Found bank_transactions: ${bankTransactionsDataset.id}`);
    console.log(`  ✅ Found merchant_mappings: ${merchantMappingsDataset.id}`);
    console.log();

    // Cognify bank_transactions dataset
    console.log('[1/2] Cognifying bank_transactions dataset...');
    const result1 = await client.cognify(undefined, [bankTransactionsDataset.id]);
    console.log('  ✅ Cognify triggered for bank_transactions');
    console.log(`  Response:`, JSON.stringify(result1, null, 2));
    console.log();

    // Cognify merchant_mappings dataset
    console.log('[2/2] Cognifying merchant_mappings dataset...');
    const result2 = await client.cognify(undefined, [merchantMappingsDataset.id]);
    console.log('  ✅ Cognify triggered for merchant_mappings');
    console.log(`  Response:`, JSON.stringify(result2, null, 2));
    console.log();

    console.log('='.repeat(80));
    console.log('COGNIFY COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('Knowledge graph is being built in the background.');
    console.log('This process may take 5-10 minutes for large datasets.');
    console.log();
    console.log('Next step: Test search functionality');
    console.log('  npx tsx src/services/cognee-cloud/test-search.ts');
    console.log();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

cognifyTransactions();
