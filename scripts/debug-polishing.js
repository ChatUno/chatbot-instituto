const { getAIResponse } = require('./ai-client.js');
const { semanticSearch, buildContextFromResults } = require('./search.js');
const { createDefinitivePromptSystem } = require('./prompt-system.js');
const { ResponsePolishingSystem } = require('./response-polishing.js');

async function debugPolishingFlow() {
    console.log('🔍 DEBUG DEL RESPONSE POLISHING');
    console.log('='.repeat(50));
    
    const question = '¿Dónde está el instituto?';
    
    // 1. Obtener resultados RAG
    console.log('\n1. OBTENIENDO RESULTADOS RAG:');
    const searchResults = semanticSearch(question, 3);
    console.log(`Resultados: ${searchResults.length}`);
    searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. Score: ${result.score} | Text: "${result.text}"`);
    });
    
    // 2. Construir contexto
    console.log('\n2. CONSTRUYENDO CONTEXTO:');
    const context = buildContextFromResults(searchResults, question);
    console.log(`Contexto (${context.length} chars):`);
    console.log(context);
    
    // 3. Crear prompt system
    console.log('\n3. CREANDO PROMPT SYSTEM:');
    const promptSystem = createDefinitivePromptSystem(context, question);
    console.log(`Prompt generado (${promptSystem.prompt.length} chars):`);
    console.log(promptSystem.prompt.substring(0, 500) + '...');
    
    // 4. Obtener respuesta del LLM
    console.log('\n4. OBTENIENDO RESPUESTA LLM:');
    const llmResponse = await getAIResponse(promptSystem.prompt);
    console.log(`Respuesta LLM: "${llmResponse}"`);
    
    // 5. Validar respuesta
    console.log('\n5. VALIDANDO RESPUESTA:');
    const validation = promptSystem.validateResponse(llmResponse);
    console.log(`Validación:`, validation);
    
    // 6. Aplicar polishing
    console.log('\n6. APLICANDO POLISHING:');
    const polished = ResponsePolishingSystem.polish(llmResponse, 'rag');
    console.log(`Resultado polishing:`, polished);
    
    // 7. Verificar si es weak response
    console.log('\n7. VERIFICANDO WEAK RESPONSE:');
    const isWeak = ResponsePolishingSystem.isWeakResponse(llmResponse);
    console.log(`Es weak response: ${isWeak}`);
    
    // 8. Análisis final
    console.log('\n8. ANÁLISIS FINAL:');
    console.log(`Respuesta original: "${llmResponse}"`);
    console.log(`Respuesta final: "${polished.answer}"`);
    console.log(`Confianza: ${polished.confidence}`);
    console.log(`Cambios: ${polished.changes.join(', ')}`);
}

if (require.main === module) {
    debugPolishingFlow().catch(console.error);
}

module.exports = { debugPolishingFlow };
