/**
 * Unit Tests para funciones refactorizadas de embedding.js
 * V4-07-T2: Create unit tests for refactored functions
 */

const {
    calculateScore,
    calculateBaseScore,
    calculateIntelligentBoosts,
    calculatePenalties,
    detectIntent
} = require('./embedding.js');

/**
 * Test helper para verificar resultados
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function testCalculateBaseScore() {
    console.log('Testing calculateBaseScore...');
    
    const chunk = { text: 'IES Juan de Lanuza ofrece formación profesional', source: 'oferta' };
    const question = 'qué formación profesional hay';
    
    const result = calculateBaseScore(question, chunk);
    
    assert(typeof result.baseScore === 'number', 'baseScore should be number');
    assert(typeof result.exactMatches === 'number', 'exactMatches should be number');
    assert(typeof result.substringMatches === 'number', 'substringMatches should be number');
    assert(Array.isArray(result.debugInfo), 'debugInfo should be array');
    assert(result.baseScore > 0, 'baseScore should be positive for matches');
    
    console.log('calculateBaseScore: PASS');
}

function testCalculateIntelligentBoosts() {
    console.log('Testing calculateIntelligentBoosts...');
    
    const chunk = { text: 'FP de Informática', source: 'oferta' };
    const question = 'qué fp hay';
    const intent = 'oferta';
    
    const result = calculateIntelligentBoosts(intent, chunk, question);
    
    assert(typeof result.boostScore === 'number', 'boostScore should be number');
    assert(Array.isArray(result.debugInfo), 'debugInfo should be array');
    assert(result.boostScore >= 0, 'boostScore should be non-negative');
    
    // Test category match boost
    assert(result.debugInfo.some(info => info.includes('boost categoría')), 'Should have category boost');
    
    console.log('calculateIntelligentBoosts: PASS');
}

function testCalculatePenalties() {
    console.log('Testing calculatePenalties...');
    
    // Test chunk normal
    const normalChunk = { text: 'Este es un chunk de contenido normal y útil', source: 'centro' };
    const normalResult = calculatePenalties(normalChunk);
    assert(typeof normalResult.penalties === 'number', 'penalties should be number');
    assert(Array.isArray(normalResult.debugInfo), 'debugInfo should be array');
    
    // Test chunk muy largo
    const longChunk = { text: 'x'.repeat(1500), source: 'centro' };
    const longResult = calculatePenalties(longChunk);
    assert(longResult.penalties < 0, 'Long chunk should have penalties');
    assert(longResult.debugInfo.some(info => info.includes('demasiado largo')), 'Should mention too long');
    
    console.log('calculatePenalties: PASS');
}

function testCalculateScoreIntegration() {
    console.log('Testing calculateScore integration...');
    
    const chunk = { id: 1, text: 'FP de Informática en IES Juan de Lanuza', source: 'oferta' };
    const question = 'qué fp de informática hay';
    const intent = 'oferta';
    
    const result = calculateScore(question, chunk, intent);
    
    assert(typeof result.score === 'number', 'score should be number');
    assert(Array.isArray(result.debug), 'debug should be array');
    assert(typeof result.trace === 'object', 'trace should be object');
    assert(result.trace.chunk_id === 1, 'trace should have correct chunk_id');
    assert(result.score >= 0, 'score should be non-negative');
    assert(result.debug.length > 0, 'debug should have entries');
    
    console.log('calculateScore integration: PASS');
}

function testEdgeCases() {
    console.log('Testing edge cases...');
    
    // Test empty inputs
    const emptyChunk = { text: '', source: 'centro' };
    const emptyResult = calculateScore('test', emptyChunk, 'centro');
    assert(emptyResult.score === 0, 'Empty chunk should have score 0');
    
    // Test no tokens
    const noTokensChunk = { text: '!!!', source: 'centro' };
    const noTokensResult = calculateScore('!!!', noTokensChunk, 'centro');
    assert(noTokensResult.score === 0, 'No tokens should have score 0');
    
    console.log('Edge cases: PASS');
}

function testConfigurationValues() {
    console.log('Testing configuration values...');
    
    const chunk = { text: 'test chunk', source: 'oferta' };
    const question = 'test';
    const intent = 'oferta';
    
    const baseResult = calculateBaseScore(question, chunk);
    const boostResult = calculateIntelligentBoosts(intent, chunk, question);
    
    // Verificar que se usan valores de configuración
    assert(baseResult.debugInfo.some(info => info.includes('10')), 'Should use config exactMatch value');
    assert(boostResult.debugInfo.some(info => info.includes('8')), 'Should use config intentMatch value');
    
    console.log('Configuration values: PASS');
}

/**
 * Ejecutar todos los tests
 */
function runAllTests() {
    console.log('=== RUNNING UNIT TESTS FOR REFACTORED EMBEDDING ===\n');
    
    try {
        testCalculateBaseScore();
        testCalculateIntelligentBoosts();
        testCalculatePenalties();
        testCalculateScoreIntegration();
        testEdgeCases();
        testConfigurationValues();
        
        console.log('\n=== ALL TESTS PASSED ===');
        console.log('Refactored functions working correctly');
        return true;
    } catch (error) {
        console.error('\n=== TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Ejecutar tests si este archivo es llamado directamente
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testCalculateBaseScore,
    testCalculateIntelligentBoosts,
    testCalculatePenalties,
    testCalculateScoreIntegration,
    testEdgeCases,
    testConfigurationValues
};
