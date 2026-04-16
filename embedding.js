/**
 * Detecta la intención de la pregunta del usuario
 * @param {string} question - Pregunta del usuario
 * @returns {string} - Intención detectada: "oferta", "calendario", "contacto", "general"
 */
function detectIntent(question) {
    const questionLower = question.toLowerCase();
    
    // Palabras clave por intención
    const keywords = {
        oferta: [
            'bachillerato', 'fp', 'grado', 'estudios', 'asignaturas', 
            'carrera', 'educación', 'formación', 'ciclo', 'módulo',
            'qué estudiar', 'qué hay', 'oferta', 'cursos'
        ],
        calendario: [
            'fecha', 'horario', 'clases', 'cuándo', 'exámenes', 
            'vacaciones', 'festivo', 'semestre', 'trimestre', 'calendario'
        ],
        contacto: [
            'teléfono', 'email', 'dirección', 'ubicación', 'dónde', 
            'lugar', 'centro', 'instituto', 'contacto'
        ]
    };
    
    // Contar coincidencias por intención
    const scores = {
        oferta: 0,
        calendario: 0,
        contacto: 0
    };
    
    // Calcular puntuación por intención
    for (const [intent, words] of Object.entries(keywords)) {
        words.forEach(word => {
            if (questionLower.includes(word)) {
                scores[intent]++;
            }
        });
    }
    
    // Determinar intención con mayor puntuación
    const maxScore = Math.max(...Object.values(scores));
    
    if (maxScore === 0) {
        return 'general';
    }
    
    const detectedIntent = Object.keys(scores).find(intent => scores[intent] === maxScore);
    if (process.env.NODE_ENV === 'development') {
        console.log(`Intención detectada: ${detectedIntent} (score: ${maxScore})`);
    }
    
    return detectedIntent;
}

/**
 * Calcula score inteligente basado en intención y palabras clave
 * @param {string} question - Pregunta del usuario
 * @param {Object} chunk - Chunk con text y source
 * @param {string} intent - Intención detectada
 * @returns {number} - Score calculado
 */
function calculateScore(question, chunk, intent) {
    const questionLower = question.toLowerCase();
    const chunkText = chunk.text.toLowerCase();
    let score = 0;
    let intentMatched = false;
    
    // A) BONUS POR INTENCIÓN COINCIDENTE (aplicar solo una vez)
    if (intent === chunk.source) {
        score += 5;
        intentMatched = true;
        if (process.env.NODE_ENV === 'development') {
            console.log(`  +5 bonus intención coincidente (${intent} = ${chunk.source})`);
        }
    }
    
    // B) PALABRAS CLAVE FUERTES (BOOST) - solo si no hay coincidencia directa de intención
    if (!intentMatched) {
        const keywordBoosts = {
            oferta: ['bachillerato', 'fp', 'grado', 'estudios', 'asignaturas'],
            calendario: ['fecha', 'horario', 'clases', 'cuándo', 'exámenes'],
            contacto: ['teléfono', 'email', 'dirección', 'ubicación']
        };
        
        if (keywordBoosts[intent]) {
            keywordBoosts[intent].forEach(keyword => {
                if (questionLower.includes(keyword)) {
                    score += 3;
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`  +3 boost palabra clave "${keyword}"`);
                    }
                }
            });
        }
    }
    
    // C) COINCIDENCIA DE PALABRAS (BÁSICO MEJORADO)
    const questionWords = questionLower
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => word.replace(/[^\wáéíóúñü]/g, ''));
    
    questionWords.forEach(word => {
        // Palabra exacta
        if (chunkText.includes(word)) {
            score += 2;
            if (process.env.NODE_ENV === 'development') {
                console.log(`  +2 palabra exacta "${word}"`);
            }
        }
        
        // Substring match
        const chunkWords = chunkText.split(/\s+/);
        chunkWords.forEach(chunkWord => {
            if (chunkWord.includes(word) || word.includes(chunkWord)) {
                score += 1;
                if (process.env.NODE_ENV === 'development') {
                    console.log(`  +1 substring "${word}"`);
                }
            }
        });
    });
    
    // D) PENALIZACIÓN DE RUIDO
    if (chunk.source === 'centro' && chunk.text.length < 50) {
        score -= 2;
        if (process.env.NODE_ENV === 'development') {
            console.log('  -2 penalización ruido centro genérico');
        }
    }
    
    if (chunk.text.length < 20) {
        score -= 1;
        if (process.env.NODE_ENV === 'development') {
            console.log('  -1 penalización texto muy corto');
        }
    }
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`Score final para chunk: ${score}`);
    }
    
    return score;
}

/**
 * Búsqueda inteligente con scoring mejorado
 * @param {string} question - Pregunta del usuario
 * @param {Array} chunks - Array de chunks con text y source
 * @returns {Array} - Chunks con scores de similitud
 */
function simpleSearch(question, chunks) {
    if (process.env.NODE_ENV === 'development') {
        console.log("Iniciando búsqueda inteligente para:", question);
    }
    
    // 1. Detectar intención
    const intent = detectIntent(question);
    
    // 2. MEJORA CRÍTICA: Forzar prioridad para preguntas sobre estudios
    const studyKeywords = ['qué bachilleratos', 'qué fp', 'qué estudios', 'qué grados'];
    const forceOferta = studyKeywords.some(keyword => question.toLowerCase().includes(keyword));
    
    if (forceOferta && process.env.NODE_ENV === 'development') {
        console.log("FORZANDO prioridad a chunks 'oferta'");
    }
    
    // 3. Calcular score para cada chunk
    const results = chunks.map(chunk => {
        let score = calculateScore(question, chunk, intent);
        
        // Aplicar fuerza de prioridad si corresponde
        if (forceOferta && chunk.source === 'oferta') {
            score += 10; // Boost masivo para asegurar prioridad
            if (process.env.NODE_ENV === 'development') {
                console.log('  +10 BOOST FORZADO para oferta');
            }
        }
        
        return {
            text: chunk.text,
            source: chunk.source,
            score: score
        };
    });
    
    // 4. E) NORMALIZACIÓN - filtrar scores bajos
    const validResults = results.filter(result => result.score >= 2);
    
    // 5. Ordenar por score (mayor a menor)
    validResults.sort((a, b) => b.score - a.score);
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`Búsqueda inteligente completada. Top 3 scores:`, 
            validResults.slice(0, 3).map(r => `${r.score.toFixed(1)} (${r.source})`));
    }
    
    return validResults;
}

module.exports = {
    simpleSearch
};
