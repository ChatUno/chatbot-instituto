// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const axios = require("axios");

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Genera embedding usando OpenRouter API
 * @param {string} text - Texto para generar embedding
 * @returns {Promise<number[]>} - Vector de embedding
 */
async function getEmbedding(text) {
    try {
        console.log(`Generando embedding para: "${text.substring(0, 50)}..."`);
        
        const response = await axios.post(
            "https://openrouter.ai/api/v1/embeddings",
            {
                model: "openai/text-embedding-3-small",
                input: text
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://chatbot-instituto-production.up.railway.app",
                    "OpenAI-User-Agent": "chatbot-instituto/1.0"
                }
            }
        );

        const embedding = response.data.data[0].embedding;
        console.log(`Embedding generado exitosamente. Tamaño: ${embedding.length}`);
        return embedding;

    } catch (error) {
        console.error("Error generando embedding:", error.message);
        
        // Simple retry mechanism
        if (error.response?.status === 429 && error.response?.headers?.['retry-after']) {
            const retryAfter = parseInt(error.response.headers['retry-after']);
            console.log(`Rate limit alcanzado. Reintentando en ${retryAfter} segundos...`);
            
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            return getEmbedding(text); // Retry once
        }
        
        // Si es error de autenticación (401), registrar y devolver null
        if (error.response?.status === 401) {
            console.error("❌ ERROR DE AUTENTICACIÓN 401 - API Key inválida o sin permisos");
            console.error("🔍 Verificar API key en dashboard de OpenRouter");
            console.error("📋 La key puede estar expirada o no tener permisos para embeddings");
            return null;
        }
        
        // Fallback: devolver null para indicar fallo
        console.warn("Embedding falló, devolviendo null - el sistema usará búsqueda textual");
        return null;
    }
}

/**
 * Calcula la similitud coseno entre dos vectores
 * @param {number[]} a - Primer vector
 * @param {number[]} b - Segundo vector
 * @returns {number} - Similitud coseno (0 a 1)
 */
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
        console.warn("Vectores inválidos para similitud coseno");
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
    getEmbedding,
    cosineSimilarity
};
