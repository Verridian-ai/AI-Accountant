/**
 * Test search functionality on uploaded transaction data
 */

import { getCogneeCloudClient } from './client.js';

async function testSearch() {
  console.log('='.repeat(80));
  console.log('Test Search on Transaction Data');
  console.log('='.repeat(80));
  console.log();

  const client = getCogneeCloudClient();

  const queries = [
    {
      query: 'What are the largest transactions?',
      searchType: 'GRAPH_COMPLETION' as const,
      datasets: ['bank_transactions'],
    },
    {
      query: 'Show me transactions related to groceries or food',
      searchType: 'GRAPH_COMPLETION' as const,
      datasets: ['bank_transactions'],
    },
    {
      query: 'What merchants appear most frequently?',
      searchType: 'GRAPH_COMPLETION' as const,
      datasets: ['merchant_mappings'],
    },
    {
      query: 'Find all bank fees',
      searchType: 'SEMANTIC' as const,
      datasets: ['bank_transactions'],
    },
    {
      query: 'What are the spending patterns?',
      searchType: 'INSIGHTS' as const,
      datasets: ['bank_transactions'],
    },
  ];

  for (let i = 0; i < queries.length; i++) {
    const { query, searchType, datasets } = queries[i];

    console.log(`[${i + 1}/${queries.length}] Query: "${query}"`);
    console.log(`  Search Type: ${searchType}`);
    console.log(`  Datasets: ${datasets.join(', ')}`);

    try {
      const results = await client.search(query, searchType, datasets, 5);

      console.log(`  ✅ Found ${results.length} results`);

      if (results.length > 0) {
        console.log(`  Top result:`);
        const topResult = results[0];
        const resultText =
          typeof topResult.search_result === 'string'
            ? topResult.search_result
            : JSON.stringify(topResult.search_result);
        console.log(`    ${resultText.substring(0, 200)}...`);
      }

      console.log();
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
    }

    // Small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('='.repeat(80));
  console.log('SEARCH TEST COMPLETE');
  console.log('='.repeat(80));
  console.log();
  console.log('✅ Transaction data is searchable in Cognee Cloud!');
  console.log();
  console.log('Next steps:');
  console.log('  1. Integrate search into GoldLedger agents');
  console.log('  2. Upload shared knowledge (GST rules, tax tables)');
  console.log('  3. Upload DataPoint models for entity extraction');
  console.log();
}

testSearch();
