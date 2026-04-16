/**
 * Sistema Definitivo de Prompts para IES Juan de Lanuza
 * Foco absoluto en anti-alucinación y uso estricto del contexto
 */

/**
 * Construye el prompt definitivo con reglas anti-alucinación
 * @param {string} context - Contexto del sistema de context packing
 * @param {string} userQuery - Pregunta del usuario
 * @param {string} memory - Memoria conversacional formateada (opcional)
 * @returns {string} - Prompt completo y definitivo
 */
function buildDefinitivePrompt(context, userQuery, memory = '') {
    let prompt = `---

SYSTEM:
Eres el asistente oficial del IES Juan de Lanuza.

REGLAS CRÍTICAS:
- Solo puedes usar la información del CONTEXTO.
- Si la respuesta no está en el contexto, di: "No dispongo de esa información."
- No inventes datos bajo ninguna circunstancia.
- No uses conocimiento externo.
- No hagas suposiciones.

COMPORTAMIENTO:
- Responde de forma clara y directa.
- Usa listas si hay múltiples elementos.
- Sé breve y preciso.
- Prioriza exactitud sobre longitud.

PRIORIDAD DE INFORMACIÓN:
1. CONTEXTO (chunks del instituto) → fuente de verdad
2. PREGUNTA ACTUAL → intención principal
3. MEMORIA → solo continuidad conversacional

`;

    // Añadir memoria si existe
    if (memory && memory.trim() !== '') {
        prompt += `---

${memory}`;
    }

    prompt += `---

CONTEXTO:
${context}

---

PREGUNTA DEL USUARIO:
${userQuery}

---

RESPUESTA:`;

    return prompt;
}

/**
 * Verifica si el contexto contiene información relevante para la pregunta
 * @param {string} context - Contexto disponible
 * @param {string} query - Pregunta del usuario
 * @returns {boolean} - true si hay información relevante
 */
function hasRelevantContext(context, query) {
    if (!context || context.trim() === '') {
        return false;
    }
    
    // Si el contexto indica que no hay información relevante
    if (context.includes("No se encontró información relevante") || 
        context.includes("No se encontró información relevante para esta pregunta")) {
        return false;
    }
    
    // Extraer palabras clave de la pregunta
    const queryWords = query.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => word.replace(/[^\wáéíóúñü]/g, ''));
    
    // Normalizar contexto
    const normalizedContext = context.toLowerCase();
    
    // Verificar si al menos una palabra clave aparece en el contexto
    // Reducir el umbral de longitud para mayor sensibilidad
    const hasRelevantWords = queryWords.some(word => 
        word.length >= 3 && normalizedContext.includes(word)
    );
    
    // También verificar palabras clave específicas del dominio
    const domainKeywords = ['bachillerato', 'teléfono', 'contacto', 'dirección', 'email', 'oferta', 'centro', 'instituto'];
    const hasDomainKeywords = domainKeywords.some(keyword => 
        normalizedContext.includes(keyword) && queryWords.some(qw => qw.includes(keyword.substring(0, 3)))
    );
    
    return hasRelevantWords || hasDomainKeywords;
}

/**
 * Construye prompt con manejo de casos límite
 * @param {string} context - Contexto del sistema
 * @param {string} userQuery - Pregunta del usuario
 * @param {string} memory - Memoria conversacional formateada (opcional)
 * @returns {string} - Prompt apropiado para el caso
 */
function buildPromptWithEdgeCaseHandling(context, userQuery, memory = '') {
    // Verificar si hay contexto relevante
    if (!hasRelevantContext(context, userQuery)) {
        // Si no hay contexto relevante, construir prompt para respuesta negativa controlada
        let prompt = `---

SYSTEM:
Eres el asistente oficial del IES Juan de Lanuza.

REGLA ÚNICA:
- Solo puedes responder: "No dispongo de esa información."

`;

        // Añadir memoria si existe incluso en casos sin contexto relevante
        if (memory && memory.trim() !== '') {
            prompt += `---

${memory}`;
        }

        prompt += `---

CONTEXTO:
No se encontró información relevante para esta pregunta.

---

PREGUNTA DEL USUARIO:
${userQuery}

---

RESPUESTA:`;
        
        return prompt;
    }
    
    // Si hay contexto relevante, usar prompt definitivo normal con memoria
    return buildDefinitivePrompt(context, userQuery, memory);
}

/**
 * Valida que una respuesta generada cumpla con las reglas anti-alucinación
 * @param {string} response - Respuesta generada por el LLM
 * @param {string} context - Contexto usado para generar la respuesta
 * @returns {Object} - Objeto con validación y respuesta corregida si es necesario
 */
function validateAntiHallucination(response, context) {
    if (!response || response.trim() === '') {
        return {
            isValid: false,
            correctedResponse: "No dispongo de esa información.",
            reason: "Respuesta vacía"
        };
    }
    
    // Si la respuesta contiene información que no está en el contexto
    // Esta es una validación básica - podría ser más sofisticada
    const responseLower = response.toLowerCase();
    const contextLower = context.toLowerCase();
    
    // Palabras legítimas que no deben considerarse alucinación (expandido)
    const legitimateWords = [
        'lanuza', 'juan', 'instituto', 'ies', 'centro', 'colegio',
        'bachillerato', 'tecnología', 'humanidades', 'ciencias', 'sociales',
        'formación', 'profesional', 'educación', 'secundaria', 'obligatoria',
        'capuchinos', 'borja', 'zaragoza', 'españa', 'contacto', 'teléfono',
        'email', 'oferta', 'educativa', 'ciclos', 'grado', 'medio', 'básico',
        'cocina', 'gastronomía', 'atención', 'personas', 'dependencia',
        'asignaturas', 'destacadas', 'programación', 'robótica', 'cultura',
        'clásica', 'economía', 'filosofía', 'física', 'química', 'biología',
        'geología', 'opciones', 'siguientes', 'siguiente', 'disponibles',
        'puedes', 'pueden', 'ofrecen', 'ofrece', 'imparten', 'imparte'
    ];
    
    // Extraer solo entidades potencialmente problemáticas (números grandes, nombres propios)
    const entities = responseLower.match(/\b\d{4,}\b|[A-Z][a-z]{3,}\b/g) || [];
    
    // Verificar si las entidades problemáticas aparecen en el contexto
    const suspiciousEntities = entities.filter(entity => 
        entity.length > 4 && 
        !contextLower.includes(entity) &&
        !legitimateWords.some(word => entity.toLowerCase().includes(word))
    );
    
    // Solo rechazar si hay entidades genuinamente sospechosas (números de teléfono, nombres, etc.)
    if (suspiciousEntities.length > 0 && !responseLower.includes("no dispongo")) {
        console.warn("Posible alucinación detectada:", suspiciousEntities);
        return {
            isValid: false,
            correctedResponse: "No dispongo de esa información.",
            reason: "Posible información fuera del contexto"
        };
    }
    
    return {
        isValid: true,
        correctedResponse: response,
        reason: "Respuesta válida"
    };
}

/**
 * Sistema completo de prompt definitivo con validación
 * @param {string} context - Contexto del sistema de context packing
 * @param {string} userQuery - Pregunta del usuario
 * @param {string} memory - Memoria conversacional formateada (opcional)
 * @returns {Object} - Objeto con prompt y sistema de validación
 */
function createDefinitivePromptSystem(context, userQuery, memory = '') {
    const prompt = buildPromptWithEdgeCaseHandling(context, userQuery, memory);
    
    return {
        prompt: prompt,
        context: context,
        userQuery: userQuery,
        memory: memory,
        validateResponse: (response) => validateAntiHallucination(response, context),
        hasRelevantContext: () => hasRelevantContext(context, userQuery)
    };
}

module.exports = {
    buildDefinitivePrompt,
    buildPromptWithEdgeCaseHandling,
    validateAntiHallucination,
    hasRelevantContext,
    createDefinitivePromptSystem
};
