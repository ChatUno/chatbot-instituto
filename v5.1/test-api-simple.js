// Simple API test to debug routing issues
const http = require('http');

function testAPI(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      console.log(`\n=== ${method} ${path} ===`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response length: ${responseData.length}`);
        console.log(`Response preview: ${responseData.substring(0, 200)}...`);
        
        if (responseData.startsWith('<!DOCTYPE')) {
          console.log('ERROR: Got HTML instead of JSON - routing issue!');
          resolve({ success: false, error: 'Routing issue - got HTML' });
        } else {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            console.log('ERROR: Invalid JSON response');
            resolve({ success: false, error: 'Invalid JSON', raw: responseData });
          }
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('=== V5.1 API Routing Debug ===\n');
  
  try {
    // Test 1: Root path
    await testAPI('/');
    
    // Test 2: API status
    await testAPI('/api/export/status');
    
    // Test 3: API backups
    await testAPI('/api/export/backups');
    
    // Test 4: Screenshot (should work)
    await testAPI('/api/screenshot', 'POST', { url: 'https://example.com' });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();
