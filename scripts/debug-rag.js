const { semanticSearch, buildContextFromResults, loadChunks } = require('./search.js');

async function debugRAGSystem() {
    console.log('🔍 DEBUG DEL SISTEMA RAG');
    console.log('='.repeat(50));
    
    // 1. Verificar chunks cargados
    console.log('\n1. VERIFICANDO CHUNKS CARGADOS:');
    const chunks = loadChunks();
    console.log(`Total chunks: ${chunks.length}`);
    
    if (chunks.length > 0) {
        console.log('\nPrimeros 5 chunks:');
        chunks.slice(0, 5).forEach((chunk, index) => {
            console.log(`${index + 1}. ID: ${chunk.id} | Source: ${chunk.source} | Text: "${chunk.text.substring(0, 100)}..."`);
        });
    } else {
        console.log('❌ NO HAY CHUNKS DISPONIBLES');
        return;
    }
    
    // 2. Probar búsqueda con preguntas específicas
    const testQuestions = [
        '¿Qué bachilleratos hay?',
        '¿Qué FP hay?',
        '¿Dónde está el instituto?',
        '¿Cuál es el teléfono?'
    ];
    
    console.log('\n2. PROBANDO BÚSQUEDA SEMÁNTICA:');
    for (const question of testQuestions) {
        console.log(`\n--- Pregunta: "${question}" ---`);
        
        try {
            const results = semanticSearch(question, 3);
            console.log(`Resultados encontrados: ${results.length}`);
            
            if (results.length > 0) {
                results.forEach((result, index) => {
                    console.log(`  ${index + 1}. Score: ${result.score} | Source: ${result.source}`);
                    console.log(`     Text: "${result.text}"`);
                    if (result.debug) {
                        console.log(`     Debug: ${result.debug.slice(0, 3).join(', ')}...`);
                    }
                });
                
                // Probar construcción de contexto
                const context = buildContextFromResults(results, question);
                console.log(`\nContexto generado (${context.length} chars):`);
                console.log(context.substring(0, 300) + '...');
                
            } else {
                console.log('❌ NO SE ENCONTRARON RESULTADOS');
            }
        } catch (error) {
            console.log(`❌ ERROR EN BÚSQUEDA: ${error.message}`);
        }
    }
    
    // 3. Verificar archivos de datos originales
    console.log('\n3. VERIFICANDO ARCHIVOS DE DATOS ORIGINALES:');
    const fs = require('fs');
    const path = require('path');
    
    const dataFiles = [
        'data/estatico/oferta_educativa.txt',
        'data/estatico/centro.txt',
        'data/estatico/programas.txt',
        'data/dinamico/calendario.txt',
        'data/dinamico/avisos.txt',
        'data/dinamico/faq.txt'
    ];
    
    for (const filePath of dataFiles) {
        const fullPath = path.join(__dirname, filePath);
        try {
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                console.log(`✅ ${filePath}: ${content.length} caracteres`);
                if (content.trim().length > 0) {
                    console.log(`   Primeros 100 chars: "${content.substring(0, 100)}..."`);
                } else {
                    console.log(`   ⚠️ ARCHIVO VACÍO`);
                }
            } else {
                console.log(`❌ ${filePath}: ARCHIVO NO EXISTE`);
            }
        } catch (error) {
            console.log(`❌ ${filePath}: ERROR LEYENDO - ${error.message}`);
        }
    }
}

// Ejecutar debug si se llama directamente
if (require.main === module) {
    debugRAGSystem().catch(console.error);
}

module.exports = { debugRAGSystem };
