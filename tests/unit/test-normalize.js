// Probar la función normalizeText directamente
function normalizeText(text) {
    // Preservar "FP" antes de normalizar
    const hasFP = text.toUpperCase().includes('FP');
    
    let normalized = text.toLowerCase()
              .replace(/[áàäâ]/g, 'a')
              .replace(/[éèëê]/g, 'e')
              .replace(/[íìïî]/g, 'i')
              .replace(/[óòöô]/g, 'o')
              .replace(/[úùüû]/g, 'u')
              .replace(/[ñ]/g, 'n')
              .replace(/[^\w\s]/g, '') // Solo letras y espacios
              .trim();
    
    // Restaurar "fp" si estaba presente
    if (hasFP && !normalized.includes('fp')) {
        normalized += ' fp';
    }
    
    return normalized;
}

function tokenize(text) {
    return normalizeText(text)
              .split(/\s+/)
              .filter(word => word.length > 1) // Ignorar palabras muy cortas (permitir "fp")
              .filter((word, index, arr) => arr.indexOf(word) === index); // Eliminar duplicados
}

// Probar con la pregunta
const question = '¿Qué FP hay?';
console.log('Original:', question);
console.log('Normalizado:', normalizeText(question));
console.log('Tokenizado:', tokenize(question));

// Verificar detección
const tokens = tokenize(question);
const hasFP = tokens.some(word => word.includes('fp'));
const hasFormacion = tokens.some(word => word.includes('formación'));

console.log('¿Contiene "fp"?', hasFP);
console.log('¿Contiene "formación"?', hasFormacion);
