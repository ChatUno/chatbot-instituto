// Test complete frontend-backend integration
const http = require('http');

class CompleteFlowTester {
  constructor() {
    this.apiBase = 'http://localhost:3002';
    this.testData = {
      url: 'https://iesjuandelanuza.catedu.es',
      screenshotData: null,
      extractedData: null,
      chunks: []
    };
  }

  async runCompleteTest() {
    console.log('\n=== V5.1 Visual RAG - Complete Flow Test ===\n');
    
    try {
      // Test 1: Server Health
      await this.testServerHealth();
      
      // Test 2: Screenshot Capture
      await this.testScreenshotCapture();
      
      // Test 3: Text Extraction
      await this.testTextExtraction();
      
      // Test 4: Chunk Generation
      await this.testChunkGeneration();
      
      // Test 5: Database Status
      await this.testDatabaseStatus();
      
      // Test 6: Backups List
      await this.testBackupsList();
      
      // Test 7: Export Simulation
      await this.testExportSimulation();
      
      console.log('\n=== All Tests Completed Successfully ===');
      console.log('\nFrontend-Backend Integration: READY');
      console.log('Open http://localhost:3002 to use the professional interface');
      
    } catch (error) {
      console.error('\n=== Test Failed ===', error);
    }
  }

  async testServerHealth() {
    console.log('1. Testing Server Health...');
    
    const response = await this.makeRequest('GET', '/api/export/status');
    
    if (response.success) {
      console.log('   Server is running and responsive');
      console.log(`   Current chunks in DB: ${response.data.totalChunks}`);
    } else {
      throw new Error('Server not responding correctly');
    }
  }

  async testScreenshotCapture() {
    console.log('\n2. Testing Screenshot Capture...');
    
    const response = await this.makeRequest('POST', '/api/screenshot', {
      url: this.testData.url
    });
    
    if (response.success) {
      this.testData.screenshotData = response.imageBase64;
      console.log('   Screenshot captured successfully');
      console.log(`   Image size: ${response.metadata.sizeBytes} bytes`);
      console.log(`   Captured at: ${response.metadata.capturedAt}`);
    } else {
      throw new Error('Screenshot capture failed: ' + response.error);
    }
  }

  async testTextExtraction() {
    console.log('\n3. Testing Text Extraction...');
    
    const response = await this.makeRequest('POST', '/api/extract', {
      imageBase64: this.testData.screenshotData
    });
    
    if (response.success) {
      this.testData.extractedData = response.data;
      console.log('   Text extracted successfully');
      console.log(`   Text length: ${response.data.text.length} characters`);
      console.log(`   Links found: ${response.data.links.length}`);
      console.log(`   AI Model: ${response.data.model}`);
      console.log(`   Tokens used: ${response.data.tokensUsed}`);
    } else {
      throw new Error('Text extraction failed: ' + response.error);
    }
  }

  async testChunkGeneration() {
    console.log('\n4. Testing Chunk Generation...');
    
    const response = await this.makeRequest('POST', '/api/chunk', {
      text: this.testData.extractedData.text,
      sourceUrl: this.testData.url
    });
    
    if (response.success) {
      this.testData.chunks = response.data.chunks;
      console.log('   Chunks generated successfully');
      console.log(`   Total chunks: ${response.data.totalChunks}`);
      
      // Show sample chunks
      response.data.chunks.slice(0, 3).forEach((chunk, index) => {
        console.log(`   Chunk ${index + 1}: ${chunk.category} (${chunk.quality_score}% quality)`);
        console.log(`   Preview: "${chunk.text.substring(0, 100)}..."`);
        console.log(`   Words: ${chunk.word_count}`);
      });
    } else {
      throw new Error('Chunk generation failed: ' + response.error);
    }
  }

  async testDatabaseStatus() {
    console.log('\n5. Testing Database Status...');
    
    const response = await this.makeRequest('GET', '/api/export/status');
    
    if (response.success) {
      console.log('   Database status retrieved');
      console.log(`   Total chunks: ${response.data.totalChunks}`);
      console.log(`   Last modified: ${response.data.lastModified || 'Never'}`);
    } else {
      throw new Error('Database status check failed: ' + response.error);
    }
  }

  async testBackupsList() {
    console.log('\n6. Testing Backups List...');
    
    const response = await this.makeRequest('GET', '/api/export/backups');
    
    if (response.success) {
      console.log('   Backups list retrieved');
      console.log(`   Available backups: ${response.data.backups.length}`);
      
      if (response.data.backups.length > 0) {
        console.log('   Latest backup:', response.data.backups[0]);
      }
    } else {
      throw new Error('Backups list failed: ' + response.error);
    }
  }

  async testExportSimulation() {
    console.log('\n7. Testing Export Simulation...');
    
    // Simulate approving some chunks
    const approvedChunks = this.testData.chunks.slice(0, 2).map(chunk => ({
      text: chunk.text,
      category: chunk.category,
      quality_score: chunk.quality_score
    }));
    
    if (approvedChunks.length > 0) {
      const response = await this.makeRequest('POST', '/api/export', {
        chunks: approvedChunks
      });
      
      if (response.success) {
        console.log('   Export simulation successful');
        console.log(`   Chunks exported: ${response.data.exported}`);
        console.log(`   Total after export: ${response.data.totalAfter}`);
        console.log(`   Backup created: ${response.data.backupFile}`);
        console.log(`   Duplicates skipped: ${response.data.skippedDuplicates}`);
      } else {
        throw new Error('Export simulation failed: ' + response.error);
      }
    } else {
      console.log('   No chunks available for export simulation');
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
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error('Invalid JSON response: ' + error.message));
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
}

// Run the complete test
const tester = new CompleteFlowTester();
tester.runCompleteTest();
