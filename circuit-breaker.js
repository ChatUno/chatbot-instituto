/**
 * Circuit Breaker Pattern - Chatbot IES Juan de Lanuza V4
 * Implementa circuit breaker para llamadas a API externas (GROQ)
 */

/**
 * Estados del Circuit Breaker
 */
const CircuitState = {
    CLOSED: 'closed',     // Funcionamiento normal
    OPEN: 'open',         // Circuito abierto, rechaza llamadas
    HALF_OPEN: 'half-open' // Semi-abierto, permite algunas llamadas de prueba
};

/**
 * Interfaz del Circuit Breaker
 */
class ICircuitBreaker {
    /**
     * Ejecuta una función con protección del circuit breaker
     * @param {Function} operation - Función a ejecutar
     * @returns {Promise} - Resultado de la operación
     */
    async execute(operation) {
        throw new Error('Method not implemented');
    }

    /**
     * Obtiene el estado actual del circuito
     * @returns {string} - Estado del circuito
     */
    getState() {
        throw new Error('Method not implemented');
    }

    /**
     * Reinicia el circuit breaker a estado cerrado
     */
    reset() {
        throw new Error('Method not implemented');
    }
}

/**
 * Implementación del Circuit Breaker con retry y backoff exponencial
 */
class CircuitBreaker extends ICircuitBreaker {
    constructor(options = {}) {
        super();
        
        // Configuración del circuit breaker
        this.failureThreshold = options.failureThreshold || 5;      // Fallos antes de abrir
        this.recoveryTimeout = options.recoveryTimeout || 60000;    // Tiempo en OPEN (ms)
        this.monitoringPeriod = options.monitoringPeriod || 10000;   // Período de monitoreo (ms)
        this.expectedRecoveryTime = options.expectedRecoveryTime || 30000; // Tiempo esperado de recuperación
        
        // Configuración de retry
        this.maxRetries = options.maxRetries || 3;
        this.initialRetryDelay = options.initialRetryDelay || 1000;   // 1 segundo
        this.maxRetryDelay = options.maxRetryDelay || 10000;         // 10 segundos
        this.retryBackoffMultiplier = options.retryBackoffMultiplier || 2;
        
        // Estado del circuito
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
        
        // Estadísticas
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            circuitBreakerTrips: 0,
            lastStateChange: Date.now(),
            averageResponseTime: 0,
            lastFailureError: null
        };
        
        // Callbacks para monitoreo
        this.onStateChange = options.onStateChange || (() => {});
        this.onSuccess = options.onSuccess || (() => {});
        this.onFailure = options.onFailure || (() => {});
        this.onRetry = options.onRetry || (() => {});
    }

    /**
     * Ejecuta una operación con protección del circuit breaker
     * @param {Function} operation - Función a ejecutar
     * @returns {Promise} - Resultado de la operación
     */
    async execute(operation) {
        const startTime = Date.now();
        this.stats.totalRequests++;
        
        try {
            // Verificar estado del circuito
            if (this.state === CircuitState.OPEN) {
                if (Date.now() < this.nextAttempt) {
                    const error = new Error('Circuit breaker is OPEN');
                    error.code = 'CIRCUIT_BREAKER_OPEN';
                    error.retryAfter = Math.ceil((this.nextAttempt - Date.now()) / 1000);
                    throw error;
                } else {
                    // Transición a HALF_OPEN
                    this.setState(CircuitState.HALF_OPEN);
                }
            }
            
            // Ejecutar operación con retry
            const result = await this.executeWithRetry(operation);
            
            // Éxito - actualizar estadísticas
            this.onSuccess(result);
            this.stats.successfulRequests++;
            this.stats.averageResponseTime = this.updateAverageResponseTime(startTime);
            
            // Si estábamos en HALF_OPEN, cerrar el circuito
            if (this.state === CircuitState.HALF_OPEN) {
                this.setState(CircuitState.CLOSED);
                this.failureCount = 0;
            }
            
            return result;
            
        } catch (error) {
            // Fallo - actualizar estadísticas
            this.onFailure(error);
            this.stats.failedRequests++;
            this.stats.lastFailureError = {
                message: error.message,
                code: error.code,
                timestamp: Date.now()
            };
            
            // Incrementar contador de fallos
            this.failureCount++;
            this.lastFailureTime = Date.now();
            
            // Abrir circuito si se supera el umbral
            if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
                this.setState(CircuitState.OPEN);
                this.nextAttempt = Date.now() + this.recoveryTimeout;
            } else if (this.state === CircuitState.HALF_OPEN) {
                // Volver a OPEN si falla en HALF_OPEN
                this.setState(CircuitState.OPEN);
                this.nextAttempt = Date.now() + this.recoveryTimeout;
            }
            
            throw error;
        }
    }

    /**
     * Ejecuta operación con retry y backoff exponencial
     * @param {Function} operation - Función a ejecutar
     * @returns {Promise} - Resultado de la operación
     */
    async executeWithRetry(operation) {
        let lastError = null;
        let retryDelay = this.initialRetryDelay;
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    this.onRetry(attempt, lastError);
                    await this.delay(retryDelay);
                    retryDelay = Math.min(
                        retryDelay * this.retryBackoffMultiplier,
                        this.maxRetryDelay
                    );
                }
                
                return await operation();
                
            } catch (error) {
                lastError = error;
                
                // No reintentar ciertos errores
                if (this.shouldNotRetry(error)) {
                    throw error;
                }
                
                // Último intento, propagar error
                if (attempt === this.maxRetries) {
                    throw error;
                }
            }
        }
    }

    /**
     * Determina si un error no debe ser reintentado
     * @param {Error} error - Error a evaluar
     * @returns {boolean} - True si no debe reintentar
     */
    shouldNotRetry(error) {
        // Errores de autenticación no se reintentan
        if (error.code === 401 || error.status === 401) {
            return true;
        }
        
        // Errores de cliente (4xx) no se reintentan
        if (error.status >= 400 && error.status < 500) {
            return true;
        }
        
        // Errores de circuit breaker no se reintentan
        if (error.code === 'CIRCUIT_BREAKER_OPEN') {
            return true;
        }
        
        return false;
    }

    /**
     * Actualiza el tiempo promedio de respuesta
     * @param {number} startTime - Tiempo de inicio
     * @returns {number} - Nuevo promedio
     */
    updateAverageResponseTime(startTime) {
        const responseTime = Date.now() - startTime;
        const total = this.stats.successfulRequests + this.stats.failedRequests;
        return (this.stats.averageResponseTime * (total - 1) + responseTime) / total;
    }

    /**
     * Cambia el estado del circuit breaker
     * @param {string} newState - Nuevo estado
     */
    setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;
            this.stats.lastStateChange = Date.now();
            
            if (newState === CircuitState.OPEN) {
                this.stats.circuitBreakerTrips++;
            }
            
            this.onStateChange(oldState, newState);
        }
    }

    /**
     * Obtiene el estado actual del circuito
     * @returns {string} - Estado del circuito
     */
    getState() {
        return this.state;
    }

    /**
     * Reinicia el circuit breaker
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
        this.stats.lastStateChange = Date.now();
    }

    /**
     * Obtiene estadísticas del circuit breaker
     * @returns {Object} - Estadísticas actuales
     */
    getStats() {
        const successRate = this.stats.totalRequests > 0 
            ? (this.stats.successfulRequests / this.stats.totalRequests) * 100 
            : 0;
            
        return {
            ...this.stats,
            successRate: Math.round(successRate * 100) / 100,
            currentState: this.state,
            failureCount: this.failureCount,
            isHealthy: this.state === CircuitState.CLOSED && successRate > 80,
            nextRetryAttempt: this.nextAttempt,
            timeUntilRetry: this.nextAttempt ? Math.max(0, this.nextAttempt - Date.now()) : 0
        };
    }

    /**
     * Verifica si el circuit breaker está saludable
     * @returns {boolean} - True si está saludable
     */
    isHealthy() {
        const stats = this.getStats();
        return stats.isHealthy;
    }

    /**
     * Función de delay para retry
     * @param {number} ms - Milisegundos a esperar
     * @returns {Promise} - Promise que resuelve después del delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Factory para crear circuit breaker con configuración por defecto
 */
function createCircuitBreaker(options = {}) {
    const defaultOptions = {
        failureThreshold: 5,
        recoveryTimeout: 60000,        // 1 minuto
        monitoringPeriod: 10000,       // 10 segundos
        expectedRecoveryTime: 30000,    // 30 segundos
        maxRetries: 3,
        initialRetryDelay: 1000,        // 1 segundo
        maxRetryDelay: 10000,           // 10 segundos
        retryBackoffMultiplier: 2,
        
        // Callbacks de monitoreo
        onStateChange: (oldState, newState) => {
            console.log(`Circuit Breaker state change: ${oldState} -> ${newState}`);
        },
        onSuccess: (result) => {
            console.log('Circuit Breaker: Operation successful');
        },
        onFailure: (error) => {
            console.error('Circuit Breaker: Operation failed:', error.message);
        },
        onRetry: (attempt, error) => {
            console.log(`Circuit Breaker: Retry attempt ${attempt}, error: ${error.message}`);
        }
    };
    
    return new CircuitBreaker({ ...defaultOptions, ...options });
}

/**
 * Wrapper para API calls con circuit breaker
 */
class APIWrapper {
    constructor(circuitBreaker) {
        this.circuitBreaker = circuitBreaker;
    }
    
    /**
     * Wrapper para llamadas a API GROQ
     * @param {string} prompt - Prompt a enviar
     * @returns {Promise<string>} - Respuesta de la API
     */
    async callGroqAPI(prompt) {
        return this.circuitBreaker.execute(async () => {
            const axios = require('axios');
            const { getValidatedConfig } = require('./config');
            const config = getValidatedConfig();
            
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
        });
    }
}

/**
 * Factory para crear API wrapper
 */
function createAPIWrapper(options = {}) {
    const circuitBreaker = createCircuitBreaker(options);
    return new APIWrapper(circuitBreaker);
}

module.exports = {
    CircuitState,
    ICircuitBreaker,
    CircuitBreaker,
    APIWrapper,
    createCircuitBreaker,
    createAPIWrapper
};
