/**
 * Sistema de Validación de Requests - Chatbot IES Juan de Lanuza V4
 * Implementa schemas Joi para validar todos los endpoints
 */

const Joi = require('joi');
const { getValidatedConfig } = require('./config');
const config = getValidatedConfig();

/**
 * Schema para validación del endpoint /chat
 */
const chatRequestSchema = Joi.object({
    message: Joi.string()
        .min(1)
        .max(config.frontend.maxInputLength)
        .required()
        .messages({
            'string.empty': 'El mensaje no puede estar vacío',
            'string.min': 'El mensaje debe tener al menos 1 caracter',
            'string.max': `El mensaje no puede exceder ${config.frontend.maxInputLength} caracteres`,
            'any.required': 'El campo message es requerido'
        })
});

/**
 * Schema para validación del endpoint POST /chunks
 */
const chunksRequestSchema = Joi.object({
    chunks: Joi.array()
        .items(
            Joi.object({
                id: Joi.number()
                    .integer()
                    .positive()
                    .required()
                    .messages({
                        'number.base': 'El ID debe ser un número',
                        'number.integer': 'El ID debe ser un número entero',
                        'number.positive': 'El ID debe ser positivo',
                        'any.required': 'El campo id es requerido'
                    }),
                text: Joi.string()
                    .min(10)
                    .max(2000)
                    .required()
                    .messages({
                        'string.empty': 'El texto no puede estar vacío',
                        'string.min': 'El texto debe tener al menos 10 caracteres',
                        'string.max': 'El texto no puede exceder 2000 caracteres',
                        'any.required': 'El campo text es requerido'
                    }),
                source: Joi.string()
                    .valid('centro', 'oferta', 'programas', 'faq')
                    .required()
                    .messages({
                        'any.only': 'El source debe ser uno de: centro, oferta, programas, faq',
                        'any.required': 'El campo source es requerido'
                    })
            })
        )
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': 'Debe proporcionar al menos un chunk',
            'array.max': 'No puede proporcionar más de 100 chunks',
            'any.required': 'El campo chunks es requerido'
        })
});

/**
 * Schema para validación de query parameters (GET /chunks)
 */
const chunksQuerySchema = Joi.object({
    limit: Joi.number()
        .integer()
        .positive()
        .max(100)
        .default(10)
        .messages({
            'number.base': 'limit debe ser un número',
            'number.integer': 'limit debe ser un número entero',
            'number.positive': 'limit debe ser positivo',
            'number.max': 'limit no puede exceder 100'
        }),
    offset: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .messages({
            'number.base': 'offset debe ser un número',
            'number.integer': 'offset debe ser un número entero',
            'number.min': 'offset no puede ser negativo'
        }),
    source: Joi.string()
        .valid('centro', 'oferta', 'programas', 'faq')
        .messages({
            'any.only': 'source debe ser uno de: centro, oferta, programas, faq'
        })
});

/**
 * Middleware de validación genérico
 */
function validateRequest(schema, source = 'body') {
    return (req, res, next) => {
        const data = source === 'query' ? req.query : req.body;
        
        const { error, value } = schema.validate(data, {
            abortEarly: false, // Mostrar todos los errores
            stripUnknown: true, // Remover campos no especificados
            convert: true // Intentar convertir tipos
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value
            }));

            console.error(`Validation error in ${req.method} ${req.path}:`, errorDetails);
            
            return res.status(400).json({
                error: 'Validation failed',
                message: 'Request validation failed',
                details: errorDetails,
                timestamp: new Date().toISOString()
            });
        }

        // Reemplazar datos validados
        if (source === 'query') {
            req.query = value;
        } else {
            req.body = value;
        }

        next();
    };
}

/**
 * Middleware específico para cada endpoint
 */
const validateChatRequest = validateRequest(chatRequestSchema, 'body');
const validateChunksRequest = validateRequest(chunksRequestSchema, 'body');
const validateChunksQuery = validateRequest(chunksQuerySchema, 'query');

/**
 * Validador de configuración para sanity check
 */
function validateConfiguration() {
    const errors = [];
    
    // Validar configuración crítica
    if (!config.ai.apiKey) {
        errors.push('AI_API_KEY is required');
    }
    
    if (config.frontend.maxInputLength < 10 || config.frontend.maxInputLength > 10000) {
        errors.push('Frontend max input length must be between 10 and 10000');
    }
    
    if (config.rag.maxChunks < 1 || config.rag.maxChunks > 50) {
        errors.push('RAG max chunks must be between 1 and 50');
    }
    
    return errors;
}

/**
 * Middleware de sanity check de configuración
 */
function configurationSanityCheck(req, res, next) {
    const configErrors = validateConfiguration();
    
    if (configErrors.length > 0) {
        console.error('Configuration errors:', configErrors);
        return res.status(500).json({
            error: 'Configuration error',
            message: 'Server configuration is invalid',
            details: configErrors,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

module.exports = {
    // Schemas
    chatRequestSchema,
    chunksRequestSchema,
    chunksQuerySchema,
    
    // Middleware
    validateRequest,
    validateChatRequest,
    validateChunksRequest,
    validateChunksQuery,
    configurationSanityCheck,
    
    // Utils
    validateConfiguration
};
