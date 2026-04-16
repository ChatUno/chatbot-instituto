const https = require('https');
const { testCases, spamTest } = require('./test_cases');

class QARunner {
  constructor(baseUrl = 'https://chatbot-instituto-production.up.railway.app') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  async makeRequest(message, testId = null) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const postData = JSON.stringify({ message });

      const options = {
        hostname: 'chatbot-instituto-production.up.railway.app',
        path: '/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const endTime = Date.now();
          const latency = endTime - startTime;

          try {
            const response = JSON.parse(data);
            resolve({
              testId,
              message,
              response: response,
              statusCode: res.statusCode,
              latency,
              timestamp: new Date().toISOString(),
              success: res.statusCode === 200
            });
          } catch (parseError) {
            resolve({
              testId,
              message,
              response: data,
              statusCode: res.statusCode,
              latency,
              timestamp: new Date().toISOString(),
              success: false,
              error: 'JSON_PARSE_ERROR'
            });
          }
        });
      });

      req.on('error', (error) => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        resolve({
          testId,
          message,
          response: null,
          statusCode: 0,
          latency,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        resolve({
          testId,
          message,
          response: null,
          statusCode: 0,
          latency,
          timestamp: new Date().toISOString(),
          success: false,
          error: 'TIMEOUT'
        });
      });

      req.setTimeout(10000);
      req.write(postData);
      req.end();
    });
  }

  async runSequentialTests() {
    console.log('🔄 Running sequential tests...');
    const results = [];

    for (const testCase of testCases) {
      console.log(`📝 Testing: ${testCase.id}`);
      const result = await this.makeRequest(testCase.message, testCase.id);
      results.push({ ...result, testCase });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  async runConcurrentTests() {
    console.log('⚡ Running concurrent tests...');
    const promises = testCases.map(testCase => 
      this.makeRequest(testCase.message, testCase.id)
    );

    const results = await Promise.all(promises);
    return results.map((result, index) => ({ ...result, testCase: testCases[index] }));
  }

  async runSpamTest() {
    console.log('🚀 Running spam test...');
    const promises = [];

    for (let i = 0; i < spamTest.repeat_count; i++) {
      promises.push(
        this.makeRequest(spamTest.message, `${spamTest.id}_${i}`)
      );
    }

    const results = await Promise.all(promises);
    return results.map((result, index) => ({
      ...result,
      testCase: { ...spamTest, id: `${spamTest.id}_${index}` }
    }));
  }

  async runRaceConditionTest() {
    console.log('🏁 Running race condition test...');
    const testMessage = 'qué bachilleratos hay';
    const promises = [];

    for (let i = 0; i < 10; i++) {
      promises.push(
        this.makeRequest(testMessage, `race_${i}`)
      );
    }

    const results = await Promise.all(promises);
    return results.map((result, index) => ({
      ...result,
      testCase: {
        id: `race_${index}`,
        category: 'race_condition',
        message: testMessage,
        expected_keywords: ['bachillerato', 'modalidades'],
        expected_response_type: 'academic_info'
      }
    }));
  }

  async runAllTests() {
    console.log('🚀 Starting QA Test Suite...\n');

    const sequentialResults = await this.runSequentialTests();
    console.log(`✅ Sequential tests completed: ${sequentialResults.length} tests\n`);

    const concurrentResults = await this.runConcurrentTests();
    console.log(`✅ Concurrent tests completed: ${concurrentResults.length} tests\n`);

    const spamResults = await this.runSpamTest();
    console.log(`✅ Spam test completed: ${spamResults.length} tests\n`);

    const raceResults = await this.runRaceConditionTest();
    console.log(`✅ Race condition test completed: ${raceResults.length} tests\n`);

    const allResults = [
      ...sequentialResults,
      ...concurrentResults,
      ...spamResults,
      ...raceResults
    ];

    console.log(`🎯 Total tests executed: ${allResults.length}\n`);

    return allResults;
  }
}

module.exports = QARunner;
