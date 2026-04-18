// Script para probar el API de extract
const http = require('http');

// Primero necesitamos una imagen de prueba
const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/extract',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const testData = JSON.stringify({
  imageBase64: testImageBase64
});

console.log('Testing extract API...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data);
    
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        if (result.success) {
          console.log('Extract API working!');
          console.log('Text length:', result.data?.text?.length || 0);
          console.log('Links found:', result.data?.links?.length || 0);
        } else {
          console.log('Extract API failed:', result.error);
        }
      } catch (e) {
        console.log('Invalid JSON response:', e.message);
      }
    } else {
      console.log('HTTP Error:', res.statusCode);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(testData);
req.end();
