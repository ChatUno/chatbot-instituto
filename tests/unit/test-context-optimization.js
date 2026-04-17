/**
 * Tests para context optimization V4-11-T1
 */

const {
    buildIntelligentContext,
    calculateDiversity,
    selectOptimalChunks
} = require('./embedding.js');

/**
 * Test helper para verificar resultados
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function testCalculateDiversity() {
    console.log('Testing calculateDiversity...');
    
    // Test con chunks diversos
    const diverseChunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta' },
        { id: 2, text: 'Información del centro', source: 'centro' },
        { id: 3, text: 'Programas de orientación', source: 'programas' }
    ];
    
    const diverseScore = calculateDiversity(diverseChunks);
    assert(diverseScore > 0.8, 'Diverse chunks should have high diversity score');
    
    // Test con chunks similares
    const similarChunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta' },
        { id: 2, text: 'FP de Administración', source: 'oferta' },
        { id: 3, text: 'FP de Electricidad', source: 'oferta' }
    ];
    
    const similarScore = calculateDiversity(similarChunks);
    assert(similarScore < diverseScore, 'Similar chunks should have lower diversity score');
    
    console.log('Diverse score:', diverseScore.toFixed(3));
    console.log('Similar score:', similarScore.toFixed(3));
    console.log('calculateDiversity: PASS');
}

function testSelectOptimalChunks() {
    console.log('Testing selectOptimalChunks...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta', score: 8.5 },
        { id: 2, text: 'FP de Administración', source: 'oferta', score: 8.0 },
        { id: 3, text: 'Información del centro', source: 'centro', score: 7.5 },
        { id: 4, text: 'Bachillerato científico', source: 'centro', score: 7.2 },
        { id: 5, text: 'Programas de orientación', source: 'programas', score: 6.8 }
    ];
    
    // Test con intención 'oferta'
    const ofertaChunks = selectOptimalChunks(chunks, 3, 'oferta');
    assert(ofertaChunks.length === 3, 'Should select exactly 3 chunks');
    assert(ofertaChunks[0].source === 'oferta', 'Should prioritize oferta chunks');
    
    // Test con intención 'centro'
    const centroChunks = selectOptimalChunks(chunks, 3, 'centro');
    assert(centroChunks.length === 3, 'Should select exactly 3 chunks');
    assert(centroChunks[0].source === 'centro', 'Should prioritize centro chunks');
    
    console.log('Oferta chunks selected:', ofertaChunks.map(c => c.source));
    console.log('Centro chunks selected:', centroChunks.map(c => c.source));
    console.log('selectOptimalChunks: PASS');
}

function testContextCache() {
    console.log('Testing context cache...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta', score: 8.5 },
        { id: 2, text: 'Información del centro', source: 'centro', score: 7.5 }
    ];
    
    const query = 'qué fp hay';
    const intent = 'oferta';
    
    // Primera llamada (should build from scratch)
    const context1 = buildIntelligentContext(query, chunks, intent, {
        useCache: true,
        maxChunks: 2
    });
    
    // Segunda llamada (should use cache)
    const context2 = buildIntelligentContext(query, chunks, intent, {
        useCache: true,
        maxChunks: 2
    });
    
    // Comparar normalizando espacios en blanco
    const normalized1 = context1.replace(/\s+/g, ' ').trim();
    const normalized2 = context2.replace(/\s+/g, ' ').trim();
    
    assert(normalized1 === normalized2, 'Cached context should be identical (normalized)');
    assert(context1.length > 0, 'Context should not be empty');
    assert(Math.abs(context1.length - context2.length) <= 5, 'Length difference should be minimal');
    
    console.log('Context1 length:', context1.length);
    console.log('Context2 length:', context2.length);
    console.log('Cache test: PASS');
}

function testContextOptimization() {
    console.log('Testing context optimization features...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática en IES Juan de Lanuza con programas de grado medio y superior', source: 'oferta', score: 8.5 },
        { id: 2, text: 'FP de Administración y Finanzas', source: 'oferta', score: 8.0 },
        { id: 3, text: 'Bachillerato científico y tecnológico', source: 'centro', score: 7.5 },
        { id: 4, text: 'Información general del centro', source: 'centro', score: 7.2 },
        { id: 5, text: 'Programas de orientación profesional', source: 'programas', score: 6.8 },
        { id: 6, text: 'Preguntas frecuentes sobre matrícula', source: 'faq', score: 6.5 }
    ];
    
    const query = 'qué fp hay';
    const intent = 'oferta';
    
    // Test con optimización activada
    const optimizedContext = buildIntelligentContext(query, chunks, intent, {
        maxChunks: 3,
        enableDiversity: true,
        useCache: false
    });
    
    // Test sin optimización
    const standardContext = buildIntelligentContext(query, chunks, intent, {
        maxChunks: 3,
        enableDiversity: false,
        useCache: false
    });
    
    assert(optimizedContext.length > 0, 'Optimized context should not be empty');
    assert(standardContext.length > 0, 'Standard context should not be empty');
    assert(optimizedContext.includes('FORMACIÓN PROFESIONAL'), 'Should include section headers');
    
    console.log('Optimized context length:', optimizedContext.length);
    console.log('Standard context length:', standardContext.length);
    console.log('Optimized preview:', optimizedContext.substring(0, 150) + '...');
    console.log('Context optimization: PASS');
}

function testContextLengthOptimization() {
    console.log('Testing context length optimization...');
    
    // Crear chunks grandes para probar truncación
    const largeChunks = [
        { id: 1, text: 'Este es un chunk muy largo con mucha información detallada sobre el FP de Informática que incluye todos los detalles del programa, horarios, requisitos, salidas profesionales y mucho más contenido para probar la optimización de longitud del contexto', source: 'oferta', score: 8.5 },
        { id: 2, text: 'Otro chunk muy largo con información detallada sobre el centro educativo, incluyendo historia, instalaciones, personal, recursos, programas, proyectos y toda la información relevante que podría ser útil para los estudiantes y padres', source: 'centro', score: 7.5 },
        { id: 3, text: 'Información adicional muy larga sobre programas de orientación profesional con todos los detalles sobre servicios, horarios de atención, personal especializado, recursos disponibles, programas específicos y toda la información necesaria', source: 'programas', score: 6.8 }
    ];
    
    const query = 'información completa';
    const intent = 'general';
    
    // Test con límite de longitud pequeño
    const shortContext = buildIntelligentContext(query, largeChunks, intent, {
        maxChunks: 3,
        maxContextLength: 200, // Límite muy pequeño
        enableDiversity: true,
        useCache: false
    });
    
    assert(shortContext.length <= 300, 'Context should respect length limit');
    assert(shortContext.includes('truncado'), 'Should indicate truncation');
    
    console.log('Short context length:', shortContext.length);
    console.log('Short context preview:', shortContext.substring(0, 200) + '...');
    console.log('Context length optimization: PASS');
}

function testDiversityAlgorithm() {
    console.log('Testing diversity algorithm effectiveness...');
    
    // Test caso 1: Chunks de alta diversidad
    const highDiversityChunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta', score: 8.5 },
        { id: 2, text: 'Información del centro', source: 'centro', score: 7.5 },
        { id: 3, text: 'Programas de orientación', source: 'programas', score: 6.8 }
    ];
    
    // Test caso 2: Chunks de baja diversidad
    const lowDiversityChunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta', score: 8.5 },
        { id: 2, text: 'FP de Administración', source: 'oferta', score: 8.0 },
        { id: 3, text: 'FP de Electricidad', source: 'oferta', score: 7.8 },
        { id: 4, text: 'FP de Electrónica', source: 'oferta', score: 7.5 }
    ];
    
    const highDiversityScore = calculateDiversity(highDiversityChunks);
    const lowDiversityScore = calculateDiversity(lowDiversityChunks.slice(0, 3));
    
    assert(highDiversityScore > lowDiversityScore, 'High diversity should score higher than low diversity');
    
    console.log('High diversity score:', highDiversityScore.toFixed(3));
    console.log('Low diversity score:', lowDiversityScore.toFixed(3));
    console.log('Diversity algorithm: PASS');
}

/**
 * Ejecutar todos los tests
 */
function runAllContextOptimizationTests() {
    console.log('=== RUNNING CONTEXT OPTIMIZATION TESTS V4-11-T1 ===\n');
    
    try {
        testCalculateDiversity();
        testSelectOptimalChunks();
        testContextCache();
        testContextOptimization();
        testContextLengthOptimization();
        testDiversityAlgorithm();
        
        console.log('\n=== ALL CONTEXT OPTIMIZATION TESTS PASSED ===');
        console.log('Context building optimization working correctly');
        return true;
    } catch (error) {
        console.error('\n=== CONTEXT OPTIMIZATION TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Ejecutar tests si este archivo es llamado directamente
if (require.main === module) {
    runAllContextOptimizationTests();
}

module.exports = {
    runAllContextOptimizationTests,
    testCalculateDiversity,
    testSelectOptimalChunks,
    testContextCache,
    testContextOptimization,
    testContextLengthOptimization,
    testDiversityAlgorithm
};
