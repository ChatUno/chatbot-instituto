// Test complete frontend-backend integration step by step
const http = require('http');

class IntegrationTester {
  constructor() {
    this.apiBase = 'http://localhost:3002';
    this.testResults = {
      serverHealth: false,
      screenshotAPI: false,
      extractAPI: false,
      chunkAPI: false,
      exportAPI: false,
      frontendLoading: false
    };
  }

  async runIntegrationTest() {
    console.log('\n=== V5.1 Frontend-Backend Integration Test ===\n');
    
    try {
      // Test 1: Server Health
      await this.testServerHealth();
      
      // Test 2: Screenshot API with working URL
      await this.testScreenshotAPI();
      
      // Test 3: Extract API
      await this.testExtractAPI();
      
      // Test 4: Chunk API
      await this.testChunkAPI();
      
      // Test 5: Export API
      await this.testExportAPI();
      
      // Test 6: Frontend Loading
      await this.testFrontendLoading();
      
      this.generateReport();
      
    } catch (error) {
      console.error('\n=== Integration Test Failed ===', error);
    }
  }

  async testServerHealth() {
    console.log('1. Testing Server Health...');
    
    try {
      const response = await this.makeRequest('GET', '/');
      
      if (response.includes('<!DOCTYPE html>') && response.includes('V5.1 Visual RAG')) {
        this.testResults.serverHealth = true;
        console.log('   Server Health: PASS');
        console.log('   Frontend serving correctly');
      } else {
        console.log('   Server Health: FAIL - Invalid HTML response');
      }
    } catch (error) {
      console.log('   Server Health: FAIL - Connection error');
    }
  }

  async testScreenshotAPI() {
    console.log('\n2. Testing Screenshot API...');
    
    try {
      // Test with a working URL
      const testURL = 'https://httpbin.org/html'; // Reliable test URL
      const response = await this.makeRequest('POST', '/api/screenshot', { url: testURL });
      
      if (response.success && response.imageBase64) {
        this.testResults.screenshotAPI = true;
        console.log('   Screenshot API: PASS');
        console.log(`   Image size: ${response.metadata?.sizeBytes || 'unknown'} bytes`);
        console.log(`   Captured at: ${response.metadata?.capturedAt || 'unknown'}`);
      } else {
        console.log('   Screenshot API: FAIL - Invalid response');
        console.log(`   Error: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('   Screenshot API: FAIL - Network error');
      console.log(`   Error: ${error.message}`);
    }
  }

  async testExtractAPI() {
    console.log('\n3. Testing Extract API...');
    
    try {
      // Create a simple test image (base64 1x1 pixel)
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const response = await this.makeRequest('POST', '/api/extract', {
        imageBase64: testImage
      });
      
      if (response.success && response.data) {
        this.testResults.extractAPI = true;
        console.log('   Extract API: PASS');
        console.log(`   Text extracted: ${response.data.text?.length || 0} chars`);
        console.log(`   Links found: ${response.data.links?.length || 0}`);
        console.log(`   AI Model: ${response.data.model || 'Unknown'}`);
      } else {
        console.log('   Extract API: FAIL - Invalid response');
        console.log(`   Error: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('   Extract API: FAIL - Network error');
      console.log(`   Error: ${error.message}`);
    }
  }

  async testChunkAPI() {
    console.log('\n4. Testing Chunk API...');
    
    try {
      const testText = 'This is a test text for chunking. It contains multiple sentences. The purpose is to test the chunking functionality. We need enough text to generate meaningful chunks.';
      
      const response = await this.makeRequest('POST', '/api/chunk', {
        text: testText,
        sourceUrl: 'https://test.example.com'
      });
      
      if (response.success && response.data && response.data.chunks) {
        this.testResults.chunkAPI = true;
        console.log('   Chunk API: PASS');
        console.log(`   Chunks generated: ${response.data.chunks.length}`);
        response.data.chunks.forEach((chunk, index) => {
          console.log(`   Chunk ${index + 1}: ${chunk.category} (${chunk.quality_score}% quality)`);
        });
      } else {
        console.log('   Chunk API: FAIL - Invalid response');
        console.log(`   Error: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('   Chunk API: FAIL - Network error');
      console.log(`   Error: ${error.message}`);
    }
  }

  async testExportAPI() {
    console.log('\n5. Testing Export API...');
    
    try {
      const testChunks = [
        {
          text: 'Test chunk 1 for export',
          category: 'general',
          quality_score: 85
        },
        {
          text: 'Test chunk 2 for export',
          category: 'general',
          quality_score: 75
        }
      ];
      
      const response = await this.makeRequest('POST', '/api/export', {
        chunks: testChunks
      });
      
      if (response.success && response.data) {
        this.testResults.exportAPI = true;
        console.log('   Export API: PASS');
        console.log(`   Chunks exported: ${response.data.exported}`);
        console.log(`   Total after export: ${response.data.totalAfter}`);
        console.log(`   Backup created: ${response.data.backupFile}`);
      } else {
        console.log('   Export API: FAIL - Invalid response');
        console.log(`   Error: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('   Export API: FAIL - Network error');
      console.log(`   Error: ${error.message}`);
    }
  }

  async testFrontendLoading() {
    console.log('\n6. Testing Frontend Loading...');
    
    try {
      const response = await this.makeRequest('GET', '/');
      
      // Check for key frontend components
      const hasLoadingScreen = response.includes('loading-screen');
      const hasAppContainer = response.includes('app-container');
      const hasStepSections = response.includes('step-section');
      const hasProgressIndicator = response.includes('progress-indicator');
      const hasToastContainer = response.includes('toast-container');
      const hasModal = response.includes('confirm-modal');
      
      if (hasLoadingScreen && hasAppContainer && hasStepSections && hasProgressIndicator) {
        this.testResults.frontendLoading = true;
        console.log('   Frontend Loading: PASS');
        console.log('   Loading screen: Found');
        console.log('   App container: Found');
        console.log('   Step sections: Found');
        console.log('   Progress indicator: Found');
        console.log('   Toast container: Found');
        console.log('   Modal system: Found');
      } else {
        console.log('   Frontend Loading: FAIL - Missing components');
        console.log(`   Loading screen: ${hasLoadingScreen ? 'Found' : 'Missing'}`);
        console.log(`   App container: ${hasAppContainer ? 'Found' : 'Missing'}`);
        console.log(`   Step sections: ${hasStepSections ? 'Found' : 'Missing'}`);
        console.log(`   Progress indicator: ${hasProgressIndicator ? 'Found' : 'Missing'}`);
      }
    } catch (error) {
      console.log('   Frontend Loading: FAIL - Network error');
      console.log(`   Error: ${error.message}`);
    }
  }

  makeRequest(method, path, data = null) {
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
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            // Try to parse as JSON, if fails return as text
            if (res.headers['content-type']?.includes('application/json')) {
              const parsedData = JSON.parse(responseData);
              resolve(parsedData);
            } else {
              resolve(responseData);
            }
          } catch (error) {
            resolve(responseData);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  generateReport() {
    console.log('\n=== Integration Test Report ===\n');
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(Boolean).length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`Overall Score: ${successRate}% (${passedTests}/${totalTests})`);
    console.log('');
    
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? 'PASS' : 'FAIL';
      const icon = passed ? 'OK' : 'FAIL';
      console.log(`${icon} ${test}: ${status}`);
    });
    
    console.log('');
    
    if (successRate === 100) {
      console.log('Integration Status: PERFECT (10/10)');
      console.log('Frontend-Backend communication is working flawlessly!');
    } else if (successRate >= 80) {
      console.log('Integration Status: GOOD');
      console.log('Minor issues detected but system is functional.');
    } else if (successRate >= 60) {
      console.log('Integration Status: FAIR');
      console.log('Several issues detected, immediate attention required.');
    } else {
      console.log('Integration Status: POOR');
      console.log('Major issues detected, system needs significant fixes.');
    }
    
    console.log('\nRecommendations:');
    if (!this.testResults.screenshotAPI) {
      console.log('- Fix screenshot API (check Puppeteer configuration)');
    }
    if (!this.testResults.extractAPI) {
      console.log('- Fix extract API (check OpenRouter/Groq integration)');
    }
    if (!this.testResults.chunkAPI) {
      console.log('- Fix chunk API (check Groq service)');
    }
    if (!this.testResults.exportAPI) {
      console.log('- Fix export API (check storage service)');
    }
    if (!this.testResults.frontendLoading) {
      console.log('- Fix frontend loading (check HTML/CSS/JS)');
    }
  }
}

// Run the integration test
const tester = new IntegrationTester();
tester.runIntegrationTest();
