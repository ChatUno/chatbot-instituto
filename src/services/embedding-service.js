/**
 * Sistema de Embeddings y Búsqueda Semántica para Chatbot IES Juan de Lanuza
 * Implementa búsqueda BM25-lite mejorada con scoring inteligente
 */

const { getValidatedConfig } = require("../utils/config");
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
 * Tokeniza texto en palabras limpias (mejorado para BM25)
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
 * Calcula frecuencia de términos (TF) para BM25
 * @param {Array} tokens - Tokens del documento
 * @returns {Object} - Frecuencia de cada término
 */
function calculateTF(tokens) {
    const tf = {};
    
    for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
    }
    
    return tf;
}

/**
 * Calcula frecuencia inversa de documentos (IDF)
 * @param {Array} documents - Array de documentos (cada documento es un array de tokens)
 * @returns {Object} - IDF para cada término
 */
function calculateIDF(documents) {
    const N = documents.length; // Total de documentos
    const df = {}; // Document frequency para cada término
    
    // Calcular document frequency
    for (const doc of documents) {
        const uniqueTokens = new Set(doc);
        for (const token of uniqueTokens) {
            df[token] = (df[token] || 0) + 1;
        }
    }
    
    // Calcular IDF con suavizado para evitar división por cero
    const idf = {};
    for (const term in df) {
        idf[term] = Math.log((N + 1) / (df[term] + 0.5)) + 1;
    }
    
    return idf;
}

/**
 * Calcula score BM25 mejorado
 * @param {string} query - Query del usuario
 * @param {Object} chunk - Chunk a evaluar
 * @param {Object} idf - IDF pre-calculado
 * @param {number} avgDocLength - Longitud promedio de documentos
 * @param {number} k1 - Parámetro k1 de BM25
 * @param {number} b - Parámetro b de BM25
 * @returns {Object} - Score y debug info
 */
function calculateBM25Score(query, chunk, idf, avgDocLength, k1 = 1.2, b = 0.75) {
    const debugInfo = [];
    let totalScore = 0;
    
    // Tokenizar query y chunk
    const queryTokens = tokenize(query);
    const chunkTokens = tokenize(chunk.text);
    
    if (queryTokens.length === 0 || chunkTokens.length === 0) {
        debugInfo.push("No hay tokens válidos");
        return { score: 0, debug: debugInfo };
    }
    
    // Calcular TF del chunk
    const chunkTF = calculateTF(chunkTokens);
    const docLength = chunkTokens.length;
    
    debugInfo.push(`Query tokens: ${queryTokens.join(', ')}`);
    debugInfo.push(`Chunk tokens: ${chunkTokens.length} tokens`);
    debugInfo.push(`Doc length: ${docLength}, Avg length: ${avgDocLength.toFixed(2)}`);
    
    // Calcular BM25 score para cada término del query
    for (const term of queryTokens) {
        const tf = chunkTF[term] || 0;
        const termIDF = idf[term] || 0;
        
        // Fórmula BM25: IDF * (TF * (k1 + 1)) / (TF + k1 * (1 - b + b * (docLength / avgDocLength)))
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
        const termScore = termIDF * (numerator / denominator);
        
        totalScore += termScore;
        
        debugInfo.push(`Term "${term}": TF=${tf}, IDF=${termIDF.toFixed(3)}, Score=${termScore.toFixed(3)}`);
    }
    
    debugInfo.push(`BM25 Score: ${totalScore.toFixed(3)}`);
    
    return { 
        score: totalScore, 
        debug: debugInfo,
        trace: {
            chunk_id: chunk.id || 'unknown',
            final_score: totalScore,
            algorithm: 'BM25',
            parameters: { k1, b },
            score_breakdown: debugInfo
        }
    };
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
 * Función principal de cálculo de score con BM25 mejorado
 * @param {string} question - Pregunta del usuario
 * @param {Object} chunk - Chunk a evaluar
 * @param {string} intent - Intención detectada
 * @param {Object} options - Opciones adicionales
 * @returns {Object} - Score y debug information
 */
function calculateScore(question, chunk, intent, options = {}) {
    const {
        useBM25 = true,
        idf = null,
        avgDocLength = 100,
        k1 = 1.2,
        b = 0.75
    } = options;
    
    if (useBM25 && idf) {
        // Usar BM25 matemático si tenemos IDF pre-calculado
        const bm25Result = calculateBM25Score(question, chunk, idf, avgDocLength, k1, b);
        
        // Aplicar boosts y penalidades sobre el score BM25
        const boostResult = calculateIntelligentBoosts(intent, chunk, question);
        const penaltyResult = calculatePenalties(chunk);
        
        const finalScore = bm25Result.score + boostResult.boostScore + penaltyResult.penalties;
        
        return {
            score: Math.max(0, finalScore),
            debug: [
                ...bm25Result.debug,
                ...boostResult.debugInfo,
                ...penaltyResult.debugInfo,
                `Final score: ${finalScore.toFixed(3)}`
            ],
            trace: {
                ...bm25Result.trace,
                boosts: boostResult.boostScore,
                penalties: penaltyResult.penalties,
                final_score: finalScore
            }
        };
    } else {
        // Fallback al sistema heurístico original
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
        debugInfo.push(`Score final (heuristic): ${totalScore}`);
        
        return { 
            score: Math.max(0, totalScore),
            debug: debugInfo,
            trace: {
                chunk_id: chunk.id || 'unknown',
                final_score: Math.max(0, totalScore),
                algorithm: 'heuristic',
                score_breakdown: debugInfo
            }
        };
    }
}

/**
 * Pre-calcula IDF para un conjunto de chunks
 * @param {Array} chunks - Array de chunks
 * @returns {Object} - IDF y estadísticas
 */
function preCalculateIDF(chunks) {
    // Tokenizar todos los chunks
    const documents = chunks.map(chunk => tokenize(chunk.text));
    
    // Calcular IDF
    const idf = calculateIDF(documents);
    
    // Calcular longitud promedio
    const totalLength = documents.reduce((sum, doc) => sum + doc.length, 0);
    const avgDocLength = totalLength / documents.length;
    
    return {
        idf,
        avgDocLength,
        documentCount: documents.length,
        vocabularySize: Object.keys(idf).length
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
 * Cache para contextos construidos (optimización de performance)
 */
const contextCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Genera cache key para context building
 * @param {string} query - Query normalizado
 * @param {string} intent - Intención
 * @param {number} chunkCount - Número de chunks
 * @returns {string} - Cache key
 */
function generateContextCacheKey(query, intent, chunkCount) {
    return `${query.toLowerCase().trim()}:${intent}:${chunkCount}`;
}

/**
 * Calcula diversidad de chunks (para evitar redundancia)
 * @param {Array} chunks - Array de chunks
 * @returns {number} - Score de diversidad (0-1)
 */
function calculateDiversity(chunks) {
    if (chunks.length <= 1) return 1;
    
    const sources = new Set(chunks.map(c => c.source));
    const sourceDiversity = sources.size / chunks.length;
    
    // Calcular similitud de texto simple
    let textSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
            const words1 = new Set(chunks[i].text.toLowerCase().split(/\s+/));
            const words2 = new Set(chunks[j].text.toLowerCase().split(/\s+/));
            
            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);
            
            const similarity = intersection.size / union.size;
            textSimilarity += similarity;
            comparisons++;
        }
    }
    
    const avgTextSimilarity = comparisons > 0 ? textSimilarity / comparisons : 0;
    const textDiversity = 1 - avgTextSimilarity;
    
    return (sourceDiversity * 0.6 + textDiversity * 0.4);
}

/**
 * Selección greedy de chunks optimizada para máxima relevancia y diversidad
 * @param {Array} chunks - Array de chunks con scores
 * @param {number} maxChunks - Máximo número de chunks
 * @param {string} intent - Intención detectada
 * @returns {Array} - Chunks seleccionados
 */
function selectOptimalChunks(chunks, maxChunks, intent) {
    if (chunks.length <= maxChunks) return chunks;
    
    // Priorizar chunks por intención
    const priorityScores = {
        oferta: intent === 'oferta' ? 2 : 1,
        centro: intent === 'centro' ? 2 : 1,
        programas: intent === 'general' ? 1.5 : 0.8,
        faq: intent === 'general' ? 1.5 : 0.8
    };
    
    // Calcular score combinado (relevancia + prioridad + diversidad)
    const scoredChunks = chunks.map(chunk => ({
        ...chunk,
        combinedScore: chunk.score * (priorityScores[chunk.source] || 1)
    }));
    
    // Selección greedy con diversidad
    const selected = [];
    const remaining = [...scoredChunks].sort((a, b) => b.combinedScore - a.combinedScore);
    
    while (selected.length < maxChunks && remaining.length > 0) {
        let bestIndex = 0;
        let bestScore = remaining[0].combinedScore;
        
        // Considerar diversidad si ya hay chunks seleccionados
        if (selected.length > 0) {
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                const testSelection = [...selected, candidate];
                const diversity = calculateDiversity(testSelection);
                
                // Score combinado: relevancia * diversidad
                const combinedScore = candidate.combinedScore * (1 + diversity);
                
                if (combinedScore > bestScore) {
                    bestScore = combinedScore;
                    bestIndex = i;
                }
            }
        }
        
        selected.push(remaining.splice(bestIndex, 1)[0]);
    }
    
    return selected;
}

/**
 * Construye contexto optimizado para el LLM (mejorado)
 * @param {string} query - Pregunta del usuario
 * @param {Array} chunks - Array de chunks rankeados
 * @param {string} intent - Intención detectada
 * @param {Object} options - Opciones de optimización
 * @returns {string} - Contexto formateado y optimizado
 */
function buildIntelligentContext(query, chunks, intent, options = {}) {
    const {
        maxChunks = config.rag.maxChunks,
        maxContextLength = config.memory.maxContextLength,
        useCache = true,
        enableDiversity = true
    } = options;
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`=== CONSTRUYENDO CONTEXTO INTELIGENTE (OPTIMIZADO) ===`);
        console.log(`Query: ${query}`);
        console.log(`Intención: ${intent}`);
        console.log(`Chunks disponibles: ${chunks.length}`);
    }
    
    // 1. Verificar cache
    if (useCache) {
        const cacheKey = generateContextCacheKey(query, intent, chunks.length);
        const cached = contextCache.get(cacheKey);
        if (cached) {
            if (process.env.NODE_ENV === 'development') {
                console.log('Contexto recuperado desde cache');
            }
            return cached.context;
        }
    }
    
    // 2. Limpieza de chunks
    const cleanedChunks = cleanChunks(chunks);
    
    // 3. Selección optimizada
    let selectedChunks;
    if (enableDiversity) {
        selectedChunks = selectOptimalChunks(cleanedChunks, maxChunks, intent);
    } else {
        // Fallback al método original
        const groups = groupChunksByCategory(cleanedChunks, intent);
        
        if (intent === 'oferta') {
            selectedChunks = [
                ...groups.oferta.slice(0, 4),
                ...groups.centro.slice(0, 2)
            ].slice(0, maxChunks);
        } else if (intent === 'centro') {
            selectedChunks = [
                ...groups.centro.slice(0, 4),
                ...groups.oferta.slice(0, 2)
            ].slice(0, maxChunks);
        } else {
            selectedChunks = [
                ...groups.centro.slice(0, 2),
                ...groups.oferta.slice(0, 2),
                ...groups.otros.slice(0, 2)
            ].slice(0, maxChunks);
        }
    }
    
    // 4. Construcción del contexto con formato optimizado
    let context = '';
    const sourceHeaders = {
        oferta: 'FORMACIÓN PROFESIONAL',
        centro: 'INFORMACIÓN DEL CENTRO',
        programas: 'PROGRAMAS',
        faq: 'PREGUNTAS FRECUENTES'
    };
    
    // Agrupar por source para mejor organización
    const groupedBySource = {};
    selectedChunks.forEach(chunk => {
        if (!groupedBySource[chunk.source]) {
            groupedBySource[chunk.source] = [];
        }
        groupedBySource[chunk.source].push(chunk);
    });
    
    // Construir contexto ordenado por relevancia
    const sourceOrder = intent === 'oferta' ? ['oferta', 'centro', 'programas', 'faq'] :
                        intent === 'centro' ? ['centro', 'oferta', 'programas', 'faq'] :
                        ['centro', 'oferta', 'programas', 'faq'];
    
    for (const source of sourceOrder) {
        if (groupedBySource[source] && groupedBySource[source].length > 0) {
            context += `\n${sourceHeaders[source] || source.toUpperCase()}:\n`;
            
            groupedBySource[source].forEach((chunk, index) => {
                context += `${index + 1}. ${chunk.text.trim()}\n`;
            });
        }
    }
    
    // 5. Optimización de longitud
    if (context.length > maxContextLength) {
        // Truncar inteligentemente manteniendo chunks completos
        const lines = context.split('\n');
        let truncatedContext = '';
        let currentLength = 0;
        
        for (const line of lines) {
            if (currentLength + line.length + 1 <= maxContextLength - 100) {
                truncatedContext += line + '\n';
                currentLength += line.length + 1;
            } else {
                truncatedContext += '\n... [Contenido truncado por límite de tamaño]';
                break;
            }
        }
        
        context = truncatedContext;
    }
    
    // 6. Guardar en cache
    if (useCache) {
        const cacheKey = generateContextCacheKey(query, intent, chunks.length);
        
        // Limitar tamaño del cache
        if (contextCache.size >= MAX_CACHE_SIZE) {
            const firstKey = contextCache.keys().next().value;
            contextCache.delete(firstKey);
        }
        
        contextCache.set(cacheKey, {
            context: context,
            timestamp: Date.now(),
            chunks: selectedChunks.length
        });
    }
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`Contexto construido: ${context.length} caracteres`);
        console.log(`Chunks seleccionados: ${selectedChunks.length}`);
        console.log(`Diversidad: ${calculateDiversity(selectedChunks).toFixed(3)}`);
    }
    
    return context.trim();
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
    calculatePenalties,
    calculateBM25Score,
    calculateIDF,
    preCalculateIDF,
    calculateTF,
    calculateDiversity,
    selectOptimalChunks,
    generateContextCacheKey
};
