const { loadChunks } = require('./search.js');

// Importar las funciones del embedding.js
const fs = require('fs');
const path = require('path');

// Cargar el código del embedding.js para depurarlo
const embeddingCode = fs.readFileSync(path.join(__dirname, 'embedding.js'), 'utf8');
eval(embeddingCode);

function debugScoreCalculation() {
    console.log('🔍 Debug cálculo de scores para FP');
    
    const question = '¿Qué FP hay?';
    const chunks = loadChunks();
    
    // Encontrar chunks de FP
    const fpChunks = chunks.filter(chunk => 
        chunk.text.toLowerCase().includes('formación profesional') || 
        chunk.text.toLowerCase().includes('cocina')
    );
    
    console.log(`\nChunks de FP encontrados: ${fpChunks.length}`);
    
    // Probar cálculo de score para cada chunk de FP
    fpChunks.forEach((chunk, index) => {
        console.log(`\n--- Chunk ${index + 1}: ${chunk.text} ---`);
        
        // Detectar intención (debe ser 'oferta')
        const intent = detectIntent(question);
        console.log(`Intención detectada: ${intent}`);
        console.log(`Source del chunk: ${chunk.source}`);
        
        // Calcular score con la función actual
        const scoreResult = calculateScore(question, chunk, intent);
        console.log(`Score final: ${scoreResult.score}`);
        console.log(`Debug completo:`);
        scoreResult.debug.forEach(line => console.log(`  ${line}`));
    });
}

debugScoreCalculation();
