/**
 * Upload admin transaction data to Cognee Cloud
 *
 * Transforms and uploads:
 * - 6520 transactions to bank_transactions dataset
 * - 2 accounts to financial_insights dataset
 * - 27 merchants to merchant_mappings dataset
 */

import fs from 'fs';
import path from 'path';
import { getCogneeCloudClient } from './client.js';

interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  category?: string;
  gst_amount?: number;
  is_debit: boolean;
  merchant_name?: string;
  created_at: string;
}

interface Account {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  account_type: string;
  bsb?: string;
}

interface Merchant {
  id: string;
  user_id: string;
  original_name: string;
  canonical_name: string;
  category?: string;
  frequency?: number;
}

async function uploadTransactions() {
  console.log('='.repeat(80));
  console.log('Upload Admin Data to Cognee Cloud');
  console.log('='.repeat(80));
  console.log();

  const client = getCogneeCloudClient();

  // Load exported data
  const transactionsPath = path.join(process.cwd(), '..', 'admin-transactions.json');
  const accountsPath = path.join(process.cwd(), '..', 'admin-accounts.json');
  const merchantsPath = path.join(process.cwd(), '..', 'admin-merchants.json');

  const transactions: Transaction[] = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));
  const accounts: Account[] = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  const merchants: Merchant[] = JSON.parse(fs.readFileSync(merchantsPath, 'utf8'));

  console.log(`Loaded:`);
  console.log(`  - ${transactions.length} transactions`);
  console.log(`  - ${accounts.length} accounts`);
  console.log(`  - ${merchants.length} merchants`);
  console.log();

  // Transform transactions to natural language format for Cognee
  console.log('[1/3] Uploading transactions...');

  // Upload in batches of 100
  const batchSize = 100;
  const batches = Math.ceil(transactions.length / batchSize);

  for (let i = 0; i < batches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, transactions.length);
    const batch = transactions.slice(start, end);

    // Convert batch to natural language
    const batchText = batch
      .map((txn) => {
        const amount = (txn.amount / 100).toFixed(2);
        const type = txn.is_debit ? 'debit' : 'credit';
        const gst = txn.gst_amount ? ` (GST: $${(txn.gst_amount / 100).toFixed(2)})` : '';

        return `Transaction on ${txn.date}: ${txn.description} - $${amount} ${type}${gst}. Category: ${txn.category || 'Uncategorized'}. Merchant: ${txn.merchant_name || 'Unknown'}.`;
      })
      .join('\n\n');

    try {
      await client.addData(batchText, 'bank_transactions');
      process.stdout.write(`  Progress: ${end}/${transactions.length} transactions uploaded\r`);
    } catch (error) {
      console.log(
        `\n  ⚠️  Batch ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n  ✅ Uploaded ${transactions.length} transactions\n`);

  // Upload accounts
  console.log('[2/3] Uploading accounts...');
  const accountsText = accounts
    .map((acc) => {
      return `Bank Account: ${acc.account_name} at ${acc.bank_name}. Account type: ${acc.account_type}. BSB: ${acc.bsb || 'N/A'}. Account number: ${acc.account_number}.`;
    })
    .join('\n\n');

  try {
    await client.addData(accountsText, 'bank_transactions');
    console.log(`  ✅ Uploaded ${accounts.length} accounts\n`);
  } catch (error) {
    console.log(`  ⚠️  Failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Upload merchants
  console.log('[3/3] Uploading merchants...');
  const merchantsText = merchants
    .map((merch) => {
      return `Merchant: ${merch.canonical_name} (original: ${merch.original_name}). Category: ${merch.category || 'Unknown'}. Frequency: ${merch.frequency || 0} transactions.`;
    })
    .join('\n\n');

  try {
    await client.addData(merchantsText, 'merchant_mappings');
    console.log(`  ✅ Uploaded ${merchants.length} merchants\n`);
  } catch (error) {
    console.log(`  ⚠️  Failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  console.log('='.repeat(80));
  console.log('UPLOAD COMPLETE');
  console.log('='.repeat(80));
  console.log();
  console.log('Next step: Run cognify to build knowledge graph');
  console.log('  npx tsx src/services/cognee-cloud/cognify-transactions.ts');
  console.log();
}

uploadTransactions().catch(console.error);
