/**
 * Test Cognee Cloud API connection
 */
export {};

const COGNEE_API_KEY = 'f056b134c9fe54f4adb59bf77b855af01a9ce5081886e3d7';
const COGNEE_API_URL = 'https://api.cognee.ai';

async function testConnection() {
  console.log('Testing Cognee Cloud API connection...\n');
  console.log(`API URL: ${COGNEE_API_URL}`);
  console.log(`API Key: ${COGNEE_API_KEY.substring(0, 10)}...`);
  console.log();

  // Test 1: List datasets
  console.log('[Test 1] GET /api/datasets');
  try {
    const response = await fetch(`${COGNEE_API_URL}/api/datasets`, {
      method: 'GET',
      headers: {
        'X-Api-Key': COGNEE_API_KEY,
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.text();
    console.log(`Response: ${data.substring(0, 500)}`);
    console.log();
  } catch (error) {
    console.log(`Error: ${error}`);
    console.log();
  }

  // Test 2: Add data with minimal payload
  console.log('[Test 2] POST /api/add (minimal)');
  try {
    const response = await fetch(`${COGNEE_API_URL}/api/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': COGNEE_API_KEY,
      },
      body: JSON.stringify({
        data: 'Test data',
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.text();
    console.log(`Response: ${data.substring(0, 500)}`);
    console.log();
  } catch (error) {
    console.log(`Error: ${error}`);
    console.log();
  }

  // Test 3: Add data with dataset name
  console.log('[Test 3] POST /api/add (with dataset)');
  try {
    const response = await fetch(`${COGNEE_API_URL}/api/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': COGNEE_API_KEY,
      },
      body: JSON.stringify({
        data: 'Test data for test_dataset',
        dataset_name: 'test_dataset',
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.text();
    console.log(`Response: ${data.substring(0, 500)}`);
    console.log();
  } catch (error) {
    console.log(`Error: ${error}`);
    console.log();
  }

  // Test 4: Search
  console.log('[Test 4] POST /api/search');
  try {
    const response = await fetch(`${COGNEE_API_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': COGNEE_API_KEY,
      },
      body: JSON.stringify({
        query: 'test',
      }),
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.text();
    console.log(`Response: ${data.substring(0, 500)}`);
    console.log();
  } catch (error) {
    console.log(`Error: ${error}`);
    console.log();
  }
}

testConnection().catch(console.error);
