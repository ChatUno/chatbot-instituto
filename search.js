const fs = require('fs');
const path = require('path');
const { simpleSearch, buildIntelligentContext, detectIntent } = require('./embedding');

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
 * Realiza búsqueda simple de chunks relevantes (sin embeddings)
 * @param {string} question - Pregunta del usuario
 * @param {number} topK - Número de resultados a devolver (default: 3)
 * @returns {Array} - Array de chunks con score de similitud
 */
function semanticSearch(question, topK = 3) {
    console.log("Iniciando búsqueda simple para:", question);
    
    try {
        // 1. Cargar chunks
        const chunks = loadChunks();
        if (chunks.length === 0) {
            console.warn("No hay chunks disponibles");
            return [];
        }

        // 2. Usar búsqueda simple basada en texto
        const results = simpleSearch(question, chunks);

        // 3. Devolver top K resultados
        const topResults = results.slice(0, topK);
        
        console.log(`Búsqueda simple completada. Encontrados ${topResults.length} resultados relevantes`);
        topResults.forEach((result, index) => {
            console.log(`  ${index + 1}. Score: ${result.score.toFixed(1)} - Source: ${result.source}`);
        });

        return topResults;

    } catch (error) {
        console.error("Error en búsqueda simple:", error.message);
        return [];
    }
}

/**
 * Construye contexto inteligente a partir de los resultados de búsqueda
 * @param {Array} searchResults - Resultados de semanticSearch
 * @param {string} question - Pregunta original del usuario
 * @returns {string} - Contexto formateado y optimizado
 */
function buildContextFromResults(searchResults, question) {
    if (searchResults.length === 0) {
        return "No se encontró información relevante.";
    }

    // Detectar intención para el contexto inteligente
    const intent = detectIntent(question);
    
    // Usar el nuevo sistema de construcción de contexto inteligente
    return buildIntelligentContext(question, searchResults, intent);
}

module.exports = {
    semanticSearch,
    buildContextFromResults,
    loadChunks
};
