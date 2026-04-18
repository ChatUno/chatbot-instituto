const http = require('http');

const testData = {
  text: "Este es un texto de prueba para verificar que el sistema de chunking semántico funciona correctamente. El texto debe tener al menos cincuenta palabras para que el sistema lo procese adecuadamente y genere chunks significativos. Esto es importante porque el sistema está diseñado para trabajar con textos de longitud suficiente que permitan una división semántica adecuada. El chunking semántico es una técnica fundamental en los sistemas RAG para asegurar que los fragmentos de texto sean coherentes y útiles para las consultas de los usuarios. La calidad de los chunks afecta directamente el rendimiento del sistema de recuperación.",
  sourceUrl: "https://iesjuandelanuza.catedu.es/"
};

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
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('BODY:', data);
    try {
      const response = JSON.parse(data);
      console.log('\n=== CHECK 2 Results ===');
      console.log('Success:', response.success);
      if (response.success) {
        console.log('Total chunks:', response.data.totalChunks);
        console.log('Source URL:', response.data.sourceUrl);
        console.log('First chunk structure:', JSON.stringify(response.data.chunks[0], null, 2));
        
        // Validate chunk structure
        const firstChunk = response.data.chunks[0];
        const hasText = firstChunk.text && typeof firstChunk.text === 'string';
        const hasCategory = firstChunk.category && typeof firstChunk.category === 'string';
        const hasQualityScore = typeof firstChunk.quality_score === 'number';
        const hasSourceUrl = firstChunk.source_url && typeof firstChunk.source_url === 'string';
        const hasWordCount = typeof firstChunk.word_count === 'number';
        
        console.log('\n=== Validations ===');
        console.log('Has text:', hasText);
        console.log('Has category:', hasCategory);
        console.log('Has quality_score:', hasQualityScore);
        console.log('Has source_url:', hasSourceUrl);
        console.log('Has word_count:', hasWordCount);
        console.log('Word count >= 10:', firstChunk.word_count >= 10);
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
