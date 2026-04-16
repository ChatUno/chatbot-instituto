/**
 * Script para optimizar chunks - V4-12-T1
 * Ejecuta la optimización de calidad de chunks y genera reportes
 */

const { createChunkQualityManager } = require('./chunk-quality-manager');
const fs = require('fs').promises;
const path = require('path');

/**
 * Ejecuta la optimización de chunks
 */
async function optimizeChunks() {
    console.log('=== CHUNK QUALITY OPTIMIZATION V4-12-T1 ===\n');
    
    try {
        // 1. Crear el gestor de calidad
        const qualityManager = createChunkQualityManager({
            minChunkLength: 15,
            maxChunkLength: 800,
            optimalChunkLength: 120,
            qualityThresholds: {
                poor: 0.3,
                fair: 0.5,
                good: 0.7,
                excellent: 0.9
            },
            deduplicationThreshold: 0.85
        });
        
        console.log('Chunk Quality Manager initialized');
        console.log('Configuration:');
        console.log(`  - Min length: ${qualityManager.options.minChunkLength}`);
        console.log(`  - Max length: ${qualityManager.options.maxChunkLength}`);
        console.log(`  - Optimal length: ${qualityManager.options.optimalChunkLength}`);
        console.log(`  - Deduplication threshold: ${qualityManager.options.deduplicationThreshold}`);
        console.log('');
        
        // 2. Cargar chunks existentes
        const chunksPath = path.join(__dirname, 'data', 'chunks.json');
        console.log(`Loading chunks from: ${chunksPath}`);
        
        const originalChunks = await qualityManager.loadChunks(chunksPath);
        console.log(`Loaded ${originalChunks.length} chunks\n`);
        
        // 3. Analizar calidad actual
        console.log('=== CURRENT QUALITY ANALYSIS ===');
        const currentAnalyses = originalChunks.map(chunk => qualityManager.analyzeChunkQuality(chunk));
        const currentReport = qualityManager.generateQualityReport(currentAnalyses);
        
        console.log(`Total chunks: ${currentReport.total}`);
        console.log(`Average quality score: ${currentReport.avgQuality}`);
        console.log('\nQuality distribution:');
        Object.entries(currentReport.qualityDistribution).forEach(([quality, count]) => {
            const percentage = ((count / currentReport.total) * 100).toFixed(1);
            console.log(`  - ${quality}: ${count} (${percentage}%)`);
        });
        
        console.log('\nCategory distribution:');
        Object.entries(currentReport.byCategory).forEach(([category, count]) => {
            const percentage = ((count / currentReport.total) * 100).toFixed(1);
            console.log(`  - ${category}: ${count} (${percentage}%)`);
        });
        
        // 4. Encontrar duplicados
        console.log('\n=== DUPLICATE ANALYSIS ===');
        const duplicates = qualityManager.findDuplicates(originalChunks);
        console.log(`Found ${duplicates.length} duplicate groups`);
        
        if (duplicates.length > 0) {
            console.log('\nDuplicate examples:');
            duplicates.slice(0, 3).forEach((dup, index) => {
                console.log(`\nDuplicate ${index + 1}:`);
                console.log(`  Similarity: ${(dup.similarity * 100).toFixed(1)}%`);
                console.log(`  Chunk 1: "${dup.chunk1.text.substring(0, 100)}..."`);
                console.log(`  Chunk 2: "${dup.chunk2.text.substring(0, 100)}..."`);
                console.log(`  Recommendation: ${dup.recommendation}`);
            });
        }
        
        // 5. Ejecutar optimización
        console.log('\n=== CHUNK OPTIMIZATION ===');
        const optimizationResult = qualityManager.optimizeChunks(originalChunks);
        
        console.log(`Original chunks: ${optimizationResult.original.length}`);
        console.log(`Optimized chunks: ${optimizationResult.optimized.length}`);
        console.log(`Removed chunks: ${optimizationResult.removed.length}`);
        console.log(`Merged chunks: ${optimizationResult.merged.length}`);
        console.log(`Improved chunks: ${optimizationResult.improved.length}`);
        
        // 6. Analizar calidad post-optimización
        console.log('\n=== POST-OPTIMIZATION QUALITY ANALYSIS ===');
        const optimizedAnalyses = optimizationResult.optimized.map(chunk => qualityManager.analyzeChunkQuality(chunk));
        const optimizedReport = qualityManager.generateQualityReport(optimizedAnalyses);
        
        console.log(`Total optimized chunks: ${optimizedReport.total}`);
        console.log(`Average quality score: ${optimizedReport.avgQuality}`);
        console.log('\nOptimized quality distribution:');
        Object.entries(optimizedReport.qualityDistribution).forEach(([quality, count]) => {
            const percentage = ((count / optimizedReport.total) * 100).toFixed(1);
            console.log(`  - ${quality}: ${count} (${percentage}%)`);
        });
        
        // 7. Mostrar mejoras
        if (optimizationResult.improved.length > 0) {
            console.log('\n=== IMPROVEMENT EXAMPLES ===');
            optimizationResult.improved.slice(0, 3).forEach((improvement, index) => {
                console.log(`\nImprovement ${index + 1}:`);
                console.log(`  Original: "${improvement.original.text}"`);
                console.log(`  Improved: "${improvement.improved.text}"`);
                console.log(`  Suggestions: ${improvement.improvements.join(', ')}`);
            });
        }
        
        // 8. Mostrar chunks eliminados
        if (optimizationResult.removed.length > 0) {
            console.log('\n=== REMOVED CHUNKS ===');
            optimizationResult.removed.slice(0, 5).forEach((chunk, index) => {
                console.log(`${index + 1}. "${chunk.text}" (ID: ${chunk.id})`);
            });
            
            if (optimizationResult.removed.length > 5) {
                console.log(`... and ${optimizationResult.removed.length - 5} more`);
            }
        }
        
        // 9. Guardar chunks optimizados
        console.log('\n=== SAVING OPTIMIZED CHUNKS ===');
        const optimizedPath = path.join(__dirname, 'data', 'chunks-optimized.json');
        const backupPath = path.join(__dirname, 'data', 'chunks-backup.json');
        
        // Crear backup
        await fs.copyFile(chunksPath, backupPath);
        console.log(`Backup created: ${backupPath}`);
        
        // Guardar optimizados
        const saved = await qualityManager.saveOptimizedChunks(optimizationResult.optimized, optimizedPath);
        
        if (saved) {
            console.log(`Optimized chunks saved: ${optimizedPath}`);
            
            // Reemplazar original si se confirma
            console.log('\n=== REPLACING ORIGINAL CHUNKS ===');
            await fs.copyFile(optimizedPath, chunksPath);
            console.log(`Original chunks replaced with optimized version`);
        } else {
            console.error('Failed to save optimized chunks');
        }
        
        // 10. Generar reporte completo
        console.log('\n=== OPTIMIZATION SUMMARY ===');
        const improvement = optimizedReport.avgQuality - currentReport.avgQuality;
        
        console.log(`Quality improvement: +${improvement.toFixed(2)} points`);
        console.log(`Chunk reduction: ${originalChunks.length - optimizationResult.optimized.length} chunks`);
        console.log(`Reduction percentage: ${((originalChunks.length - optimizationResult.optimized.length) / originalChunks.length * 100).toFixed(1)}%`);
        
        // Calcular métricas de mejora
        const qualityImprovement = {};
        Object.keys(currentReport.qualityDistribution).forEach(quality => {
            const current = currentReport.qualityDistribution[quality];
            const optimized = optimizedReport.qualityDistribution[quality];
            qualityImprovement[quality] = optimized - current;
        });
        
        console.log('\nQuality changes:');
        Object.entries(qualityImprovement).forEach(([quality, change]) => {
            const direction = change >= 0 ? '+' : '';
            console.log(`  - ${quality}: ${direction}${change} chunks`);
        });
        
        // 11. Guardar reporte
        const reportPath = path.join(__dirname, 'logs', 'chunk-optimization-report.json');
        const reportData = {
            timestamp: new Date().toISOString(),
            configuration: qualityManager.options,
            original: {
                count: originalChunks.length,
                qualityReport: currentReport
            },
            optimized: {
                count: optimizationResult.optimized.length,
                qualityReport: optimizedReport
            },
            improvements: {
                qualityScore: improvement,
                chunkReduction: originalChunks.length - optimizationResult.optimized.length,
                duplicatesRemoved: duplicates.length,
                chunksImproved: optimizationResult.improved.length
            },
            duplicates: duplicates,
            removed: optimizationResult.removed,
            improved: optimizationResult.improved
        };
        
        try {
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
            console.log(`\nDetailed report saved: ${reportPath}`);
        } catch (error) {
            console.error('Error saving report:', error);
        }
        
        console.log('\n=== CHUNK OPTIMIZATION COMPLETED ===');
        console.log('V4-12-T1: Improve Chunk Quality Management - COMPLETED');
        
        return true;
        
    } catch (error) {
        console.error('Error during chunk optimization:', error);
        return false;
    }
}

/**
 * Ejecutar si se llama directamente
 */
if (require.main === module) {
    optimizeChunks().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    optimizeChunks
};
