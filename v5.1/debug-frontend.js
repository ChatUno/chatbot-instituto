// Script para depurar el flujo del frontend
console.log('=== Depurando Frontend V5.1 ===');

// Verificar que el servidor está corriendo
fetch('http://localhost:3002/api/screenshot', {
  method: 'GET'
})
.then(response => response.json())
.then(data => {
  console.log('API Response:', data);
})
.catch(error => {
  console.log('Server error:', error.message);
});

// Simular el flujo completo
class DebugFrontend {
  constructor() {
    this.screenshotData = null;
    this.extractedData = null;
    this.currentChunks = [];
    this.apiBase = 'http://localhost:3002';
  }

  async testFullFlow() {
    console.log('\n--- Iniciando Flujo Completo ---');
    
    try {
      // 1. Captura
      console.log('1. Probando captura...');
      await this.testCapture();
      
      // 2. Extracción
      console.log('\n2. Probando extracción...');
      await this.testExtract();
      
      // 3. Chunking
      console.log('\n3. Probando chunking...');
      await this.testChunking();
      
      console.log('\n--- Flujo completado exitosamente ---');
      
    } catch (error) {
      console.error('Error en el flujo:', error);
    }
  }

  async testCapture() {
    const response = await fetch(`${this.apiBase}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://iesjuandelanuza.catedu.es' })
    });

    const result = await response.json();
    
    if (result.success) {
      this.screenshotData = {
        screenshot: result.imageBase64,
        url: result.metadata.url,
        title: 'Captura de página',
        dimensions: { width: 1920, height: 1080 },
        timestamp: result.metadata.capturedAt
      };
      console.log('   Captura exitosa');
      console.log('   URL:', this.screenshotData.url);
      console.log('   Tamaño:', result.metadata.sizeBytes, 'bytes');
    } else {
      throw new Error('Captura fallida: ' + result.error);
    }
  }

  async testExtract() {
    if (!this.screenshotData) {
      throw new Error('No hay screenshot data');
    }

    const response = await fetch(`${this.apiBase}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: this.screenshotData.screenshot
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.extractedData = result.data;
      console.log('   Extracción exitosa');
      console.log('   Texto length:', this.extractedData.text.length);
      console.log('   Links found:', this.extractedData.links.length);
      console.log('   Model:', this.extractedData.model);
    } else {
      throw new Error('Extracción fallida: ' + result.error);
    }
  }

  async testChunking() {
    if (!this.extractedData) {
      throw new Error('No hay extracted data');
    }

    const response = await fetch(`${this.apiBase}/api/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: this.extractedData.text,
        sourceUrl: this.screenshotData.url
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.currentChunks = result.data.chunks;
      console.log('   Chunking exitoso');
      console.log('   Total chunks:', this.currentChunks.length);
      console.log('   First chunk preview:', this.currentChunks[0]?.text.substring(0, 100) + '...');
    } else {
      throw new Error('Chunking fallido: ' + result.error);
    }
  }
}

// Ejecutar prueba
const frontendDebugger = new DebugFrontend();
frontendDebugger.testFullFlow();
