// Probar las condiciones de boost para FP
function testBoostConditions() {
    const question = '¿Qué FP hay?';
    const questionWords = question.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 1)
        .map(word => word.replace(/[^\wáéíóúñü]/g, ''));
    
    console.log('Palabras de la pregunta:', questionWords);
    
    // Chunks de FP para probar
    const fpChunks = [
        {
            text: "Formación Profesional Grado Básico: Cocina y Restauración",
            source: "oferta"
        },
        {
            text: "Formación Profesional Grado Medio: Cocina y Gastronomía", 
            source: "oferta"
        }
    ];
    
    fpChunks.forEach((chunk, index) => {
        console.log(`\n--- Chunk ${index + 1} ---`);
        console.log(`Text: "${chunk.text}"`);
        console.log(`Source: ${chunk.source}`);
        
        // Condición 1: ¿La pregunta contiene 'fp' o 'formación'?
        const hasFPKeywords = questionWords.some(word => word.includes('fp') || word.includes('formación'));
        console.log(`¿Pregunta tiene 'fp' o 'formación'? ${hasFPKeywords}`);
        
        // Condición 2: ¿El chunk contiene términos de FP?
        const chunkHasFPTerms = chunk.text.toLowerCase().includes('formación profesional') || 
                                chunk.text.toLowerCase().includes('fp') || 
                                chunk.text.toLowerCase().includes('grado');
        console.log(`¿Chunk tiene términos FP? ${chunkHasFPTerms}`);
        
        // Condición 3: ¿El chunk contiene 'Formación Profesional' explícitamente?
        const chunkHasExplicitFP = chunk.text.toLowerCase().includes('formación profesional');
        console.log(`¿Chunk tiene 'Formación Profesional' explícito? ${chunkHasExplicitFP}`);
        
        // Evaluar boosts
        const boost1 = hasFPKeywords && chunkHasFPTerms;
        const boost2 = chunkHasExplicitFP && hasFPKeywords;
        
        console.log(`¿Aplica boost +10? ${boost1}`);
        console.log(`¿Aplica boost +8? ${boost2}`);
    });
}

testBoostConditions();
