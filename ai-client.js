// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const { createCircuitBreaker } = require("./circuit-breaker");
const { getValidatedConfig } = require("./config");

const config = getValidatedConfig();

// Crear circuit breaker para llamadas a GROQ API
const circuitBreaker = createCircuitBreaker({
    failureThreshold: config.circuitBreaker?.failureThreshold || 5,
    recoveryTimeout: config.circuitBreaker?.recoveryTimeout || 60000,
    maxRetries: config.circuitBreaker?.maxRetries || 3,
    initialRetryDelay: config.circuitBreaker?.initialRetryDelay || 1000,
    maxRetryDelay: config.circuitBreaker?.maxRetryDelay || 10000,
    
    // Callbacks de monitoreo
    onStateChange: (oldState, newState) => {
        console.log(`[Circuit Breaker] State change: ${oldState} -> ${newState}`);
        if (newState === 'OPEN') {
            console.warn('[Circuit Breaker] GROQ API circuit opened - using fallback responses');
        }
    },
    onSuccess: (result) => {
        console.log('[Circuit Breaker] GROQ API call successful');
    },
    onFailure: (error) => {
        console.error('[Circuit Breaker] GROQ API call failed:', error.message);
    },
    onRetry: (attempt, error) => {
        console.log(`[Circuit Breaker] Retry attempt ${attempt} for GROQ API, error: ${error.message}`);
    }
});

/**
 * Llama a la API de GROQ con protección del circuit breaker
 * @param {string} prompt - Prompt a enviar
 * @returns {Promise<string>} - Respuesta de la API
 */
async function callGroqAPI(prompt) {
    const axios = require("axios");
    
    const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: config.ai.model,
            messages: [
                {
                    role: "system",
                    content: "Eres un asistente útil y preciso."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: config.ai.temperature
        },
        {
            headers: {
                "Authorization": `Bearer ${config.ai.apiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 30000 // 30 segundos timeout
        }
    );

    return response.data.choices[0].message.content;
}

/**
 * Función principal para obtener respuesta de IA con circuit breaker
 * @param {string} prompt - Prompt del usuario
 * @returns {Promise<string>} - Respuesta de la IA o fallback
 */
async function getAIResponse(prompt) {
    try {
        const response = await circuitBreaker.execute(() => callGroqAPI(prompt));
        return response;
        
    } catch (error) {
        console.error("[AI Client] Error en llamada a GROQ API:", error.message);
        
        // Manejo específico de errores del circuit breaker
        if (error.code === 'CIRCUIT_BREAKER_OPEN') {
            console.warn("[AI Client] Circuit breaker abierto - usando respuesta de fallback");
            return getFallbackResponse(prompt, error);
        }
        
        // Manejo de otros errores
        if (error.status === 401) {
            console.error("[AI Client] Error de autenticación con GROQ API");
            return "Lo siento, hay un problema de configuración con el servicio de IA. Por favor, contacte al administrador.";
        }
        
        if (error.status >= 500) {
            console.error("[AI Client] Error del servidor GROQ");
            return getFallbackResponse(prompt, error);
        }
        
        // Error genérico
        return "Lo siento, ha ocurrido un error al generar la respuesta. Por favor, inténtelo de nuevo.";
    }
}

/**
 * Genera respuesta de fallback cuando el circuit breaker está abierto
 * @param {string} prompt - Prompt original
 * @param {Error} error - Error que causó el fallback
 * @returns {string} - Respuesta de fallback
 */
function getFallbackResponse(prompt, error) {
    // Análisis simple del prompt para dar respuesta contextual
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('fp') || promptLower.includes('formación profesional')) {
        return "En este momento no puedo acceder a la información actualizada sobre Formación Profesional. Por favor, visite la web del centro o inténtelo más tarde.";
    }
    
    if (promptLower.includes('horario') || promptLower.includes('horarios')) {
        return "No puedo consultar los horarios en este momento. Por favor, contacte directamente con el centro o consulte la web oficial.";
    }
    
    if (promptLower.includes('matrícula') || promptLower.includes('inscripción')) {
        return "El servicio de matrícula no está disponible temporalmente. Por favor, contacte con secretaría para información sobre el proceso de inscripción.";
    }
    
    if (promptLower.includes('centro') || promptLower.includes('instituto')) {
        return "No puedo acceder a la información del centro en este momento. Por favor, visite nuestra web o contacte directamente con nosotros.";
    }
    
    // Respuesta genérica de fallback
    const retryAfter = error.retryAfter ? ` Puedes intentarlo en ${error.retryAfter} segundos.` : '';
    
    return `Lo siento, el servicio de inteligencia artificial no está disponible temporalmente debido a un problema técnico.${retryAfter} Por favor, inténtelo más tarde o contacte directamente con el centro.`;
}

/**
 * Obtiene estadísticas del circuit breaker
 * @returns {Object} - Estadísticas actuales
 */
function getCircuitBreakerStats() {
    return circuitBreaker.getStats();
}

/**
 * Verifica si el circuit breaker está saludable
 * @returns {boolean} - True si está saludable
 */
function isCircuitBreakerHealthy() {
    return circuitBreaker.isHealthy();
}

/**
 * Reinicia el circuit breaker manualmente
 */
function resetCircuitBreaker() {
    circuitBreaker.reset();
    console.log('[AI Client] Circuit breaker reset manualmente');
}

module.exports = { 
    getAIResponse,
    getCircuitBreakerStats,
    isCircuitBreakerHealthy,
    resetCircuitBreaker
};