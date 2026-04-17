const { semanticSearch } = require('./search.js');

async function debugFPDetailed() {
    console.log('🔍 Debug detallado búsqueda FP:');
    
    // Simular la pregunta y palabras extraídas
    const question = '¿Qué FP hay?';
    const questionWords = question.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => word.replace(/[^\wáéíóúñü]/g, ''));
    
    console.log('Palabras extraídas:', questionWords);
    
    // Verificar detección de palabras clave
    const hasFP = questionWords.some(word => word.includes('fp'));
    const hasFormacion = questionWords.some(word => word.includes('formación'));
    
    console.log(`¿Contiene 'fp'? ${hasFP}`);
    console.log(`¿Contiene 'formación'? ${hasFormacion}`);
    
    // Cargar chunks manualmente para verificar
    const { loadChunks } = require('./search.js');
    const chunks = loadChunks();
    
    console.log('\nChunks de FP encontrados:');
    chunks.filter(chunk => 
        chunk.text.toLowerCase().includes('formación profesional') || 
        chunk.text.toLowerCase().includes('cocina')
    ).forEach((chunk, i) => {
        console.log(`${i+1}. ID: ${chunk.id} | "${chunk.text}"`);
        
        // Verificar si debería tener boost
        const chunkHasFP = chunk.text.toLowerCase().includes('formación profesional') || 
                          chunk.text.toLowerCase().includes('fp') || 
                          chunk.text.toLowerCase().includes('grado');
        
        const chunkHasFormacionExplicita = chunk.text.toLowerCase().includes('formación profesional');
        
        console.log(`   ¿Debería tener boost FP? ${chunkHasFP}`);
        console.log(`   ¿Debería tener boost explícito? ${chunkHasFormacionExplicita}`);
    });
    
    // Probar búsqueda real
    console.log('\n--- BÚSQUEDA REAL ---');
    const results = semanticSearch(question, 5);
    console.log('Resultados:', results.length);
    results.forEach((r, i) => {
        console.log(`${i+1}. Score: ${r.score} | Source: ${r.source}`);
        console.log(`   Text: "${r.text}"`);
        if (r.debug) {
            console.log(`   Debug: ${r.debug.slice(0, 3).join(', ')}...`);
        }
    });
}

debugFPDetailed();
