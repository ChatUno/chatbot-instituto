const fs = require('fs');
const path = require('path');
const { getAIResponse } = require('./ai-client');
const { semanticSearch, buildContextFromResults } = require('./search');
const { createDefinitivePromptSystem } = require('./prompt-system');
const { MemoryManager, createMemoryManager } = require('./memory-system');
const { ResponsePolishingSystem } = require('./response-polishing');
const { ObservabilityManager, createObservabilityManager } = require('./observability');

/**
 * Clasifica la intención de la pregunta del usuario basándose en palabras clave
 * @param {string} question - Pregunta del usuario
 * @returns {string[]} - Array de categorías detectadas
 */
function classifyQuestion(question) {
    const questionLower = question.toLowerCase();
    
    // Palabras clave por categoría (sin palabras generales)
    const keywords = {
        calendario: ['calendario', 'fecha', 'horario', 'evento', 'examen', 'vacaciones', 'festivo', 'semestre', 'trimestre'],
        oferta: ['oferta', 'estudiar', 'carrera', 'grado', 'fp', 'bachillerato', 'educación', 'formativo', 'ciclo'],
        programas: ['programa', 'asignatura', 'materia', 'curso', 'contenido', 'temario', 'plan', 'estudios'],
        contacto: ['contacto', 'teléfono', 'dirección', 'email', 'ubicación', 'lugar', 'centro', 'instituto'],
        avisos: ['aviso', 'comunicado', 'importante', 'anuncio', 'novedad', 'actualización'],
        noticias: ['noticia', 'novedades', 'blog', 'artículo', 'prensa', 'comunicación', 'actualidad']
    };
    
    const detectedCategories = new Set();
    
    // Buscar coincidencias en todas las categorías
    for (const [category, words] of Object.entries(keywords)) {
        for (const word of words) {
            if (questionLower.includes(word)) {
                detectedCategories.add(category);
                break; // Pasar a la siguiente categoría
            }
        }
    }
    
    // Si no se detecta ninguna categoría, usar general como fallback
    if (detectedCategories.size === 0) {
        return ['general'];
    }
    
    return Array.from(detectedCategories);
}

/**
 * Obtiene los archivos relevantes según las categorías
 * @param {string[]} categories - Array de categorías de la intención
 * @returns {string[]} - Array de rutas de archivos sin duplicados
 */
function getRelevantFiles(categories) {
    const basePath = path.join(__dirname, 'data');
    
    const fileMapping = {
        calendario: [path.join(basePath, 'dinamico', 'calendario.txt')],
        oferta: [path.join(basePath, 'estatico', 'oferta_educativa.txt')],
        programas: [path.join(basePath, 'estatico', 'programas.txt')],
        contacto: [
            path.join(basePath, 'estatico', 'centro.txt'),
            path.join(basePath, 'estatico', 'servicios.txt')
        ],
        avisos: [path.join(basePath, 'dinamico', 'avisos.txt')],
        noticias: [path.join(basePath, 'dinamico', 'noticias.txt')],
        general: [
            path.join(basePath, 'dinamico', 'faq.txt'),
            path.join(basePath, 'estatico', 'centro.txt')
        ]
    };
    
    const allFiles = new Set();
    
    // Combinar archivos de todas las categorías
    for (const category of categories) {
        const files = fileMapping[category] || fileMapping.general;
        files.forEach(file => allFiles.add(file));
    }
    
    return Array.from(allFiles);
}

/**
 * Lee y concatena el contenido de múltiples archivos
 * @param {string[]} filePaths - Array de rutas de archivos
 * @returns {string} - Contenido concatenado de los archivos
 */
function readFiles(filePaths) {
    let content = '';
    
    for (const filePath of filePaths) {
        try {
            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                if (fileContent.trim()) {
                    content += `\n--- ${path.basename(filePath)} ---\n`;
                    content += fileContent + '\n';
                }
            } else {
                console.warn(`Archivo no encontrado: ${filePath}`);
            }
        } catch (error) {
            console.error(`Error leyendo archivo ${filePath}:`, error.message);
        }
    }
    
    // Aplicar límite de tamaño al contexto (3000 caracteres)
    const maxLength = 3000;
    if (content.length > maxLength) {
        content = content.substring(0, maxLength - 100) + '\n... [Contenido truncado por límite de tamaño]';
    }
    
    return content.trim();
}

/**
 * Construye el prompt para el modelo de lenguaje
 * @param {string} context - Contenido de los archivos relevantes
 * @param {string} question - Pregunta del usuario
 * @returns {string} - Prompt completo para la IA
 */
function buildPrompt(context, question) {
    return `Eres un asistente del IES Juan de Lanuza.

Responde de forma clara, breve y útil.
Usa SOLO la información proporcionada.
No inventes información bajo ninguna circunstancia.
Si la información puede estar desactualizada, indícalo.
Si no encuentras la respuesta en el contexto, dilo claramente.

CONTEXTO:
${context}

PREGUNTA:
${question}`;
}

/**
 * Construye prompt para RAG con asistente oficial y reglas estrictas
 * @param {string} context - Contexto de búsqueda semántica
 * @param {string} question - Pregunta del usuario
 * @returns {string} - Prompt formateado
 */
function buildRAGPrompt(context, question) {
    return `Eres un asistente virtual oficial del IES Juan de Lanuza.

Tu única función es responder preguntas usando EXCLUSIVAMENTE la información del CONTEXTO proporcionado.

────────────────────
🚨 REGLAS CRÍTICAS (OBLIGATORIAS)
────────────────────

1. NO inventes información bajo ninguna circunstancia.
2. NO uses conocimiento externo ni general.
3. NO asumas datos si no aparecen en el contexto.
4. NO reformules añadiendo información nueva.
5. NO "rellenes huecos" con lógica propia.
6. SIEMPRE prioriza literalidad del contexto.

────────────────────
📦 MODO DE RESPUESTA (EXTRACTIVO)
────────────────────

- Debes EXTRAER información del contexto, no interpretarla.
- Si la información aparece, debes incluirla.
- Si hay múltiples elementos, debes listarlos TODOS.
- No elimines elementos del contexto.
- No hagas resúmenes si se pierde información.

────────────────────
📌 REGLAS DE EXACT MATCH
────────────────────

- Si el contexto contiene una lista → devuélvela completa.
- Si hay varias opciones → muéstralas todas.
- Si un dato no está explícito → responde:
  "No dispongo de esa información en el contexto proporcionado."

────────────────────
⚠️ CONTROL DE VERACIDAD
────────────────────

Antes de responder, verifica mentalmente:

- ¿Esto está literalmente en el contexto?
  → SI: puedes responderlo
  → NO: no puedes decirlo

────────────────────
📚 FORMATO DE RESPUESTA
────────────────────

- Claro
- Directo
- Sin añadir información innecesaria
- En listas si el contenido es múltiple

────────────────────
📦 CONTEXTO
────────────────────
${context}

────────────────────
❓ PREGUNTA DEL USUARIO
────────────────────
${question}`;
}

/**
 * Maneja saludos y preguntas simples
 * @param {string} question - Pregunta del usuario
 * @returns {string|null} - Respuesta de saludo o null si no es saludo
 */
function handleSimpleGreetings(question) {
    const questionLower = question.toLowerCase().trim();
    
    // Patrones de saludo y preguntas simples
    const greetingPatterns = {
        hola: () => "¡Hola! Soy el asistente del IES Juan de Lanuza. ¿En qué puedo ayudarte?",
        buenos: () => "¡Buenos días! Soy el asistente del IES Juan de Lanuza. ¿En qué puedo ayudarte?",
        adiós: () => "¡Hasta luego! Si tienes más preguntas, estaré aquí para ayudarte.",
        gracias: () => "¡De nada! Si necesitas más información sobre el instituto, no dudes en preguntar.",
        ayuda: () => "Soy el asistente del IES Juan de Lanuza. Puedo ayudarte con información sobre:\n\n• Bachilleratos\n• Formación Profesional\n• ESO\n• Contacto del centro\n• Ubicación y horarios\n\n¿Qué te interesa?",
        info: () => "Soy el asistente del IES Juan de Lanuza. Puedo提供 información sobre:\n\n• Bachilleratos\n• Formación Profesional\n• ESO\n• Contacto del centro\n• Ubicación y horarios\n\n¿Qué te gustaría saber?",
        qué_es: () => "Soy el asistente del IES Juan de Lanuza, un instituto de educación secundaria público en Borja, Zaragoza. Puedo ayudarte con información académica y de contacto."
    };
    
    // Verificar si es un saludo o pregunta simple
    for (const [key, response] of Object.entries(greetingPatterns)) {
        if (questionLower.includes(key)) {
            return response();
        }
    }
    
    return null;
}

/**
 * Función principal que maneja la consulta del usuario con RAG y memoria
 * @param {string} question - Pregunta del usuario
 * @returns {Promise<string>} - Respuesta de la IA
 */
async function handleUserQuery(question) {
    const startTime = Date.now();
    let finalResponse = '';
    let source = 'rag';
    let promptMode = 'relevant';
    
    // Crear instancia de memoria aislada para este request
    const memoryManager = createMemoryManager(5);
    
    // Crear instancia de observabilidad aislada para este request
    const observabilityManager = createObservabilityManager();
    
    try {
        console.log("=== INICIANDO BÚSQUEDA RAG CON MEMORIA ===");
        console.log("Pregunta:", question);
        console.log("Estado memoria:", memoryManager.getStats());

        // 0. Manejo de saludos y preguntas simples
        const greetingResponse = handleSimpleGreetings(question);
        if (greetingResponse) {
            const endTime = Date.now();
            const requestData = {
                query: question,
                intent: 'greeting',
                memoryUsed: false,
                topChunks: [],
                selectedChunks: [],
                contextLength: 0,
                promptMode: 'greeting',
                responseLength: greetingResponse.length,
                latency: endTime - startTime,
                source: 'greeting',
                confidence: 1.0
            };

            observabilityManager.logRequest(requestData);
            return greetingResponse;
        }

        // 1. Obtener memoria conversacional actual
        const memory = memoryManager.getMemory();
        
        // 2. Intentar búsqueda simple primero (RAG)
        try {
            const searchResults = semanticSearch(question, 3);
            
            if (searchResults.length > 0) {
                console.log("RAG: Se encontraron resultados de búsqueda simple");
                const context = buildContextFromResults(searchResults, question);
                
                // Usar sistema definitivo de prompts con memoria
                const promptSystem = createDefinitivePromptSystem(context, question, memory);
                
                const aiResponse = await getAIResponse(promptSystem.prompt);
                
                // Validar respuesta contra alucinaciones
                const validation = promptSystem.validateResponse(aiResponse);
                
                if (!validation.isValid) {
                    console.warn("RAG: Respuesta inválida detectada:", validation.reason);
                    console.log("RAG: Usando respuesta corregida");
                    
                    // Aplicar response polishing
                    const polishedResponse = ResponsePolishingSystem.polish(validation.correctedResponse, 'rag');
                    console.log("RAG: Response polishing aplicado:", polishedResponse.changes);
                    
                    // Añadir intercambio a la memoria con respuesta pulida
                    memoryManager.addExchange(question, polishedResponse.answer);
                    return polishedResponse.answer;
                }
                
                console.log("RAG: Respuesta validada exitosamente");
                
                // Aplicar response polishing a respuesta válida
                const polishedResponse = ResponsePolishingSystem.polish(aiResponse, 'rag');
                console.log("RAG: Response polishing aplicado:", polishedResponse.changes);
                
                // Añadir intercambio exitoso a la memoria con respuesta pulida
                memoryManager.addExchange(question, polishedResponse.answer);
                finalResponse = polishedResponse.answer;
                
                // Logging de observabilidad para RAG exitoso
                const endTime = Date.now();
                const requestData = {
                    query: question,
                    intent: 'detected_by_search',
                    memoryUsed: memory.trim() !== '',
                    topChunks: searchResults.map(r => ({ 
                        id: r.id, 
                        score: r.score, 
                        source: r.source 
                    })),
                    selectedChunks: searchResults.slice(0, 3).map(r => r.id),
                    contextLength: context.length,
                    promptMode: promptMode,
                    responseLength: polishedResponse.answer.length,
                    latency: endTime - startTime,
                    source: source,
                    confidence: polishedResponse.confidence,
                    chunkTrace: searchResults.map(r => r.trace).filter(t => t)
                };

                // Detectar fallos automáticamente
                const failures = observabilityManager.detectFailures(requestData);
                requestData.failures = failures;

                observabilityManager.logRequest(requestData);
                return polishedResponse.answer;
            } else {
                console.log("RAG: No se encontraron resultados, usando fallback");
            }
        } catch (ragError) {
            console.error("Error en RAG, usando fallback:", ragError.message);
        }

        // 3. Fallback al sistema original basado en palabras clave
        console.log("=== USANDO SISTEMA ORIGINAL (FALLBACK) ===");
        const categories = classifyQuestion(question);
        const relevantFiles = getRelevantFiles(categories);
        const context = readFiles(relevantFiles);

        // Usar sistema definitivo incluso en fallback con memoria
        const promptSystem = createDefinitivePromptSystem(context, question, memory);
        const aiResponse = await getAIResponse(promptSystem.prompt);
        
        // Validar respuesta en fallback también
        const validation = promptSystem.validateResponse(aiResponse);
        
        if (!validation.isValid) {
            console.warn("Fallback: Respuesta inválida detectada:", validation.reason);
            
            // Aplicar response polishing
            const polishedResponse = ResponsePolishingSystem.polish(validation.correctedResponse, 'fallback');
            console.log("Fallback: Response polishing aplicado:", polishedResponse.changes);
            
            // Añadir intercambio a la memoria con respuesta pulida
            memoryManager.addExchange(question, polishedResponse.answer);
            return polishedResponse.answer;
        }

        console.log("Fallback: Respuesta validada con sistema definitivo");
        
        // Aplicar response polishing a respuesta válida
        const polishedResponse = ResponsePolishingSystem.polish(aiResponse, 'fallback');
        console.log("Fallback: Response polishing aplicado:", polishedResponse.changes);
        
        // Añadir intercambio exitoso a la memoria con respuesta pulida
        memoryManager.addExchange(question, polishedResponse.answer);
        finalResponse = polishedResponse.answer;
        source = 'fallback';
        promptMode = 'fallback';

        // Logging de observabilidad para fallback
        const endTime = Date.now();
        const requestData = {
            query: question,
            intent: 'detected_by_keywords',
            memoryUsed: memory.trim() !== '',
            topChunks: [], // Fallback no usa chunks
            selectedChunks: [],
            contextLength: context.length,
            promptMode: promptMode,
            responseLength: polishedResponse.answer.length,
            latency: endTime - startTime,
            source: source,
            confidence: polishedResponse.confidence
        };

        // Detectar fallos automáticamente
        const failures = observabilityManager.detectFailures(requestData);
        requestData.failures = failures;

        observabilityManager.logRequest(requestData);
        return finalResponse;

    } catch (error) {
        console.error('Error procesando la consulta:', error.message);
        
        // Logging del error
        const endTime = Date.now();
        const errorRequestData = {
            query: question,
            intent: 'error',
            memoryUsed: false,
            topChunks: [],
            selectedChunks: [],
            contextLength: 0,
            promptMode: 'error',
            responseLength: error.message.length,
            latency: endTime - startTime,
            source: 'error',
            confidence: 0,
            failures: [{
                type: 'system_error',
                description: error.message
            }]
        };

        observabilityManager.logRequest(errorRequestData);
        return 'Error al procesar la consulta. Por favor, inténtalo de nuevo.';
    }
}

// Exportar funciones para testing o uso modular
module.exports = {
    classifyQuestion,
    getRelevantFiles,
    readFiles,
    buildPrompt,
    handleUserQuery
};

// Ejemplo de uso directo
if (require.main === module) {
    const question = process.argv[2] || '¿Cuáles son los horarios del instituto?';
    const prompt = handleUserQuery(question);
    console.log('=== PROMPT GENERADO ===');
    console.log(prompt);
}
