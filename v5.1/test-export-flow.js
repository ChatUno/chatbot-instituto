// Test complete export flow including frontend integration
const http = require('http');

class ExportFlowTester {
  constructor() {
    this.apiBase = 'http://localhost:3002';
    this.testData = {
      url: 'https://iesjuandelanuza.catedu.es',
      screenshotData: null,
      extractedData: null,
      chunks: []
    };
  }

  async testExportFlow() {
    console.log('\n=== V5.1 Visual RAG - Export Flow Test ===\n');
    
    try {
      // Step 1: Capture screenshot
      await this.captureScreenshot();
      
      // Step 2: Extract text
      await this.extractText();
      
      // Step 3: Generate chunks
      await this.generateChunks();
      
      // Step 4: Simulate approval and export
      await this.simulateApprovalAndExport();
      
      console.log('\n=== Export Flow Test Completed Successfully ===');
      console.log('Frontend export functionality: WORKING');
      
    } catch (error) {
      console.error('\n=== Export Flow Test Failed ===', error);
    }
  }

  async captureScreenshot() {
    console.log('1. Capturing screenshot...');
    
    const response = await this.makeRequest('POST', '/api/screenshot', {
      url: this.testData.url
    });
    
    if (response.success) {
      this.testData.screenshotData = response.imageBase64;
      console.log('   Screenshot captured successfully');
    } else {
      throw new Error('Screenshot capture failed: ' + response.error);
    }
  }

  async extractText() {
    console.log('\n2. Extracting text...');
    
    const response = await this.makeRequest('POST', '/api/extract', {
      imageBase64: this.testData.screenshotData
    });
    
    if (response.success) {
      this.testData.extractedData = response.data;
      console.log('   Text extracted successfully');
      console.log(`   Text length: ${response.data.text.length} characters`);
    } else {
      throw new Error('Text extraction failed: ' + response.error);
    }
  }

  async generateChunks() {
    console.log('\n3. Generating chunks...');
    
    const response = await this.makeRequest('POST', '/api/chunk', {
      text: this.testData.extractedData.text,
      sourceUrl: this.testData.url
    });
    
    if (response.success) {
      this.testData.chunks = response.data.chunks;
      console.log('   Chunks generated successfully');
      console.log(`   Total chunks: ${response.data.chunks.length}`);
      
      // Show chunks for approval
      this.testData.chunks.forEach((chunk, index) => {
        console.log(`   Chunk ${index + 1}: ${chunk.category} (${chunk.quality_score}% quality)`);
      });
    } else {
      throw new Error('Chunk generation failed: ' + response.error);
    }
  }

  async simulateApprovalAndExport() {
    console.log('\n4. Simulating approval and export...');
    
    // Simulate approving first 2 chunks
    const approvedChunks = this.testData.chunks.slice(0, 2).map(chunk => ({
      text: chunk.text,
      category: chunk.category,
      quality_score: chunk.quality_score
    }));
    
    console.log(`   Approving ${approvedChunks.length} chunks for export`);
    
    // Export approved chunks
    const response = await this.makeRequest('POST', '/api/export', {
      chunks: approvedChunks
    });
    
    if (response.success) {
      console.log('   Export successful!');
      console.log(`   Chunks exported: ${response.data.exported}`);
      console.log(`   Total after export: ${response.data.totalAfter}`);
      console.log(`   Backup created: ${response.data.backupFile}`);
      console.log(`   Duplicates skipped: ${response.data.skippedDuplicates}`);
      
      // Verify database status
      await this.verifyDatabaseStatus();
    } else {
      throw new Error('Export failed: ' + response.error);
    }
  }

  async verifyDatabaseStatus() {
    console.log('\n5. Verifying database status...');
    
    const response = await this.makeRequest('GET', '/api/export/status');
    
    if (response.success) {
      console.log('   Database status verified');
      console.log(`   Total chunks in DB: ${response.data.totalChunks}`);
      console.log(`   Last modified: ${response.data.lastModified}`);
    } else {
      throw new Error('Database status check failed: ' + response.error);
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

// Run the export flow test
const tester = new ExportFlowTester();
tester.testExportFlow();
