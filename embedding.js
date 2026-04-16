// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const axios = require("axios");

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Genera embedding para un texto usando la API de Groq
 * @param {string} text - Texto para generar embedding
 * @returns {Promise<number[]>} - Vector de embedding
 */
async function getEmbedding(text) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/embeddings",
            {
                model: "text-embedding-ada-002",
                input: text
            },
            {
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data.data[0].embedding;

    } catch (error) {
        console.error("Error generando embedding:", error.message);
        
        // Fallback: devolver vector aleatorio para testing
        console.warn("Usando embedding fallback (vector aleatorio)");
        const size = 1536; // Tamaño estándar de embeddings
        return Array.from({ length: size }, () => Math.random() - 0.5);
    }
}

/**
 * Calcula la similitud coseno entre dos vectores
 * @param {number[]} a - Primer vector
 * @param {number[]} b - Segundo vector
 * @returns {number} - Similitud coseno (0 a 1)
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error("Los vectores deben tener la misma longitud");
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
