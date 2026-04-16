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
 * Calcula score BM25-lite con boosts inteligentes
 * @param {string} question - Pregunta del usuario
 * @param {Object} chunk - Chunk con texto y source
 * @param {string} intent - Intención detectada
 * @returns {Object} - Score calculado con desglose
 */
function calculateScore(question, chunk, intent) {
    const debugInfo = [];
    let totalScore = 0;
    
    // 1. TOKENIZACIÓN Y NORMALIZACIÓN
    const questionTokens = tokenize(question);
    const chunkTokens = tokenize(chunk.text);
    const questionWords = question.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => word.replace(/[^\wáéíóúñü]/g, ''));
    
    if (questionTokens.length === 0 || chunkTokens.length === 0) {
        debugInfo.push("No hay tokens válidos");
        return { score: 0, debug: debugInfo };
    }
    
    // 2. BASE: Frecuencia de términos (TF-lite)
    let baseScore = 0;
    let exactMatches = 0;
    let substringMatches = 0;
    
    questionWords.forEach(word => {
        // Coincidencia exacta de palabra clave (peso alto)
        if (chunk.text.toLowerCase().includes(word)) {
            exactMatches++;
            baseScore += 3;
            debugInfo.push(`+3 coincidencia exacta "${word}"`);
        }
        
        // Substring match (peso medio)
        const chunkWords = chunk.text.toLowerCase().split(/\s+/);
        chunkWords.forEach(chunkWord => {
            if ((chunkWord.includes(word) || word.includes(chunkWord)) && chunkWord !== word) {
                substringMatches++;
                baseScore += 1;
                debugInfo.push(`+1 substring "${word}" en "${chunkWord}"`);
            }
        });
    });
    
    totalScore += baseScore;
    debugInfo.push(`Base score: ${baseScore} (exactas: ${exactMatches}, substrings: ${substringMatches})`);
    
    // 3. BOOSTS
    const boosts = [];
    
    // Boost por intención (+5 si chunk.source == intención detectada)
    if (chunk.source === intent) {
        totalScore += 5;
        boosts.push("+5 intención coincidente");
    }
    
    // Boost por palabra exacta de la pregunta (+5)
    if (exactMatches > 0) {
        totalScore += 5;
        boosts.push("+5 contiene palabras exactas");
    }
    
    // Boost por palabras clave principales (+5 - aumentado)
    const mainKeywords = ['bachillerato', 'fp', 'formación', 'teléfono', 'contacto', 'dirección'];
    const hasMainKeyword = mainKeywords.some(keyword => 
        chunk.text.toLowerCase().includes(keyword) && questionWords.includes(keyword)
    );
    if (hasMainKeyword) {
        totalScore += 5;
        boosts.push("+5 palabra clave principal");
    }
    
    // Boost especial para términos exactos de bachillerato (+8)
    if (questionWords.some(word => word.includes('bachillerato')) && 
        chunk.text.toLowerCase().includes('bachillerato')) {
        totalScore += 8;
        boosts.push("+8 término exacto 'bachillerato'");
    }
    
    // Boost especial para términos exactos de FP/formación (+10)
    if ((questionWords.some(word => word.includes('fp') || word.includes('formación')) && 
        (chunk.text.toLowerCase().includes('formación profesional') || 
         chunk.text.toLowerCase().includes('fp') || 
         chunk.text.toLowerCase().includes('grado')))) {
        totalScore += 10;
        boosts.push("+10 término exacto 'formación profesional'");
    }
    
    // Boost extra para chunks que contienen "Formación Profesional" explícitamente (+8)
    if (chunk.text.toLowerCase().includes('formación profesional') &&
        questionWords.some(word => word.includes('fp') || word.includes('formación'))) {
        totalScore += 8;
        boosts.push("+8 contiene 'Formación Profesional'");
    }
    
    // Boost especial para términos de ubicación (+8)
    if ((questionWords.some(word => word.includes('dónde') || word.includes('ubicación') || word.includes('dirección') || word.includes('está')) && 
        (chunk.text.toLowerCase().includes('ubicación') || 
         chunk.text.toLowerCase().includes('c/') || 
         chunk.text.toLowerCase().includes('borja') ||
         chunk.text.toLowerCase().includes('zaragoza')))) {
        totalScore += 8;
        boosts.push("+8 término exacto 'ubicación'");
    }
    
    // Boost especial para términos de contacto (+7)
    if ((questionWords.some(word => word.includes('teléfono') || word.includes('contacto') || word.includes('email')) && 
        (chunk.text.toLowerCase().includes('teléfono') || 
         chunk.text.toLowerCase().includes('contacto') ||
         chunk.text.toLowerCase().includes('email')))) {
        totalScore += 7;
        boosts.push("+7 término exacto 'contacto'");
    }
    
    // Boost por substrings relevantes (+1)
    if (substringMatches > 0) {
        totalScore += 1;
        boosts.push("+1 substrings relevantes");
    }
    
    debugInfo.push(`Boosts: ${boosts.length > 0 ? boosts.join(', ') : 'ninguno'}`);
    
    // 4. PENALIZACIONES
    const penalties = [];
    
    // Penalización si chunk es genérico y no coincide con intención (-2)
    const genericKeywords = ['instituto', 'centro', 'educativo', 'secundaria'];
    const isGeneric = genericKeywords.some(keyword => chunk.text.toLowerCase().includes(keyword));
    if (isGeneric && chunk.source !== intent && intent !== 'general') {
        totalScore -= 2;
        penalties.push("-2 genérico sin coincidencia de intención");
    }
    
    // Penalización si no comparte ninguna palabra clave (-3)
    if (exactMatches === 0 && substringMatches === 0) {
        totalScore -= 3;
        penalties.push("-3 sin palabras clave comunes");
    }
    
    // Penalización si es demasiado corto (-1)
    if (chunk.text.length < 20) {
        totalScore -= 1;
        penalties.push("-1 demasiado corto");
    }
    
    debugInfo.push(`Penalizaciones: ${penalties.length > 0 ? penalties.join(', ') : 'ninguna'}`);
    
    // 5. LOG FINAL
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
    detectIntent
};
