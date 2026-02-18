#!/usr/bin/env node
/**
 * Test login API endpoint
 */

async function testLogin() {
  try {
    const response = await fetch('http://localhost:3501/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123',
      }),
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Raw response:', text);

    try {
      const data = JSON.parse(text);
      console.log('Parsed:', JSON.stringify(data, null, 2));

      if (response.ok) {
        console.log('\n✅ Login successful!');
        console.log('Token:', data.token?.substring(0, 50) + '...');
      } else {
        console.log('\n❌ Login failed');
      }
    } catch (e) {
      console.log('Response is not JSON');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogin();

