/**
 * Dependency Injection Container - Chatbot IES Juan de Lanuza V4
 * Permite inyección de dependencias para testing y desacoplamiento
 */

class DIContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
    }

    /**
     * Registra un servicio como singleton
     * @param {string} name - Nombre del servicio
     * @param {Function} factory - Función factory que crea el servicio
     */
    registerSingleton(name, factory) {
        this.factories.set(name, factory);
        return this;
    }

    /**
     * Registra un servicio como transient (nueva instancia cada vez)
     * @param {string} name - Nombre del servicio
     * @param {Function} factory - Función factory que crea el servicio
     */
    registerTransient(name, factory) {
        this.services.set(name, factory);
        return this;
    }

    /**
     * Registra una instancia existente
     * @param {string} name - Nombre del servicio
     * @param {*} instance - Instancia a registrar
     */
    registerInstance(name, instance) {
        this.singletons.set(name, instance);
        return this;
    }

    /**
     * Resuelve una dependencia
     * @param {string} name - Nombre del servicio
     * @returns {*} Instancia del servicio
     */
    resolve(name) {
        // Si ya existe como singleton, retornarlo
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        // Si es un factory de singleton, crear y guardar
        if (this.factories.has(name)) {
            const factory = this.factories.get(name);
            const instance = factory(this);
            this.singletons.set(name, instance);
            return instance;
        }

        // Si es un transient, crear nueva instancia cada vez
        if (this.services.has(name)) {
            const factory = this.services.get(name);
            return factory(this);
        }

        throw new Error(`Service '${name}' not registered in container`);
    }

    /**
     * Verifica si un servicio está registrado
     * @param {string} name - Nombre del servicio
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name) || 
               this.factories.has(name) || 
               this.singletons.has(name);
    }

    /**
     * Limpia el container (útil para testing)
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
    }

    /**
     * Crea un scope aislado (para testing)
     * @returns {DIContainer} Nuevo container con herencia de servicios
     */
    createScope() {
        const scope = new DIContainer();
        
        // Heredar factories y singletons del parent
        this.factories.forEach((factory, name) => {
            scope.factories.set(name, factory);
        });
        
        this.singletons.forEach((instance, name) => {
            scope.singletons.set(name, instance);
        });
        
        return scope;
    }
}

/**
 * Configuración del container principal
 */
function configureContainer() {
    const container = new DIContainer();

    // Configuración
    container.registerSingleton('config', () => {
        const { getValidatedConfig } = require("../utils/config");
        return getValidatedConfig();
    });

    // Sistema de memoria
    container.registerTransient('memoryManager', (container) => {
        const { createMemoryManager } = require("../services/memory-service");
        const config = container.resolve('config');
        return createMemoryManager(config.memory.maxExchanges);
    });

    // Sistema de observabilidad
    container.registerTransient('observabilityManager', (container) => {
        const { createObservabilityManager } = require("../services/observability-service");
        const config = container.resolve('config');
        return createObservabilityManager({
            maxLogs: config.observability.maxLogs,
            debugMode: config.observability.debugMode
        });
    });

    // Cliente AI
    container.registerSingleton('aiClient', () => {
        const { getAIResponse } = require("../core/ai-client");
        return { getAIResponse };
    });

    // Sistema de búsqueda (RAG)
    container.registerSingleton('searchService', (container) => {
        const { semanticSearch, buildIntelligentContext, detectIntent } = require("../services/search-service");
        return {
            semanticSearch,
            buildIntelligentContext,
            detectIntent
        };
    });

    // Sistema de embeddings
    container.registerSingleton('embeddingService', (container) => {
        const { 
            calculateScore, 
            calculateBaseScore, 
            calculateIntelligentBoosts, 
            calculatePenalties,
            detectIntent 
        } = require("../services/embedding-service");
        return {
            calculateScore,
            calculateBaseScore,
            calculateIntelligentBoosts,
            calculatePenalties,
            detectIntent
        };
    });

    // Sistema de prompts
    container.registerSingleton('promptSystem', () => {
        const { createDefinitivePromptSystem } = require("../services/prompt-service");
        return createDefinitivePromptSystem();
    });

    // Sistema de response polishing
    container.registerSingleton('responsePolisher', () => {
        const { ResponsePolishingSystem } = require("../services/response-polishing-service");
        return ResponsePolishingSystem;
    });

    // Sistema de validación
    container.registerSingleton('validationService', () => {
        const { 
            validateChatRequest, 
            validateChunksRequest, 
            validateChunksQuery,
            validateConfiguration
        } = require("../security/validation");
        return {
            validateChatRequest,
            validateChunksRequest,
            validateChunksQuery,
            validateConfiguration
        };
    });

    // Servicio principal del chatbot
    container.registerTransient('chatbotService', (container) => {
        const config = container.resolve('config');
        const aiClient = container.resolve('aiClient');
        const searchService = container.resolve('searchService');
        const promptSystem = container.resolve('promptSystem');
        const responsePolisher = container.resolve('responsePolisher');
        
        return {
            async handleUserQuery(question) {
                // Crear instancias request-scoped
                const memoryManager = container.resolve('memoryManager');
                const observabilityManager = container.resolve('observabilityManager');
                
                const startTime = Date.now();
                let finalResponse = '';
                let source = 'rag';
                let promptMode = 'relevant';
                
                try {
                    console.log("=== INICIANDO BÚSQUEDA RAG CON MEMORIA ===");
                    console.log("Pregunta:", question);
                    console.log("Estado memoria:", memoryManager.getStats());

                    // 1. Obtener memoria conversacional actual
                    const memory = memoryManager.getMemory();
                    
                    // 2. Intentar búsqueda simple primero (RAG)
                    try {
                        const searchResults = searchService.semanticSearch(question, 3);
                        console.log("Búsqueda simple completada. Encontrados", searchResults.length, "resultados");
                        
                        if (searchResults.length > 0) {
                            console.log("RAG: Se encontraron resultados de búsqueda simple");
                            
                            // 3. Construir contexto inteligente
                            const context = searchService.buildIntelligentContext(searchResults, question);
                            console.log("Contexto construido, longitud:", context.length);
                            
                            // 4. Aplicar límite de tamaño al contexto
                            const maxLength = config.memory.maxContextLength;
                            let content = context;
                            if (content.length > maxLength) {
                                content = content.substring(0, maxLength - 100) + '\n... [Contenido truncado por límite de tamaño]';
                            }
                            
                            // 5. Construir prompt definitivo
                            const prompt = promptSystem.buildPrompt(question, content, memory);
                            console.log("Prompt construido, longitud:", prompt.length);
                            
                            // 6. Llamar a la IA
                            const aiResponse = await aiClient.getAIResponse(prompt);
                            console.log("Respuesta IA recibida, longitud:", aiResponse.length);
                            
                            // 7. Validar anti-hallucination
                            const validationResult = promptSystem.validateAntiHallucination(aiResponse, content);
                            if (!validationResult.isValid) {
                                console.log("RAG: Respuesta rechazada por anti-hallucination");
                                throw new Error("La respuesta contiene información no presente en el contexto");
                            }
                            
                            console.log("RAG: Respuesta validada exitosamente");
                            
                            // 8. Aplicar response polishing
                            const polishedResponse = responsePolisher.polishResponse(aiResponse, {
                                originalQuestion: question,
                                context: content,
                                source: 'rag'
                            });
                            
                            // 9. Añadir intercambio a la memoria con respuesta pulida
                            memoryManager.addExchange(question, polishedResponse.answer);
                            return polishedResponse.answer;
                        } else {
                            console.log("RAG: No se encontraron resultados, usando fallback");
                        }
                    } catch (ragError) {
                        console.error("Error en RAG, usando fallback:", ragError.message);
                    }
                    
                    // 3. Fallback al sistema original basado en palabras clave
                    console.log("=== USANDO SISTEMA ORIGINAL (FALLBACK) ===");
                    
                    const intent = searchService.detectIntent(question);
                    console.log("Intent detectado:", intent);
                    
                    // Lógica simple de fallback
                    const fallbackResponses = {
                        'oferta': 'En el centro ofrecemos diversos ciclos formativos de grado medio y superior. Puedes consultar la oferta educativa completa en nuestro sitio web.',
                        'centro': 'IES Juan de Lanuza es un Instituto de Educación Secundaria ubicado en Borja, Zaragoza. Ofrecemos educación secundaria obligatoria, bachillerato y formación profesional.',
                        'general': 'Soy un asistente del IES Juan de Lanuza. Puedo ayudarte con información sobre nuestra oferta educativa, el centro y nuestros programas.'
                    };
                    
                    const fallbackResponse = fallbackResponses[intent] || fallbackResponses['general'];
                    
                    // Aplicar polishing al fallback
                    const polishedFallback = responsePolisher.polishResponse(fallbackResponse, {
                        originalQuestion: question,
                        context: '',
                        source: 'fallback'
                    });
                    
                    // Añadir intercambio a la memoria con respuesta pulida
                    memoryManager.addExchange(question, polishedFallback.answer);
                    finalResponse = polishedFallback.answer;
                    source = 'fallback';
                    
                    return finalResponse;

                } catch (error) {
                    console.error('Error procesando la consulta:', error.message);
                    
                    // Logging del error
                    const endTime = Date.now();
                    const errorRequestData = {
                        query: question,
                        intent: 'error',
                        memory_used: false,
                        topChunks: [],
                        selectedChunks: [],
                        context_length: 0,
                        prompt_mode: 'error',
                        response_length: error.message.length,
                        latency_ms: endTime - startTime,
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
        };
    });

    return container;
}

/**
 * Container global para producción
 */
let globalContainer = null;

/**
 * Obtener el container global
 * @returns {DIContainer}
 */
function getContainer() {
    if (!globalContainer) {
        globalContainer = configureContainer();
    }
    return globalContainer;
}

/**
 * Resetear el container global (útil para testing)
 */
function resetContainer() {
    globalContainer = null;
}

module.exports = {
    DIContainer,
    configureContainer,
    getContainer,
    resetContainer
};
