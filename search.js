const fs = require('fs');
const path = require('path');
const { getEmbedding, cosineSimilarity } = require('./embedding');

/**
 * Carga los chunks desde el archivo JSON
 * @returns {Array} - Array de chunks
 */
function loadChunks() {
    try {
        const chunksPath = path.join(__dirname, 'data', 'chunks.json');
        const chunksData = fs.readFileSync(chunksPath, 'utf8');
        return JSON.parse(chunksData);
    } catch (error) {
        console.error("Error cargando chunks:", error.message);
        return [];
    }
}

/**
 * Realiza búsqueda semántica de chunks relevantes
 * @param {string} question - Pregunta del usuario
 * @param {number} topK - Número de resultados a devolver (default: 3)
 * @returns {Promise<Array>} - Array de chunks con similitud
 */
async function semanticSearch(question, topK = 3) {
    console.log("Iniciando búsqueda semántica para:", question);
    
    try {
        // 1. Cargar chunks
        const chunks = loadChunks();
        if (chunks.length === 0) {
            console.warn("No hay chunks disponibles");
            return [];
        }

        // 2. Generar embedding de la pregunta
        console.log("Generando embedding de la pregunta...");
        const questionEmbedding = await getEmbedding(question);
        console.log("Embedding generado, tamaño:", questionEmbedding.length);

        // 3. Calcular similitud con cada chunk
        console.log("Calculando similitudes...");
        const results = [];
        
        for (const chunk of chunks) {
            try {
                const chunkEmbedding = await getEmbedding(chunk.text);
                const similarity = cosineSimilarity(questionEmbedding, chunkEmbedding);
                
                results.push({
                    text: chunk.text,
                    source: chunk.source,
                    score: similarity
                });
            } catch (error) {
                console.error(`Error procesando chunk ${chunk.id}:`, error.message);
                // Continuar con el siguiente chunk
            }
        }

        // 4. Ordenar por similitud (mayor a menor)
        results.sort((a, b) => b.score - a.score);

        // 5. Devolver top K resultados
        const topResults = results.slice(0, topK);
        
        console.log(`Búsqueda completada. Encontrados ${topResults.length} resultados relevantes`);
        topResults.forEach((result, index) => {
            console.log(`  ${index + 1}. Score: ${result.score.toFixed(4)} - Source: ${result.source}`);
        });

        return topResults;

    } catch (error) {
        console.error("Error en búsqueda semántica:", error.message);
        return [];
    }
}

/**
 * Construye contexto a partir de los resultados de búsqueda
 * @param {Array} searchResults - Resultados de semanticSearch
 * @returns {string} - Contexto formateado
 */
function buildContextFromResults(searchResults) {
    if (searchResults.length === 0) {
        return "No se encontró información relevante.";
    }

    let context = "Información relevante del instituto:\n\n";
    
    searchResults.forEach((result, index) => {
        context += `${index + 1}. ${result.text} (Fuente: ${result.source})\n`;
    });

    return context;
}

module.exports = {
    semanticSearch,
    buildContextFromResults,
    loadChunks
};
