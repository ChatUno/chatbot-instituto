const http = require('http');

function testRequest(testName, testData) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(testData);

    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/chunk',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== ${testName} ===`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const response = JSON.parse(data);
          console.log('Success:', response.success);
          console.log('Error:', response.error);
        } catch (e) {
          console.log('Response:', data);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== CHECK 5 - Validations ===');
  
  // Test 1: Missing text field
  await testRequest('Missing text field', {
    sourceUrl: "https://iesjuandelanuza.catedu.es/"
  });
  
  // Test 2: Missing sourceUrl field
  await testRequest('Missing sourceUrl field', {
    text: "Este es un texto de prueba con suficientes palabras para verificar el sistema de chunking semántico. El texto debe ser lo suficientemente largo para que el sistema pueda procesarlo adecuadamente y generar chunks significativos."
  });
  
  // Test 3: Text too short
  await testRequest('Text too short', {
    text: "Texto corto",
    sourceUrl: "https://iesjuandelanuza.catedu.es/"
  });
  
  console.log('\n=== Validation tests completed ===');
}

runTests();
