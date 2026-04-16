/**
 * Búsqueda textual simple basada en coincidencias de palabras
 * @param {string} question - Pregunta del usuario
 * @param {Array} chunks - Array de chunks con text y source
 * @returns {Array} - Chunks con scores de similitud
 */
function simpleSearch(question, chunks) {
    console.log("Iniciando búsqueda simple para:", question);
    
    // Tokenizar pregunta (lowercase y split)
    const questionWords = question.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2) // ignorar palabras muy cortas
        .map(word => word.replace(/[^\wáéíóúñü]/g, '')); // limpiar caracteres especiales
    
    console.log("Palabras clave:", questionWords);
    
    // Calcular score para cada chunk
    const results = chunks.map(chunk => {
        const chunkText = chunk.text.toLowerCase();
        let score = 0;
        
        // Scoring basado en coincidencias
        questionWords.forEach(word => {
            // +2 si palabra exacta coincide
            if (chunkText.includes(word)) {
                score += 2;
            }
            
            // +1 si contiene parte de palabra (substring)
            const words = chunkText.split(/\s+/);
            words.forEach(chunkWord => {
                if (chunkWord.includes(word) || word.includes(chunkWord)) {
                    score += 1;
                }
            });
        });
        
        // Penalizar chunks muy largos (menos precisión)
        if (chunk.text.length > 200) {
            score *= 0.8;
        }
        
        return {
            text: chunk.text,
            source: chunk.source,
            score: score
        };
    });
    
    // Ordenar por score (mayor a menor)
    results.sort((a, b) => b.score - a.score);
    
    console.log(`Búsqueda simple completada. Top 3 scores:`, 
        results.slice(0, 3).map(r => `${r.score.toFixed(1)} (${r.source})`));
    
    return results;
}

module.exports = {
    simpleSearch
};
