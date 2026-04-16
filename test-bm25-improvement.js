/**
 * Tests para BM25-Lite improvement V4-10-T1
 */

const {
    calculateBM25Score,
    preCalculateIDF,
    calculateIDF,
    calculateTF,
    calculateScore
} = require('./embedding.js');

/**
 * Test helper para verificar resultados
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function testCalculateTF() {
    console.log('Testing calculateTF...');
    
    const tokens = ['fp', 'informática', 'fp', 'juan', 'lanuza'];
    const tf = calculateTF(tokens);
    
    assert(tf.fp === 2, 'TF should count "fp" twice');
    assert(tf.informática === 1, 'TF should count "informática" once');
    assert(tf.juan === 1, 'TF should count "juan" once');
    assert(tf.lanuza === 1, 'TF should count "lanuza" once');
    
    console.log('calculateTF: PASS');
}

function testCalculateIDF() {
    console.log('Testing calculateIDF...');
    
    const documents = [
        ['fp', 'informática'],
        ['fp', 'juan', 'lanuza'],
        ['bachillerato', 'científico']
    ];
    
    const idf = calculateIDF(documents);
    
    // "fp" aparece en 2 de 3 documentos
    const expectedFP = Math.log((3 + 1) / (2 + 0.5)) + 1;
    assert(Math.abs(idf.fp - expectedFP) < 0.001, 'IDF calculation for "fp" should be correct');
    
    // "informática" aparece en 1 de 3 documentos
    const expectedInfo = Math.log((3 + 1) / (1 + 0.5)) + 1;
    assert(Math.abs(idf.informática - expectedInfo) < 0.001, 'IDF calculation for "informática" should be correct');
    
    console.log('calculateIDF: PASS');
}

function testPreCalculateIDF() {
    console.log('Testing preCalculateIDF...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta' },
        { id: 2, text: 'Bachillerato científico', source: 'centro' },
        { id: 3, text: 'Programas de orientación', source: 'programas' }
    ];
    
    const result = preCalculateIDF(chunks);
    
    assert(typeof result.idf === 'object', 'Should return IDF object');
    assert(typeof result.avgDocLength === 'number', 'Should return average document length');
    assert(result.documentCount === 3, 'Should count documents correctly');
    assert(result.avgDocLength > 0, 'Average length should be positive');
    
    console.log('preCalculateIDF: PASS');
}

function testBM25Score() {
    console.log('Testing calculateBM25Score...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática en IES Juan de Lanuza', source: 'oferta' },
        { id: 2, text: 'Bachillerato científico y tecnológico', source: 'centro' },
        { id: 3, text: 'Programas de orientación profesional', source: 'programas' }
    ];
    
    const idfData = preCalculateIDF(chunks);
    const query = 'qué fp hay';
    const chunk = chunks[0];
    
    const result = calculateBM25Score(query, chunk, idfData.idf, idfData.avgDocLength);
    
    assert(typeof result.score === 'number', 'Should return numeric score');
    assert(Array.isArray(result.debug), 'Should return debug info');
    assert(result.score >= 0, 'Score should be non-negative');
    assert(result.trace.algorithm === 'BM25', 'Should indicate BM25 algorithm');
    
    console.log('BM25 score:', result.score.toFixed(3));
    console.log('calculateBM25Score: PASS');
}

function testBM25VsHeuristic() {
    console.log('Testing BM25 vs Heuristic comparison...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática en IES Juan de Lanuza', source: 'oferta' },
        { id: 2, text: 'Bachillerato científico y tecnológico', source: 'centro' },
        { id: 3, text: 'Programas de orientación profesional', source: 'programas' }
    ];
    
    const idfData = preCalculateIDF(chunks);
    const query = 'qué fp hay';
    const chunk = chunks[0];
    
    // Test con BM25
    const bm25Result = calculateScore(query, chunk, 'oferta', {
        useBM25: true,
        idf: idfData.idf,
        avgDocLength: idfData.avgDocLength
    });
    
    // Test con heurístico
    const heuristicResult = calculateScore(query, chunk, 'oferta', {
        useBM25: false
    });
    
    assert(bm25Result.trace.algorithm === 'BM25', 'BM25 result should use BM25 algorithm');
    assert(heuristicResult.trace.algorithm === 'heuristic', 'Heuristic result should use heuristic algorithm');
    
    console.log('BM25 score:', bm25Result.score.toFixed(3));
    console.log('Heuristic score:', heuristicResult.score.toFixed(3));
    console.log('BM25 vs Heuristic: PASS');
}

function testBM25Parameters() {
    console.log('Testing BM25 parameters...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta' },
        { id: 2, text: 'Este es un documento muy largo con muchas palabras repetidas para probar el efecto de los parámetros BM25 documento documento largo', source: 'centro' },
        { id: 3, text: 'Corto', source: 'programas' }
    ];
    
    const idfData = preCalculateIDF(chunks);
    const query = 'documento'; // Usar un término que está en el documento largo
    const chunk = chunks[1]; // Usar el documento largo
    
    // Test con diferentes parámetros k1 y b
    const result1 = calculateBM25Score(query, chunk, idfData.idf, idfData.avgDocLength, 1.2, 0.75);
    const result2 = calculateBM25Score(query, chunk, idfData.idf, idfData.avgDocLength, 2.0, 0.5);
    
    assert(result1.score !== result2.score, 'Different parameters should produce different scores');
    
    console.log('Doc length:', chunk.text.split(/\s+/).length);
    console.log('Avg length:', idfData.avgDocLength.toFixed(2));
    console.log('k1=1.2, b=0.75 score:', result1.score.toFixed(3));
    console.log('k1=2.0, b=0.5 score:', result2.score.toFixed(3));
    console.log('BM25 parameters: PASS');
}

function testEdgeCases() {
    console.log('Testing edge cases...');
    
    const chunks = [
        { id: 1, text: 'FP de Informática', source: 'oferta' }
    ];
    
    const idfData = preCalculateIDF(chunks);
    
    // Test con query vacío
    const emptyQueryResult = calculateBM25Score('', chunks[0], idfData.idf, idfData.avgDocLength);
    assert(emptyQueryResult.score === 0, 'Empty query should return score 0');
    
    // Test con chunk vacío
    const emptyChunkResult = calculateBM25Score('fp', { text: '' }, idfData.idf, idfData.avgDocLength);
    assert(emptyChunkResult.score === 0, 'Empty chunk should return score 0');
    
    // Test con término no existente
    const noMatchResult = calculateBM25Score('término_inexistente', chunks[0], idfData.idf, idfData.avgDocLength);
    assert(noMatchResult.score === 0, 'Non-matching term should return score 0');
    
    console.log('Edge cases: PASS');
}

/**
 * Ejecutar todos los tests
 */
function runAllBM25Tests() {
    console.log('=== RUNNING BM25 IMPROVEMENT TESTS V4-10-T1 ===\n');
    
    try {
        testCalculateTF();
        testCalculateIDF();
        testPreCalculateIDF();
        testBM25Score();
        testBM25VsHeuristic();
        testBM25Parameters();
        testEdgeCases();
        
        console.log('\n=== ALL BM25 TESTS PASSED ===');
        console.log('BM25-Lite implementation working correctly');
        return true;
    } catch (error) {
        console.error('\n=== BM25 TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Ejecutar tests si este archivo es llamado directamente
if (require.main === module) {
    runAllBM25Tests();
}

module.exports = {
    runAllBM25Tests,
    testCalculateTF,
    testCalculateIDF,
    testPreCalculateIDF,
    testBM25Score,
    testBM25VsHeuristic,
    testBM25Parameters,
    testEdgeCases
};
