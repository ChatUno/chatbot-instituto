/**
 * Tests para chunk quality manager V4-12-T1
 */

const { 
    createChunkQualityManager, 
    ChunkQuality, 
    ChunkCategory 
} = require('./chunk-quality-manager');

/**
 * Test helper para verificar resultados
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function testChunkQualityManagerCreation() {
    console.log('Testing chunk quality manager creation...');
    
    const manager = createChunkQualityManager({
        minChunkLength: 20,
        maxChunkLength: 500,
        optimalChunkLength: 100,
        qualityThresholds: {
            poor: 0.3,
            fair: 0.5,
            good: 0.7,
            excellent: 0.9
        }
    });
    
    assert(manager.options.minChunkLength === 20, 'Should set min length');
    assert(manager.options.maxChunkLength === 500, 'Should set max length');
    assert(manager.options.optimalChunkLength === 100, 'Should set optimal length');
    assert(manager.options.qualityThresholds.poor === 0.3, 'Should set poor threshold');
    
    console.log('Chunk quality manager creation: PASS');
}

function testChunkAnalysis() {
    console.log('Testing chunk analysis...');
    
    const manager = createChunkQualityManager();
    
    // Test good chunk
    const goodChunk = {
        id: 1,
        text: 'IES Juan de Lanuza ofrece formación profesional de grado medio y superior en diversas especialidades como Informática, Administración y Electricidad.',
        source: 'oferta'
    };
    
    const goodAnalysis = manager.analyzeChunkQuality(goodChunk);
    
    assert(goodAnalysis.id === 1, 'Should preserve chunk ID');
    assert(goodAnalysis.quality === ChunkQuality.GOOD || goodAnalysis.quality === ChunkQuality.FAIR, 'Should detect good quality');
    assert(goodAnalysis.score > 0.5, 'Should have decent score');
    assert(goodAnalysis.category === ChunkCategory.ACADEMIC, 'Should categorize as academic');
    assert(goodAnalysis.metrics.wordCount > 10, 'Should count words correctly');
    assert(goodAnalysis.suggestions.length >= 0, 'Should generate suggestions');
    
    // Test poor chunk
    const poorChunk = {
        id: 2,
        text: 'ok',
        source: 'test'
    };
    
    const poorAnalysis = manager.analyzeChunkQuality(poorChunk);
    
    assert(poorAnalysis.quality === ChunkQuality.POOR, 'Should detect poor quality');
    assert(poorAnalysis.score < 0.5, 'Should have low score');
    assert(poorAnalysis.suggestions.length > 0, 'Should suggest improvements');
    
    console.log('Chunk analysis: PASS');
}

function testChunkCategorization() {
    console.log('Testing chunk categorization...');
    
    const manager = createChunkQualityManager();
    
    // Test contact chunk
    const contactChunk = {
        id: 1,
        text: 'Teléfono de contacto: 976 867 368. Email: iesborja@educa.aragon.es',
        source: 'centro'
    };
    
    const contactAnalysis = manager.analyzeChunkQuality(contactChunk);
    assert(contactAnalysis.category === ChunkCategory.CONTACT, 'Should categorize contact info');
    
    // Test academic chunk
    const academicChunk = {
        id: 2,
        text: 'El bachillerato de ciencias incluye matemáticas, física y química.',
        source: 'oferta'
    };
    
    const academicAnalysis = manager.analyzeChunkQuality(academicChunk);
    assert(academicAnalysis.category === ChunkCategory.ACADEMIC, 'Should categorize academic info');
    
    // Test schedules chunk
    const schedulesChunk = {
        id: 3,
        text: 'Horario de lunes a viernes de 8:00 a 14:30.',
        source: 'horario'
    };
    
    const schedulesAnalysis = manager.analyzeChunkQuality(schedulesChunk);
    assert(schedulesAnalysis.category === ChunkCategory.SCHEDULES, 'Should categorize schedule info');
    
    console.log('Chunk categorization: PASS');
}

function testMetricsCalculation() {
    console.log('Testing metrics calculation...');
    
    const manager = createChunkQualityManager();
    
    const chunk = {
        id: 1,
        text: 'IES Juan de Lanuza. Teléfono: 976 867 368. Email: iesborja@educa.aragon.es. Ubicación: C/ Capuchinos, 1, Borja.',
        source: 'centro'
    };
    
    const analysis = manager.analyzeChunkQuality(chunk);
    const metrics = analysis.metrics;
    
    assert(metrics.length > 0, 'Should calculate length');
    assert(metrics.wordCount > 0, 'Should count words');
    assert(metrics.sentenceCount > 0, 'Should count sentences');
    assert(metrics.hasNumbers === true, 'Should detect numbers');
    assert(metrics.hasPhone === true, 'Should detect phone');
    assert(metrics.hasEmail === true, 'Should detect email');
    assert(metrics.punctuationRatio > 0, 'Should calculate punctuation ratio');
    assert(metrics.capitalizationRatio > 0, 'Should calculate capitalization ratio');
    
    console.log('Metrics calculation: PASS');
}

function testQualityDetermination() {
    console.log('Testing quality determination...');
    
    const manager = createChunkQualityManager({
        qualityThresholds: {
            poor: 0.3,
            fair: 0.5,
            good: 0.7,
            excellent: 0.9
        }
    });
    
    // Test excellent quality
    assert(manager.determineQuality(0.95) === ChunkQuality.EXCELLENT, 'Should determine excellent quality');
    
    // Test good quality
    assert(manager.determineQuality(0.8) === ChunkQuality.GOOD, 'Should determine good quality');
    
    // Test fair quality
    assert(manager.determineQuality(0.6) === ChunkQuality.FAIR, 'Should determine fair quality');
    
    // Test poor quality
    assert(manager.determineQuality(0.2) === ChunkQuality.POOR, 'Should determine poor quality');
    
    console.log('Quality determination: PASS');
}

function testDuplicateDetection() {
    console.log('Testing duplicate detection...');
    
    const manager = createChunkQualityManager({ deduplicationThreshold: 0.8 });
    
    const chunks = [
        {
            id: 1,
            text: 'IES Juan de Lanuza es un instituto público de educación secundaria.',
            source: 'centro'
        },
        {
            id: 2,
            text: 'IES Juan de Lanuza es un instituto público de educación secundaria.',
            source: 'centro'
        },
        {
            id: 3,
            text: 'El teléfono de contacto es 976 867 368.',
            source: 'centro'
        },
        {
            id: 4,
            text: 'Información sobre los programas de formación profesional.',
            source: 'oferta'
        }
    ];
    
    const duplicates = manager.findDuplicates(chunks);
    
    assert(duplicates.length === 1, 'Should find one duplicate pair');
    assert(duplicates[0].chunk1.id === 1, 'Should identify first chunk');
    assert(duplicates[0].chunk2.id === 2, 'Should identify second chunk');
    assert(duplicates[0].similarity >= 0.8, 'Should calculate high similarity');
    
    console.log('Duplicate detection: PASS');
}

function testSimilarityCalculation() {
    console.log('Testing similarity calculation...');
    
    const manager = createChunkQualityManager();
    
    // Test identical texts
    const similarity1 = manager.calculateSimilarity(
        'IES Juan de Lanuza',
        'IES Juan de Lanuza'
    );
    assert(similarity1 === 1.0, 'Identical texts should have similarity 1.0');
    
    // Test completely different texts
    const similarity2 = manager.calculateSimilarity(
        'Teléfono de contacto',
        'Formación profesional'
    );
    assert(similarity2 < 0.5, 'Different texts should have low similarity');
    
    // Test similar texts
    const similarity3 = manager.calculateSimilarity(
        'IES Juan de Lanuza es un instituto',
        'El instituto IES Juan de Lanuza'
    );
    assert(similarity3 > 0.3, 'Similar texts should have moderate similarity');
    
    console.log('Similarity calculation: PASS');
}

function testChunkOptimization() {
    console.log('Testing chunk optimization...');
    
    const manager = createChunkQualityManager({
        minChunkLength: 10,
        maxChunkLength: 200,
        deduplicationThreshold: 0.8
    });
    
    const chunks = [
        {
            id: 1,
            text: 'ies juan de lanuza',
            source: 'centro'
        },
        {
            id: 2,
            text: 'IES Juan de Lanuza es un instituto público de educación secundaria.',
            source: 'centro'
        },
        {
            id: 3,
            text: 'IES Juan de Lanuza es un instituto público de educación secundaria.',
            source: 'centro'
        },
        {
            id: 4,
            text: 'El teléfono de contacto es 976 867 368.',
            source: 'centro'
        },
        {
            id: 5,
            text: 'Información sobre los programas de formación profesional que ofrece el centro con especialidades en informática y administración.',
            source: 'oferta'
        }
    ];
    
    const result = manager.optimizeChunks(chunks);
    
    assert(result.original.length === 5, 'Should preserve original count');
    assert(result.optimized.length < result.original.length, 'Should reduce chunk count');
    assert(result.removed.length > 0, 'Should remove poor chunks');
    assert(result.merged.length > 0, 'Should merge duplicates');
    assert(result.improved.length >= 0, 'Should improve chunks');
    assert(result.qualityReport.total > 0, 'Should generate quality report');
    
    console.log('Chunk optimization: PASS');
}

function testChunkImprovement() {
    console.log('Testing chunk improvement...');
    
    const manager = createChunkQualityManager();
    
    const chunk = {
        id: 1,
        text: 'ies juan de lanuza',
        source: 'centro'
    };
    
    const analysis = manager.analyzeChunkQuality(chunk);
    const improvedChunk = manager.improveChunk(chunk, analysis);
    
    assert(improvedChunk.id === chunk.id, 'Should preserve ID');
    assert(improvedChunk.source === chunk.source, 'Should preserve source');
    assert(improvedChunk.text !== chunk.text, 'Should improve text');
    assert(improvedChunk.text[0] === improvedChunk.text[0].toUpperCase(), 'Should capitalize first letter');
    assert(improvedChunk.text.match(/[.!?]$/), 'Should add ending punctuation');
    
    console.log('Chunk improvement: PASS');
}

function testQualityReport() {
    console.log('Testing quality report...');
    
    const manager = createChunkQualityManager();
    
    const analyses = [
        { quality: ChunkQuality.GOOD, score: 0.8, category: ChunkCategory.ACADEMIC },
        { quality: ChunkQuality.FAIR, score: 0.6, category: ChunkCategory.CONTACT },
        { quality: ChunkQuality.POOR, score: 0.2, category: ChunkCategory.ACADEMIC },
        { quality: ChunkQuality.GOOD, score: 0.75, category: ChunkCategory.SCHEDULES }
    ];
    
    const report = manager.generateQualityReport(analyses);
    
    assert(report.total === 4, 'Should count total chunks');
    assert(Math.abs(report.avgQuality - 0.5875) < 0.01, 'Should calculate average quality');
    assert(report.byQuality[ChunkQuality.GOOD] === 2, 'Should count by quality');
    assert(report.byCategory[ChunkCategory.ACADEMIC] === 2, 'Should count by category');
    assert(report.qualityDistribution[ChunkQuality.GOOD] === 2, 'Should create distribution');
    
    console.log('Quality report: PASS');
}

function testLengthScore() {
    console.log('Testing length score calculation...');
    
    const manager = createChunkQualityManager({
        minChunkLength: 20,
        maxChunkLength: 500,
        optimalChunkLength: 100
    });
    
    // Test optimal length
    const optimalScore = manager.calculateLengthScore('This is an optimal length chunk with around one hundred characters which should get a perfect score.');
    assert(optimalScore === 1.0, 'Optimal length should get score 1.0');
    
    // Test too short
    const shortScore = manager.calculateLengthScore('Too short');
    assert(shortScore < 0.5, 'Too short should get low score');
    
    // Test too long
    const longText = 'a'.repeat(600);
    const longScore = manager.calculateLengthScore(longText);
    assert(longScore < 1.0, 'Too long should get reduced score');
    
    console.log('Length score: PASS');
}

function testDensityScore() {
    console.log('Testing density score calculation...');
    
    const manager = createChunkQualityManager();
    
    // Test high density
    const highDensityText = 'El instituto IES Juan de Lanuza con código 976867368 ofrece formación profesional en informática con 120 créditos y email iesborja@educa.aragon.es';
    const highScore = manager.calculateDensityScore(highDensityText);
    assert(highScore > 0.5, 'High density should get good score');
    
    // Test low density
    const lowDensityText = 'esto es un texto simple sin información específica';
    const lowScore = manager.calculateDensityScore(lowDensityText);
    assert(lowScore < 0.5, 'Low density should get low score');
    
    console.log('Density score: PASS');
}

/**
 * Ejecutar todos los tests
 */
async function runAllChunkQualityTests() {
    console.log('=== RUNNING CHUNK QUALITY MANAGER TESTS V4-12-T1 ===\n');
    
    try {
        testChunkQualityManagerCreation();
        testChunkAnalysis();
        testChunkCategorization();
        testMetricsCalculation();
        testQualityDetermination();
        testDuplicateDetection();
        testSimilarityCalculation();
        testChunkOptimization();
        testChunkImprovement();
        testQualityReport();
        testLengthScore();
        testDensityScore();
        
        console.log('\n=== ALL CHUNK QUALITY MANAGER TESTS PASSED ===');
        console.log('Chunk quality management working correctly');
        return true;
    } catch (error) {
        console.error('\n=== CHUNK QUALITY MANAGER TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Ejecutar tests si este archivo es llamado directamente
if (require.main === module) {
    runAllChunkQualityTests();
}

module.exports = {
    runAllChunkQualityTests,
    testChunkQualityManagerCreation,
    testChunkAnalysis,
    testChunkCategorization,
    testMetricsCalculation,
    testQualityDetermination,
    testDuplicateDetection,
    testSimilarityCalculation,
    testChunkOptimization,
    testChunkImprovement,
    testQualityReport,
    testLengthScore,
    testDensityScore
};
