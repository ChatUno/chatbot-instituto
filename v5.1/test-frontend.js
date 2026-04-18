// Script para probar el flujo del frontend V5.1
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/screenshot',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const testData = JSON.stringify({
  url: 'https://iesjuandelanuza.catedu.es'
});

console.log('Testing screenshot API...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data.substring(0, 200) + '...');
    
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        if (result.success && result.imageBase64) {
          console.log('Screenshot API working!');
          console.log('Image size:', result.metadata?.sizeBytes || 'unknown');
        } else {
          console.log('Screenshot API failed:', result.error);
        }
      } catch (e) {
        console.log('Invalid JSON response');
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(testData);
req.end();
