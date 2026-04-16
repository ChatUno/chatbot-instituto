const { handleUserQuery } = require('./chatbot-backend.js');

async function debugBackendFlow() {
    console.log('🔍 DEBUG DEL FLUJO COMPLETO DEL BACKEND');
    console.log('='.repeat(60));
    
    const testQuestions = [
        '¿Qué bachilleratos hay?',
        '¿Dónde está el instituto?',
        '¿Cuál es el teléfono?'
    ];
    
    for (const question of testQuestions) {
        console.log(`\n--- PREGUNTA: "${question}" ---`);
        
        try {
            const response = await handleUserQuery(question);
            console.log(`RESPUESTA FINAL: "${response}"`);
            console.log(`LONGITUD: ${response.length} caracteres`);
            
            // Analizar si es una respuesta válida
            const isFallback = response.toLowerCase().includes('no dispongo') || 
                              response.toLowerCase().includes('no tengo') ||
                              response.toLowerCase().includes('no encuentro');
            
            console.log(`ES FALLBACK: ${isFallback}`);
            
        } catch (error) {
            console.log(`ERROR: ${error.message}`);
            console.log(`STACK: ${error.stack}`);
        }
        
        console.log('-'.repeat(40));
    }
}

if (require.main === module) {
    debugBackendFlow().catch(console.error);
}

module.exports = { debugBackendFlow };
