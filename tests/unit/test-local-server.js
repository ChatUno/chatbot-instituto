const https = require('https');

const testMessages = [
  'qué fp hay',
  'horarios',
  'formación profesional'
];

async function testLocalServer() {
  console.log('=== PROBANDO SERVIDOR LOCAL ===\n');
  
  for (let i = 0; i < testMessages.length; i++) {
    const msg = testMessages[i];
    
    const response = await new Promise((resolve) => {
      const postData = JSON.stringify({ message: msg });
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data).response);
          } catch (e) {
            resolve('Parse error');
          }
        });
      });

      req.on('error', () => resolve('Request error'));
      req.write(postData);
      req.end();
    });

    console.log(`${i + 1}. "${msg}"`);
    console.log(`   Response: ${response}`);
    console.log('');
  }
}

testLocalServer();
