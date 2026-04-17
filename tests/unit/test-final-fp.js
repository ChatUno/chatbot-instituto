const { handleUserQuery } = require('./chatbot-backend.js');

async function testFPFinal() {
  try {
    console.log('🧪 TEST FINAL FP - SERVIDOR REINICIADO');
    
    // Probar la pregunta principal
    const response = await handleUserQuery('¿Qué FP hay?');
    console.log('Pregunta: ¿Qué FP hay?');
    console.log('Respuesta:', response);
    
    // También probar otras variantes
    const variants = ['qué formación profesional tienen', 'ciclos de fp', 'formación profesional'];
    for (const variant of variants) {
      const resp = await handleUserQuery(variant);
      console.log(`\nPregunta: ${variant}`);
      console.log('Respuesta:', resp);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFPFinal();
