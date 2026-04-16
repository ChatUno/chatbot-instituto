/**
 * Sistema de Embeddings y Búsqueda Semántica para Chatbot IES Juan de Lanuza
 * Implementa búsqueda BM25-lite mejorada con scoring inteligente
 */

const { getValidatedConfig } = require('./config');
const config = getValidatedConfig();

/**
 * Detecta la intención del usuario basada en palabras clave específicas
 * @param {string} question - Pregunta del usuario
 * @returns {string} - Intención detectada (oferta, centro, general)
 */
function detectIntent(question) {
    const questionLower = question.toLowerCase();
    
    // Palabras clave por categoría (mejoradas)
    const keywords = {
        oferta: [
            'bachillerato', 'fp', 'formación profesional', 'ciclo', 'ciclo formativo', 
            'estudiar', 'asignaturas', 'qué puedo estudiar', 'qué bachilleratos', 
            'formación', 'grado', 'educación', 'formativo', 'ciclo', 
            'carrera', 'titulación', 'módulos', 'materias', 'qué fp', 
            'formación profesional grado', 'formación profesional medio', 'formación profesional básico'
        ],
        centro: [
            'teléfono', 'contacto', 'dónde', 'ubicación', 'dirección', 
            'instituto', 'horario', 'centro', 'secretaría', 'información',
            'ubicar', 'localizar', 'encontrar', 'email'
        ],
        general: [
            'hola', 'buenos días', 'adiós', 'gracias', 'ayuda', 'información',
            'qué es', 'cómo funciona', 'para qué sirve'
        ]
    };
    
    // Buscar coincidencias exactas primero
    for (const [category, words] of Object.entries(keywords)) {
        for (const word of words) {
            if (questionLower.includes(word)) {
                return category;
            }
        }
    }
    
    return 'general'; // Categoría por defecto
}

/**
 * Normaliza texto para búsqueda BM25-lite
 * @param {string} text - Texto a normalizar
 * @returns {string} - Texto normalizado
 */
function normalizeText(text) {
    // Preservar "FP" antes de normalizar
    const hasFP = text.toUpperCase().includes('FP');
    
    let normalized = text.toLowerCase()
              .replace(/[áàäâ]/g, 'a')
              .replace(/[éèëê]/g, 'e')
              .replace(/[íìïî]/g, 'i')
              .replace(/[óòöô]/g, 'o')
              .replace(/[úùüû]/g, 'u')
              .replace(/[ñ]/g, 'n')
              .replace(/[^\w\s]/g, '') // Solo letras y espacios
              .trim();
    
    // Restaurar "fp" si estaba presente
    if (hasFP && !normalized.includes('fp')) {
        normalized += ' fp';
    }
    
    return normalized;
}

/**
 * Tokeniza texto en palabras limpias
 * @param {string} text - Texto a tokenizar
 * @returns {Array} - Array de tokens
 */
function tokenize(text) {
    return normalizeText(text)
              .split(/\s+/)
              .filter(word => word.length > 1) // Ignorar palabras muy cortas (permitir "fp")
              .filter((word, index, arr) => arr.indexOf(word) === index); // Eliminar duplicados
}

/**
 * Calcula frecuencia de términos (TF-lite)
 * @param {Array} tokens - Tokens del documento
 * @returns {Object} - Frecuencia de cada término
 */
function calculateTF(tokens) {
    const tf = {};
    const totalTokens = tokens.length;
    
    for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
    }
    
    // Normalizar por longitud del documento
    for (const token in tf) {
        tf[token] = tf[token] / totalTokens;
    }
    
    return tf;
}

/**
 * @param {string} question - Pregunta del usuario
 * @param {Object} chunk - Chunk a evaluar
 * @returns {Object} - { baseScore, exactMatches, substringMatches, debugInfo }
 */
function calculateBaseScore(question, chunk) {
    const debugInfo = [];
    let baseScore = 0;
    let exactMatches = 0;
    let substringMatches = 0;
    
    const questionWords = question.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => word.replace(/[^\wáéíóúñü]/g, ''));
    
    questionWords.forEach(word => {
        // Coincidencia exacta de palabra clave (peso alto)
        if (chunk.text.toLowerCase().includes(word)) {
            exactMatches++;
            baseScore += config.rag.scoring.exactMatch;
            debugInfo.push(`+${config.rag.scoring.exactMatch} coincidencia exacta "${word}"`);
        }
        
        // Coincidencia de substring (peso medio)
        else if (chunk.text.toLowerCase().includes(word.substring(0, 3))) {
            substringMatches++;
            baseScore += config.rag.scoring.partialMatch;
            debugInfo.push(`+${config.rag.scoring.partialMatch} substring "${word.substring(0, 3)}"`);
        }
    });
    
    debugInfo.push(`Coincidencias: ${exactMatches} exactas, ${substringMatches} substring`);
    
    return { baseScore, exactMatches, substringMatches, debugInfo };
}

/**
 * Calcula boosts inteligentes basados en intención y contenido
 * @param {string} intent - Intención detectada
 * @param {Object} chunk - Chunk a evaluar
 * @param {string} question - Pregunta original
 * @returns {Object} - { boostScore, debugInfo }
 */
function calculateIntelligentBoosts(intent, chunk, question) {
    const debugInfo = [];
    let boostScore = 0;
    
    // Boost por categoría/intención
    if (intent && chunk.source === intent) {
        boostScore += config.rag.scoring.intentMatch;
        debugInfo.push(`+${config.rag.scoring.intentMatch} boost categoría (${intent})`);
    }
    
    // Boost por palabras clave específicas de la categoría
    if (intent === 'oferta') {
        const ofertaKeywords = ['fp', 'ciclo', 'grado', 'bachiller', 'formación', 'educación'];
        ofertaKeywords.forEach(keyword => {
            if (question.toLowerCase().includes(keyword) && chunk.text.toLowerCase().includes(keyword)) {
                boostScore += config.rag.scoring.categoryMatch;
                debugInfo.push(`+${config.rag.scoring.categoryMatch} keyword oferta "${keyword}"`);
            }
        });
    }
    
    // Boost por longitud óptima del chunk
    const chunkLength = chunk.text.length;
    if (chunkLength >= 50 && chunkLength <= 500) {
        boostScore += 2;
        debugInfo.push("+2 longitud óptima");
    } else if (chunkLength < 50) {
        boostScore -= 1;
        debugInfo.push("-1 demasiado corto");
    }
    
    return { boostScore, debugInfo };
}

/**
 * Calcula penalizaciones por calidad del chunk
 * @param {Object} chunk - Chunk a evaluar
 * @returns {Object} - { penalties, debugInfo }
 */
function calculatePenalties(chunk) {
    const debugInfo = [];
    let penalties = 0;
    
    const chunkLength = chunk.text.length;
    
    // Penalización por chunks muy largos
    if (chunkLength > 1000) {
        penalties -= 2;
        debugInfo.push("-2 demasiado largo");
    }
    
    // Penalización por chunks sin contenido útil
    if (chunk.text.split(/\s+/).length < 5) {
        penalties -= 1;
        debugInfo.push("-1 muy poco contenido");
    }
    
    // Penalización por repetición excesiva
    const words = chunk.text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (uniqueWords.size / words.length < 0.3) {
        penalties -= 1;
        debugInfo.push("-1 mucha repetición");
    }
    
    debugInfo.push(`Penalizaciones: ${penalties !== 0 ? 'aplicadas' : 'ninguna'}`);
    
    return { penalties, debugInfo };
}

/**
 * Función principal de cálculo de score (refactorizada)
 * @param {string} question - Pregunta del usuario
 * @param {Object} chunk - Chunk a evaluar
 * @param {string} intent - Intención detectada
 * @returns {Object} - Score y debug information
 */
function calculateScore(question, chunk, intent) {
    const debugInfo = [];
    
    // 1. TOKENIZACIÓN Y NORMALIZACIÓN
    const questionTokens = tokenize(question);
    const chunkTokens = tokenize(chunk.text);
    
    if (questionTokens.length === 0 || chunkTokens.length === 0) {
        debugInfo.push("No hay tokens válidos");
        return { score: 0, debug: debugInfo };
    }
    
    // 2. CALCULAR COMPONENTES
    const baseResult = calculateBaseScore(question, chunk);
    const boostResult = calculateIntelligentBoosts(intent, chunk, question);
    const penaltyResult = calculatePenalties(chunk);
    
    // 3. COMBINAR SCORES
    const totalScore = baseResult.baseScore + boostResult.boostScore + penaltyResult.penalties;
    
    // 4. AGREGAR DEBUG INFO
    debugInfo.push(...baseResult.debugInfo);
    debugInfo.push(...boostResult.debugInfo);
    debugInfo.push(...penaltyResult.debugInfo);
    debugInfo.push(`Score final: ${totalScore}`);
    
    return { 
        score: Math.max(0, totalScore), // No permitir scores negativos
        debug: debugInfo,
        trace: {
            chunk_id: chunk.id || 'unknown',
            final_score: Math.max(0, totalScore),
            score_breakdown: debugInfo
        }
    };
}

/**
 * Elimina chunks duplicados o muy similares
 * @param {Array} results - Array de resultados ordenados
 * @returns {Array} - Array sin duplicados
 */
function removeDuplicates(results) {
    const unique = [];
    const seenTexts = new Set();
    
    for (const result of results) {
        const normalizedText = normalizeText(result.text);
        
        // Si no hemos visto un texto similar, lo añadimos
        if (!seenTexts.has(normalizedText)) {
            seenTexts.add(normalizedText);
            unique.push(result);
        }
    }
    
    return unique;
}

/**
 * Búsqueda inteligente con BM25-lite y fallback
 * @param {string} question - Pregunta del usuario
 * @param {Array} chunks - Array de chunks con text y source
 * @returns {Array} - Chunks con scores de similitud
 */
function simpleSearch(question, chunks) {
    if (process.env.NODE_ENV === 'development') {
        console.log("=== INICIANDO BÚSQUEDA BM25-LITE ===");
        console.log("Pregunta:", question);
    }
    
    // 1. Detectar intención
    const intent = detectIntent(question);
    if (process.env.NODE_ENV === 'development') {
        console.log("Intención detectada:", intent);
    }
    
    // 2. Calcular score para cada chunk
    const results = chunks.map(chunk => {
        const scoreResult = calculateScore(question, chunk, intent);
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n--- Chunk ID: ${chunk.id} (Source: ${chunk.source}) ---`);
            scoreResult.debug.forEach(line => console.log(`  ${line}`));
        }
        
        return {
            id: chunk.id,
            text: chunk.text,
            source: chunk.source,
            score: scoreResult.score,
            debug: scoreResult.debug,
            trace: scoreResult.trace
        };
    });
    
    // 3. Filtrar resultados válidos (score > 0)
    let validResults = results.filter(result => result.score > 0);
    
    // 4. FALLBACK INTELIGENTE si todos los scores son bajos
    if (validResults.length === 0 || validResults.every(r => r.score < 3)) {
        if (process.env.NODE_ENV === 'development') {
            console.log("=== ACTIVANDO FALLBACK INTELIGENTE ===");
        }
        
        // Priorizar chunks de centro u oferta según intención
        const fallbackChunks = chunks.filter(chunk => 
            chunk.source === 'centro' || chunk.source === 'oferta'
        );
        
        validResults = fallbackChunks.slice(0, 2).map(chunk => ({
            id: chunk.id,
            text: chunk.text,
            source: chunk.source,
            score: 2, // Score mínimo para fallback
            debug: ["Fallback: chunk prioritario"]
        }));
    }
    
    // 5. Eliminar duplicados
    validResults = removeDuplicates(validResults);
    
    // 6. Ordenar por score (mayor a menor)
    validResults.sort((a, b) => b.score - a.score);
    
    // 7. Devolver TOP 3-5 máximo
    const finalResults = validResults.slice(0, 5);
    
    if (process.env.NODE_ENV === 'development') {
        console.log("\n=== RESULTADOS FINALES ===");
        finalResults.forEach((result, index) => {
            console.log(`${index + 1}. Score: ${result.score} | Source: ${result.source}`);
            console.log(`   Text: ${result.text.substring(0, 100)}...`);
        });
    }
    
    return finalResults;
}

/**
 * Limpia y filtra chunks para eliminar duplicados y contenido de baja calidad
 * @param {Array} chunks - Array de chunks con scores
 * @param {number} minScore - Score mínimo para considerar un chunk válido
 * @returns {Array} - Array limpio de chunks
 */
function cleanChunks(chunks, minScore = 3) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`=== LIMPIEZA DE CHUNKS ===`);
        console.log(`Chunks originales: ${chunks.length}`);
    }
    
    // 1. Filtrar por score mínimo
    let filtered = chunks.filter(chunk => chunk.score >= minScore);
    
    // 2. Eliminar duplicados o casi idénticos
    const unique = [];
    const seenTexts = new Set();
    
    for (const chunk of filtered) {
        const normalizedText = normalizeText(chunk.text);
        const textHash = normalizedText.substring(0, 50); // Primeros 50 caracteres como hash
        
        if (!seenTexts.has(textHash)) {
            seenTexts.add(textHash);
            unique.push(chunk);
        }
    }
    
    // 3. Normalizar texto de cada chunk
    const cleaned = unique.map(chunk => ({
        ...chunk,
        text: chunk.text.trim().replace(/\s+/g, ' ')
    }));
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`Chunks después de limpieza: ${cleaned.length}`);
    }
    
    return cleaned;
}

/**
 * Agrupa chunks inteligentemente por categoría
 * @param {Array} chunks - Array de chunks limpios
 * @param {string} intent - Intención detectada
 * @returns {Object} - Objeto con grupos ordenados
 */
function groupChunksByCategory(chunks, intent) {
    const groups = {
        oferta: [],
        centro: [],
        otros: []
    };
    
    // Agrupar por source
    chunks.forEach(chunk => {
        if (chunk.source === 'oferta') {
            groups.oferta.push(chunk);
        } else if (chunk.source === 'centro') {
            groups.centro.push(chunk);
        } else {
            groups.otros.push(chunk);
        }
    });
    
    // Ordenar cada grupo por score descendente
    Object.keys(groups).forEach(category => {
        groups[category].sort((a, b) => b.score - a.score);
    });
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`=== AGRUPACIÓN POR CATEGORÍA ===`);
        console.log(`Oferta: ${groups.oferta.length} chunks`);
        console.log(`Centro: ${groups.centro.length} chunks`);
        console.log(`Otros: ${groups.otros.length} chunks`);
    }
    
    return groups;
}

/**
 * Construye contexto optimizado para el LLM
 * @param {string} query - Pregunta del usuario
 * @param {Array} chunks - Array de chunks rankeados
 * @param {string} intent - Intención detectada
 * @returns {string} - Contexto formateado y optimizado
 */
function buildIntelligentContext(query, chunks, intent) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`=== CONSTRUYENDO CONTEXTO INTELIGENTE ===`);
        console.log(`Query: ${query}`);
        console.log(`Intención: ${intent}`);
    }
    
    // 1. Limpieza de chunks
    const cleanedChunks = cleanChunks(chunks);
    
    // 2. Agrupación por categoría
    const groups = groupChunksByCategory(cleanedChunks, intent);
    
    // 3. Selección inteligente según intención
    let selectedChunks = [];
    const maxChunks = 6; // Máximo total de chunks
    
    if (intent === 'oferta') {
        // Priorizar oferta, luego centro si queda espacio
        selectedChunks = [
            ...groups.oferta.slice(0, 4),
            ...groups.centro.slice(0, 2)
        ].slice(0, maxChunks);
    } else if (intent === 'centro') {
        // Priorizar centro, luego oferta si queda espacio
        selectedChunks = [
            ...groups.centro.slice(0, 4),
            ...groups.oferta.slice(0, 2)
        ].slice(0, maxChunks);
    } else {
        // General: mezclar por score
        selectedChunks = [
            ...groups.oferta.slice(0, 3),
            ...groups.centro.slice(0, 3)
        ]
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks);
    }
    
    // 4. Construir contexto formateado
    let context = "[CONTEXTO RELEVANTE]\n\n";
    
    // Añadir sección de oferta si hay chunks
    if (groups.oferta.length > 0 && selectedChunks.some(c => c.source === 'oferta')) {
        context += "OFERTA EDUCATIVA:\n";
        selectedChunks
            .filter(chunk => chunk.source === 'oferta')
            .forEach(chunk => {
                context += `- ${chunk.text}\n`;
            });
        context += "\n";
    }
    
    // Añadir sección de centro si hay chunks
    if (groups.centro.length > 0 && selectedChunks.some(c => c.source === 'centro')) {
        context += "INFORMACIÓN DEL CENTRO:\n";
        selectedChunks
            .filter(chunk => chunk.source === 'centro')
            .forEach(chunk => {
                context += `- ${chunk.text}\n`;
            });
        context += "\n";
    }
    
    // Añadir otros si hay espacio y son relevantes
    if (groups.otros.length > 0 && selectedChunks.some(c => c.source === 'otros')) {
        context += "INFORMACIÓN ADICIONAL:\n";
        selectedChunks
            .filter(chunk => chunk.source === 'otros')
            .forEach(chunk => {
                context += `- ${chunk.text}\n`;
            });
        context += "\n";
    }
    
    context += "[FIN CONTEXTO]";
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`=== CONTEXTO CONSTRUIDO ===`);
        console.log(`Chunks seleccionados: ${selectedChunks.length}`);
        console.log(`Longitud del contexto: ${context.length} caracteres`);
        console.log(`Contexto:\n${context}`);
    }
    
    return context;
}

module.exports = {
    simpleSearch,
    buildIntelligentContext,
    cleanChunks,
    groupChunksByCategory,
    detectIntent,
    calculateScore,
    calculateBaseScore,
    calculateIntelligentBoosts,
    calculatePenalties
};
