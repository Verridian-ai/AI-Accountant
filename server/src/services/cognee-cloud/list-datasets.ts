/**
 * List all datasets in Cognee Cloud
 */
export {};

const COGNEE_API_KEY = 'f056b134c9fe54f4adb59bf77b855af01a9ce5081886e3d7';
const COGNEE_API_URL = 'https://api.cognee.ai';

interface Dataset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string | null;
  ownerId: string;
}

async function listDatasets() {
  console.log('Fetching datasets from Cognee Cloud...\n');

  try {
    const response = await fetch(`${COGNEE_API_URL}/api/datasets`, {
      method: 'GET',
      headers: {
        'X-Api-Key': COGNEE_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const datasets = (await response.json()) as Dataset[];

    console.log(`Found ${datasets.length} datasets:\n`);
    console.log('='.repeat(80));

    for (const dataset of datasets) {
      console.log(`Name: ${dataset.name}`);
      console.log(`  ID: ${dataset.id}`);
      console.log(`  Created: ${new Date(dataset.createdAt).toLocaleString()}`);
      console.log(
        `  Updated: ${dataset.updatedAt ? new Date(dataset.updatedAt).toLocaleString() : 'Never'}`,
      );
      console.log();
    }

    console.log('='.repeat(80));
    console.log(`Total: ${datasets.length} datasets`);
  } catch (error) {
    console.error('Error:', error);
  }
}

listDatasets();
