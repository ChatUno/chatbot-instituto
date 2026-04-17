/**
 * Comprehensive Error Handling System - Chatbot IES Juan de Lanuza V4
 * Implementa clasificación de errores, mensajes amigables y logging estructurado
 */

/**
 * Categorías de errores para clasificación
 */
const ErrorCategory = {
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    RATE_LIMIT: 'rate_limit',
    EXTERNAL_API: 'external_api',
    INTERNAL_SERVER: 'internal_server',
    NOT_FOUND: 'not_found',
    BUSINESS_LOGIC: 'business_logic',
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown'
};

/**
 * Niveles de severidad
 */
const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Clase base para errores personalizados
 */
class AppError extends Error {
    constructor(message, category = ErrorCategory.UNKNOWN, statusCode = 500, severity = ErrorSeverity.MEDIUM, userMessage = null, details = {}) {
        super(message);
        this.name = 'AppError';
        this.category = category;
        this.statusCode = statusCode;
        this.severity = severity;
        this.userMessage = userMessage || this.getDefaultUserMessage(category);
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.requestId = this.generateRequestId();
        
        // Mantener stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    generateRequestId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    getDefaultUserMessage(category) {
        const messages = {
            [ErrorCategory.VALIDATION]: 'Los datos proporcionados no son válidos. Por favor, revise su solicitud.',
            [ErrorCategory.AUTHENTICATION]: 'No se pudo autenticar su solicitud. Por favor, verifique sus credenciales.',
            [ErrorCategory.AUTHORIZATION]: 'No tiene permisos para realizar esta acción.',
            [ErrorCategory.RATE_LIMIT]: 'Ha excedido el límite de solicitudes. Por favor, espere unos minutos.',
            [ErrorCategory.EXTERNAL_API]: 'El servicio no está disponible temporalmente. Por favor, inténtelo más tarde.',
            [ErrorCategory.INTERNAL_SERVER]: 'Ha ocurrido un error interno. Por favor, inténtelo más tarde.',
            [ErrorCategory.NOT_FOUND]: 'El recurso solicitado no existe.',
            [ErrorCategory.BUSINESS_LOGIC]: 'No se puede completar la solicitud debido a restricciones del sistema.',
            [ErrorCategory.NETWORK]: 'Problema de conexión. Por favor, verifique su conexión a internet.',
            [ErrorCategory.TIMEOUT]: 'La solicitud tomó demasiado tiempo. Por favor, inténtelo de nuevo.',
            [ErrorCategory.UNKNOWN]: 'Ha ocurrido un error inesperado. Por favor, contacte al soporte técnico.'
        };
        return messages[category] || messages[ErrorCategory.UNKNOWN];
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            category: this.category,
            statusCode: this.statusCode,
            severity: this.severity,
            userMessage: this.userMessage,
            details: this.details,
            timestamp: this.timestamp,
            requestId: this.requestId,
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
        };
    }
}

/**
 * Errores específicos por categoría
 */
class ValidationError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.VALIDATION, 400, ErrorSeverity.LOW, null, details);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.AUTHENTICATION, 401, ErrorSeverity.MEDIUM, null, details);
        this.name = 'AuthenticationError';
    }
}

class AuthorizationError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.AUTHORIZATION, 403, ErrorSeverity.MEDIUM, null, details);
        this.name = 'AuthorizationError';
    }
}

class RateLimitError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.RATE_LIMIT, 429, ErrorSeverity.MEDIUM, null, details);
        this.name = 'RateLimitError';
    }
}

class ExternalAPIError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.EXTERNAL_API, 502, ErrorSeverity.HIGH, null, details);
        this.name = 'ExternalAPIError';
    }
}

class InternalServerError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.INTERNAL_SERVER, 500, ErrorSeverity.HIGH, null, details);
        this.name = 'InternalServerError';
    }
}

class NotFoundError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.NOT_FOUND, 404, ErrorSeverity.LOW, null, details);
        this.name = 'NotFoundError';
    }
}

class BusinessLogicError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.BUSINESS_LOGIC, 422, ErrorSeverity.MEDIUM, null, details);
        this.name = 'BusinessLogicError';
    }
}

class NetworkError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.NETWORK, 503, ErrorSeverity.MEDIUM, null, details);
        this.name = 'NetworkError';
    }
}

class TimeoutError extends AppError {
    constructor(message, details = {}) {
        super(message, ErrorCategory.TIMEOUT, 408, ErrorSeverity.MEDIUM, null, details);
        this.name = 'TimeoutError';
    }
}

/**
 * Sistema de logging estructurado para errores
 */
class ErrorLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Límite para evitar memory leaks
    }

    log(error, context = {}) {
        const logEntry = {
            timestamp: error.timestamp || new Date().toISOString(),
            requestId: error.requestId || 'unknown',
            category: error.category || ErrorCategory.UNKNOWN,
            severity: error.severity || ErrorSeverity.MEDIUM,
            message: error.message,
            userMessage: error.userMessage,
            statusCode: error.statusCode,
            details: error.details || {},
            context: {
                method: context.method,
                url: context.url,
                userAgent: context.userAgent,
                ip: context.ip,
                userId: context.userId,
                ...context
            },
            stack: error.stack
        };

        this.logs.push(logEntry);

        // Mantener límite de logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Logging a consola con formato estructurado
        this.consoleLog(logEntry);

        // Guardar en archivo si está en producción
        if (process.env.NODE_ENV === 'production') {
            this.saveToFile(logEntry);
        }
    }

    consoleLog(logEntry) {
        const logLevel = this.getLogLevel(logEntry.severity);
        const logMessage = `[${logEntry.timestamp}] [${logEntry.requestId}] [${logEntry.category.toUpperCase()}] ${logEntry.message}`;
        
        console[logLevel](logMessage, {
            requestId: logEntry.requestId,
            category: logEntry.category,
            severity: logEntry.severity,
            statusCode: logEntry.statusCode,
            context: logEntry.context,
            details: logEntry.details
        });
    }

    getLogLevel(severity) {
        const levels = {
            [ErrorSeverity.LOW]: 'info',
            [ErrorSeverity.MEDIUM]: 'warn',
            [ErrorSeverity.HIGH]: 'error',
            [ErrorSeverity.CRITICAL]: 'error'
        };
        return levels[severity] || 'error';
    }

    saveToFile(logEntry) {
        try {
            const fs = require('fs');
            const path = require('path');
            const logFile = path.join(__dirname, 'logs', 'error-logs.json');
            
            // Asegurar que el directorio existe
            const logDir = path.dirname(logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // Guardar log
            fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
        } catch (fileError) {
            console.error('Failed to save error log to file:', fileError.message);
        }
    }

    getLogs(filters = {}) {
        let filteredLogs = this.logs;

        if (filters.category) {
            filteredLogs = filteredLogs.filter(log => log.category === filters.category);
        }

        if (filters.severity) {
            filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
        }

        if (filters.since) {
            const since = new Date(filters.since);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= since);
        }

        return filteredLogs;
    }

    clearLogs() {
        this.logs = [];
    }
}

/**
 * Middleware para manejo de errores en Express
 */
class ErrorHandlerMiddleware {
    constructor(logger = new ErrorLogger()) {
        this.logger = logger;
    }

    /**
     * Maneja errores de forma centralizada
     */
    handleError(err, req, res, next) {
        // Convertir errores genéricos a AppError
        const appError = this.normalizeError(err);
        
        // Loggear el error
        this.logger.log(appError, {
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.sub,
            body: this.sanitizeBody(req.body),
            params: req.params,
            query: req.query
        });

        // Enviar respuesta al cliente
        const response = this.formatErrorResponse(appError, req);
        res.status(appError.statusCode).json(response);
    }

    /**
     * Convierte errores genéricos a AppError
     */
    normalizeError(err) {
        if (err instanceof AppError) {
            return err;
        }

        // Errores de validación de Express
        if (err.name === 'ValidationError') {
            return new ValidationError(err.message, { field: err.field, value: err.value });
        }

        // Errores de JWT
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return new AuthenticationError('Token de autenticación inválido', { originalError: err.message });
        }

        // Errores de sintaxis JSON
        if (err.type === 'entity.parse.failed') {
            return new ValidationError('Formato JSON inválido', { originalError: err.message });
        }

        // Errores de límite de tamaño
        if (err.type === 'entity.too.large') {
            return new ValidationError('Payload demasiado grande', { limit: err.limit });
        }

        // Errores de timeout
        if (err.code === 'ETIMEDOUT') {
            return new TimeoutError('La operación excedió el tiempo límite', { timeout: err.timeout });
        }

        // Errores de red
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return new NetworkError('Error de conexión', { code: err.code });
        }

        // Error genérico
        return new InternalServerError(err.message, { originalError: err.message, stack: err.stack });
    }

    /**
     * Formatea la respuesta de error para el cliente
     */
    formatErrorResponse(error, req) {
        const response = {
            success: false,
            error: {
                code: error.name,
                message: error.userMessage,
                category: error.category,
                severity: error.severity,
                requestId: error.requestId,
                timestamp: error.timestamp
            }
        };

        // Agregar información adicional en desarrollo
        if (process.env.NODE_ENV === 'development') {
            response.error.details = error.details;
            response.error.stack = error.stack;
            response.error.originalMessage = error.message;
        }

        // Agregar sugerencias de solución
        response.error.suggestions = this.getSuggestions(error);

        return response;
    }

    /**
     * Genera sugerencias para el usuario
     */
    getSuggestions(error) {
        const suggestions = {
            [ErrorCategory.VALIDATION]: [
                'Revise los datos enviados',
                'Verifique que todos los campos requeridos estén presentes',
                'Consulte la documentación para el formato correcto'
            ],
            [ErrorCategory.AUTHENTICATION]: [
                'Verifique sus credenciales',
                'Asegúrese de incluir el token de autenticación',
                'Contacte al administrador si el problema persiste'
            ],
            [ErrorCategory.AUTHORIZATION]: [
                'Verifique que tiene los permisos necesarios',
                'Contacte al administrador para solicitar acceso',
                'Use una cuenta con privilegios adecuados'
            ],
            [ErrorCategory.RATE_LIMIT]: [
                'Espere unos minutos antes de intentar nuevamente',
                'Reduzca la frecuencia de sus solicitudes',
                'Considere usar un plan con límites más altos'
            ],
            [ErrorCategory.EXTERNAL_API]: [
                'Inténtelo nuevamente en unos minutos',
                'Verifique su conexión a internet',
                'Contacte al soporte si el problema persiste'
            ],
            [ErrorCategory.NOT_FOUND]: [
                'Verifique la URL o los parámetros',
                'Consulte la documentación para recursos válidos',
                'Use el endpoint de health check para verificar el servicio'
            ],
            [ErrorCategory.TIMEOUT]: [
                'Inténtelo nuevamente',
                'Reduzca la complejidad de su solicitud',
                'Verifique su conexión a internet'
            ]
        };

        return suggestions[error.category] || [
            'Inténtelo nuevamente',
            'Contacte al soporte técnico si el problema persiste',
            'Consulte la documentación para más información'
        ];
    }

    /**
     * Sanitiza el body para logging (remueve información sensible)
     */
    sanitizeBody(body) {
        if (!body) return null;
        
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'credential'];
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
}

/**
 * Factory functions
 */
function createErrorLogger() {
    return new ErrorLogger();
}

function createErrorHandler(logger = null) {
    return new ErrorHandlerMiddleware(logger || new ErrorLogger());
}

/**
 * Helper functions para crear errores
 */
function createValidationError(message, details = {}) {
    return new ValidationError(message, details);
}

function createAuthenticationError(message, details = {}) {
    return new AuthenticationError(message, details);
}

function createAuthorizationError(message, details = {}) {
    return new AuthorizationError(message, details);
}

function createRateLimitError(message, details = {}) {
    return new RateLimitError(message, details);
}

function createExternalAPIError(message, details = {}) {
    return new ExternalAPIError(message, details);
}

function createInternalServerError(message, details = {}) {
    return new InternalServerError(message, details);
}

function createNotFoundError(message, details = {}) {
    return new NotFoundError(message, details);
}

function createBusinessLogicError(message, details = {}) {
    return new BusinessLogicError(message, details);
}

function createNetworkError(message, details = {}) {
    return new NetworkError(message, details);
}

function createTimeoutError(message, details = {}) {
    return new TimeoutError(message, details);
}

module.exports = {
    // Enums
    ErrorCategory,
    ErrorSeverity,
    
    // Classes
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    RateLimitError,
    ExternalAPIError,
    InternalServerError,
    NotFoundError,
    BusinessLogicError,
    NetworkError,
    TimeoutError,
    
    // Systems
    ErrorLogger,
    ErrorHandlerMiddleware,
    
    // Factories
    createErrorLogger,
    createErrorHandler,
    
    // Helpers
    createValidationError,
    createAuthenticationError,
    createAuthorizationError,
    createRateLimitError,
    createExternalAPIError,
    createInternalServerError,
    createNotFoundError,
    createBusinessLogicError,
    createNetworkError,
    createTimeoutError
};
