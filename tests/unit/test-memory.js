const { handleUserQuery } = require('./chatbot-backend.js');

async function testConversationalMemory() {
    console.log('🧠 TEST DE MEMORIA CONVERSACIONAL');
    console.log('='.repeat(50));
    
    // Limpiar memoria antes de empezar
    const { MemoryManager } = require('./memory-system.js');
    MemoryManager.clearMemory();
    
    const testSequence = [
        "¿Qué bachilleratos hay?",
        "¿y ese cuál es más difícil?",
        "¿cuál recomendarías?"
    ];
    
    for (const [index, question] of testSequence.entries()) {
        console.log(`\n--- Pregunta ${index + 1}: "${question}" ---`);
        console.log(`Estado memoria:`, MemoryManager.getStats());
        
        try {
            const response = await handleUserQuery(question);
            console.log(`Respuesta: "${response}"`);
            
            // Verificar si la respuesta es adecuada
            const isFallback = response.toLowerCase().includes('no dispongo');
            console.log(`Es fallback: ${isFallback}`);
            
            // Para preguntas 2 y 3, debería entender el contexto
            if (index > 0) {
                const hasContext = response.toLowerCase().includes('bachillerato') ||
                                 response.toLowerCase().includes('ciencias') ||
                                 response.toLowerCase().includes('tecnología') ||
                                 response.toLowerCase().includes('humanidades');
                console.log(`Mantiene contexto: ${hasContext}`);
            }
            
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
        
        console.log('-'.repeat(40));
    }
}

if (require.main === module) {
    testConversationalMemory().catch(console.error);
}

module.exports = { testConversationalMemory };
