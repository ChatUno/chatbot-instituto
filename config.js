/**
 * Sistema Centralizado de Configuración - Chatbot IES Juan de Lanuza V4
 * Centraliza toda configuración para mejor mantenibilidad y deployment flexibility
 */

// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

/**
 * Configuración base del sistema
 */
const baseConfig = {
    // AI Service Configuration
    ai: {
        model: process.env.AI_MODEL || "llama-3.1-8b-instant",
        temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.3,
        maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 1000,
        apiUrl: process.env.AI_API_URL || "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        timeout: parseInt(process.env.AI_TIMEOUT) || 30000
    },

    // Memory System Configuration
    memory: {
        maxExchanges: parseInt(process.env.MEMORY_MAX_EXCHANGES) || 5,
        maxContextLength: parseInt(process.env.MEMORY_MAX_CONTEXT_LENGTH) || 3000
    },

    // Observability Configuration
    observability: {
        maxLogs: parseInt(process.env.OBSERVABILITY_MAX_LOGS) || 1000,
        debugMode: process.env.DEBUG === 'true',
        logFile: process.env.OBSERVABILITY_LOG_FILE || 'logs/chatbot-observability.json'
    },

    // Rate Limiting Configuration
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (15 * 60 * 1000), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
    },

    // File System Configuration
    fs: {
        chunksPath: process.env.CHUNKS_PATH || 'data/chunks.json',
        lockTimeout: parseInt(process.env.FS_LOCK_TIMEOUT) || 10000, // 10 seconds
        lockRetryInterval: parseInt(process.env.FS_LOCK_RETRY_INTERVAL) || 100, // 100ms
        encoding: process.env.FS_ENCODING || 'utf8'
    },

    // Response Polishing Configuration
    polishing: {
        maxLength: parseInt(process.env.POLISHING_MAX_LENGTH) || 150, // palabras
        enableEmojis: process.env.POLISHING_ENABLE_EMOJIS !== 'false'
    },

    // Server Configuration
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0',
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
            'https://chatbot-instituto-57zd.vercel.app',
            'https://chatbot-instituto.vercel.app',
            'https://chatbot-instituto-production.up.railway.app',
            'http://localhost:3000',
            'http://localhost:5500'
        ]
    },

    // RAG System Configuration
    rag: {
        maxChunks: parseInt(process.env.RAG_MAX_CHUNKS) || 3,
        minScore: parseFloat(process.env.RAG_MIN_SCORE) || 0.1,
        // BM25-lite scoring weights
        scoring: {
            exactMatch: parseFloat(process.env.RAG_SCORE_EXACT_MATCH) || 10,
            partialMatch: parseFloat(process.env.RAG_SCORE_PARTIAL_MATCH) || 5,
            intentMatch: parseFloat(process.env.RAG_SCORE_INTENT_MATCH) || 8,
            categoryMatch: parseFloat(process.env.RAG_SCORE_CATEGORY_MATCH) || 3,
            lengthPenalty: parseFloat(process.env.RAG_SCORE_LENGTH_PENALTY) || 0.1
        }
    },

    // Frontend Configuration
    frontend: {
        maxInputLength: parseInt(process.env.Frontend_MAX_INPUT_LENGTH) || 1000,
        typingIndicatorDelay: parseInt(process.env.FRONTEND_TYPING_DELAY) || 500
    }
};

/**
 * Configuración específica por entorno
 */
const environmentConfigs = {
    development: {
        ...baseConfig,
        observability: {
            ...baseConfig.observability,
            debugMode: true
        },
        server: {
            ...baseConfig.server,
            port: 3000
        }
    },

    production: {
        ...baseConfig,
        observability: {
            ...baseConfig.observability,
            debugMode: false
        },
        ai: {
            ...baseConfig.ai,
            timeout: 60000 // Longer timeout for production
        }
    },

    test: {
        ...baseConfig,
        observability: {
            ...baseConfig.observability,
            maxLogs: 100 // Fewer logs for testing
        },
        memory: {
            ...baseConfig.memory,
            maxExchanges: 2 // Less memory for testing
        },
        rateLimit: {
            ...baseConfig.rateLimit,
            max: 1000 // Higher limit for testing
        }
    }
};

/**
 * Obtener configuración según entorno actual
 */
function getConfig() {
    const env = process.env.NODE_ENV || 'development';
    return environmentConfigs[env] || environmentConfigs.development;
}

/**
 * Validar configuración crítica
 */
function validateConfig(config) {
    const errors = [];

    // Validar API key
    if (!config.ai.apiKey) {
        errors.push('AI_API_KEY is required');
    }

    // Validar valores numéricos
    if (config.memory.maxExchanges < 1 || config.memory.maxExchanges > 50) {
        errors.push('MEMORY_MAX_EXCHANGES must be between 1 and 50');
    }

    if (config.observability.maxLogs < 10 || config.observability.maxLogs > 10000) {
        errors.push('OBSERVABILITY_MAX_LOGS must be between 10 and 10000');
    }

    if (config.rateLimit.max < 1 || config.rateLimit.max > 10000) {
        errors.push('RATE_LIMIT_MAX_REQUESTS must be between 1 and 10000');
    }

    // Validar paths
    if (!config.fs.chunksPath) {
        errors.push('CHUNKS_PATH is required');
    }

    return errors;
}

/**
 * Obtener configuración validada
 */
function getValidatedConfig() {
    const config = getConfig();
    const errors = validateConfig(config);
    
    if (errors.length > 0) {
        console.error('Configuration validation errors:', errors);
        throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    }

    return config;
}

module.exports = {
    getConfig,
    getValidatedConfig,
    validateConfig,
    baseConfig,
    environmentConfigs
};
