const fs = require('fs');
const path = require('path');
const { getAIResponse } = require('./ai-client');
const { semanticSearch, buildContextFromResults } = require('./search');

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
 * Construye prompt para RAG con contexto semántico
 * @param {string} context - Contexto de búsqueda semántica
 * @param {string} question - Pregunta del usuario
 * @returns {string} - Prompt formateado
 */
function buildRAGPrompt(context, question) {
    return `Eres un asistente del IES Juan de Lanuza.

Responde SOLO con esta información:

${context}

Pregunta: ${question}`;
}

/**
 * Función principal que maneja la consulta del usuario con RAG
 * @param {string} question - Pregunta del usuario
 * @returns {Promise<string>} - Respuesta de la IA
 */
async function handleUserQuery(question) {
    try {
        console.log("=== INICIANDO BÚSQUEDA RAG ===");
        console.log("Pregunta:", question);

        // 1. Intentar búsqueda semántica primero (RAG)
        try {
            const searchResults = await semanticSearch(question, 3);
            
            if (searchResults.length > 0) {
                console.log("RAG: Se encontraron resultados semánticos");
                const context = buildContextFromResults(searchResults);
                const prompt = buildRAGPrompt(context, question);
                
                const aiResponse = await getAIResponse(prompt);
                console.log("RAG: Respuesta generada exitosamente");
                return aiResponse;
            } else {
                console.log("RAG: No se encontraron resultados, usando fallback");
            }
        } catch (ragError) {
            console.error("Error en RAG, usando fallback:", ragError.message);
        }

        // 2. Fallback al sistema original basado en palabras clave
        console.log("=== USANDO SISTEMA ORIGINAL (FALLBACK) ===");
        const categories = classifyQuestion(question);
        const relevantFiles = getRelevantFiles(categories);
        const context = readFiles(relevantFiles);

        const prompt = buildPrompt(context, question);
        const aiResponse = await getAIResponse(prompt);

        console.log("Fallback: Respuesta generada con sistema original");
        return aiResponse;

    } catch (error) {
        console.error('Error procesando la consulta:', error.message);
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
