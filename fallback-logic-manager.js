/**
 * Fallback Logic Manager - Chatbot IES Juan De Lanuza V4
 * Implementa lógica de fallback inteligente con scoring dinámico y selección contextual
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Tipos de estrategias de fallback
 */
const FallbackStrategy = {
    KEYWORD_BASED: 'keyword_based',
    SEMANTIC_FALLBACK: 'semantic_fallback',
    HYBRID: 'hybrid',
    CONTEXT_AWARE: 'context_aware',
    ADAPTIVE: 'adaptive'
};

/**
 * Niveles de confianza del fallback
 */
const FallbackConfidence = {
    VERY_LOW: 'very_low',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    VERY_HIGH: 'very_high'
};

/**
 * Sistema de gestión de lógica de fallback
 */
class FallbackLogicManager {
    constructor(options = {}) {
        this.options = {
            minScoreThreshold: options.minScoreThreshold || 0.3,
            maxFallbackScore: options.maxFallbackScore || 2.0,
            adaptiveScoring: options.adaptiveScoring !== false,
            contextWeight: options.contextWeight || 0.4,
            keywordWeight: options.keywordWeight || 0.3,
            semanticWeight: options.semanticWeight || 0.3,
            fallbackStrategies: options.fallbackStrategies || [
                FallbackStrategy.CONTEXT_AWARE,
                FallbackStrategy.SEMANTIC_FALLBACK,
                FallbackStrategy.KEYWORD_BASED
            ],
            ...options
        };
        
        // Historial de fallbacks para aprendizaje adaptativo
        this.fallbackHistory = [];
        this.maxHistorySize = 1000;
        
        // Métricas de rendimiento
        this.metrics = {
            totalFallbacks: 0,
            successfulFallbacks: 0,
            averageConfidence: 0,
            strategyUsage: {},
            responseQuality: []
        };
        
        // Patrones de preguntas problemáticas
        this.problematicPatterns = [
            /^(qué|cuál|cuáles|dónde|cuándo|cómo|por qué)\s+(es|son|está|están)\s+/i,
            /^(dime|informa|explica|describe)\s+/i,
            /^(busca|encuentra|busco|necesito)\s+/i,
            /^(hay|tiene|existe)\s+/i,
            /^(quiero|necesito|busco)\s+(información|datos|saber)\s+/i
        ];
        
        // Categorías de contexto para fallback
        this.contextCategories = {
            contacto: {
                keywords: ['teléfono', 'contacto', 'email', 'dirección', 'ubicación', 'horario'],
                files: ['centro.txt'],
                priority: 1,
                fallbackResponse: 'Para información de contacto, puedes llamar al 976 867 368 o escribir a iesborja@educa.aragon.es. El instituto está ubicado en C/ Capuchinos, 1, Borja (Zaragoza).'
            },
            oferta: {
                keywords: ['fp', 'bachillerato', 'ciclo', 'formación', 'estudiar', 'carrera'],
                files: ['oferta_educativa.txt', 'programas.txt'],
                priority: 2,
                fallbackResponse: 'El IES Juan de Lanuza ofrece Bachillerato y Formación Profesional. Puedes consultar la oferta educativa completa en nuestra web o contactando con secretaría.'
            },
            horarios: {
                keywords: ['horario', 'horarios', 'calendario', 'festivo', 'vacaciones'],
                files: ['calendario.txt'],
                priority: 1,
                fallbackResponse: 'El horario general del instituto es de lunes a viernes de 8:00 a 14:30. Para horarios específicos, consulta con secretaría.'
            },
            general: {
                keywords: ['instituto', 'centro', 'ies', 'juan de lanuza'],
                files: ['centro.txt'],
                priority: 3,
                fallbackResponse: 'Soy el asistente del IES Juan de Lanuza. Puedo ayudarte con información sobre nuestra oferta educativa, contactos y horarios.'
            }
        };
    }
    
    /**
     * Determina si se debe activar el fallback
     * @param {Object} searchResults - Resultados de la búsqueda principal
     * @param {string} query - Query del usuario
     * @returns {Object} - Decisión de fallback con scoring
     */
    shouldActivateFallback(searchResults, query) {
        const decision = {
            activate: false,
            reason: '',
            confidence: FallbackConfidence.VERY_LOW,
            strategy: null,
            score: 0,
            recommendations: []
        };
        
        // 1. Evaluar resultados de búsqueda
        const searchEvaluation = this.evaluateSearchResults(searchResults);
        
        // 2. Evaluar calidad del query
        const queryEvaluation = this.evaluateQueryQuality(query);
        
        // 3. Calcular score de activación
        const activationScore = this.calculateActivationScore(searchEvaluation, queryEvaluation);
        
        decision.score = activationScore;
        
        // 4. Determinar si activar
        if (searchResults.length === 0) {
            decision.activate = true;
            decision.reason = 'No search results found';
            decision.confidence = FallbackConfidence.HIGH;
        } else if (searchEvaluation.averageScore < this.options.minScoreThreshold) {
            decision.activate = true;
            decision.reason = 'Search results below threshold';
            decision.confidence = FallbackConfidence.MEDIUM;
        } else if (queryEvaluation.isProblematic) {
            decision.activate = true;
            decision.reason = 'Problematic query pattern detected';
            decision.confidence = FallbackConfidence.MEDIUM;
        } else if (searchEvaluation.hasLowConfidence) {
            decision.activate = true;
            decision.reason = 'Low confidence in search results';
            decision.confidence = FallbackConfidence.LOW;
        }
        
        // 5. Seleccionar estrategia
        if (decision.activate) {
            decision.strategy = this.selectOptimalStrategy(query, searchEvaluation);
            decision.recommendations = this.generateRecommendations(query, searchEvaluation);
        }
        
        return decision;
    }
    
    /**
     * Evalúa la calidad de los resultados de búsqueda
     * @param {Array} searchResults - Resultados de búsqueda
     * @returns {Object} - Evaluación de resultados
     */
    evaluateSearchResults(searchResults) {
        const evaluation = {
            totalResults: searchResults.length,
            averageScore: 0,
            maxScore: 0,
            minScore: 1,
            scoreDistribution: { high: 0, medium: 0, low: 0 },
            hasLowConfidence: false,
            sourceDiversity: new Set(),
            categoryDiversity: new Set()
        };
        
        if (searchResults.length === 0) {
            return evaluation;
        }
        
        // Calcular estadísticas de scores
        const scores = searchResults.map(r => r.score || 0);
        evaluation.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        evaluation.maxScore = Math.max(...scores);
        evaluation.minScore = Math.min(...scores);
        
        // Distribución de scores
        searchResults.forEach(result => {
            const score = result.score || 0;
            if (score >= 0.7) evaluation.scoreDistribution.high++;
            else if (score >= 0.4) evaluation.scoreDistribution.medium++;
            else evaluation.scoreDistribution.low++;
            
            // Diversidad de fuentes y categorías
            if (result.source) evaluation.sourceDiversity.add(result.source);
            if (result.category) evaluation.categoryDiversity.add(result.category);
        });
        
        // Detectar baja confianza
        evaluation.hasLowConfidence = 
            evaluation.averageScore < 0.3 ||
            evaluation.scoreDistribution.low > searchResults.length * 0.7 ||
            evaluation.sourceDiversity.size === 1;
        
        return evaluation;
    }
    
    /**
     * Evalúa la calidad del query
     * @param {string} query - Query a evaluar
     * @returns {Object} - Evaluación del query
     */
    evaluateQueryQuality(query) {
        const evaluation = {
            length: query.length,
            wordCount: query.split(/\s+/).filter(w => w.length > 0).length,
            isProblematic: false,
            hasKeywords: false,
            clarity: 'medium',
            intent: 'unknown'
        };
        
        // Detectar patrones problemáticos
        evaluation.isProblematic = this.problematicPatterns.some(pattern => 
            pattern.test(query)
        );
        
        // Detectar palabras clave
        evaluation.hasKeywords = this.hasRelevantKeywords(query);
        
        // Evaluar claridad
        if (evaluation.wordCount < 3) {
            evaluation.clarity = 'low';
        } else if (evaluation.wordCount > 10) {
            evaluation.clarity = 'high';
        }
        
        // Detectar intent
        evaluation.intent = this.detectQueryIntent(query);
        
        return evaluation;
    }
    
    /**
     * Calcula score de activación del fallback
     * @param {Object} searchEvaluation - Evaluación de búsqueda
     * @param {Object} queryEvaluation - Evaluación de query
     * @returns {number} - Score de activación (0-1)
     */
    calculateActivationScore(searchEvaluation, queryEvaluation) {
        let score = 0;
        
        // Factor 1: Calidad de resultados (40%)
        if (searchEvaluation.totalResults === 0) {
            score += 0.4;
        } else {
            score += (1 - searchEvaluation.averageScore) * 0.4;
        }
        
        // Factor 2: Problemas en query (30%)
        if (queryEvaluation.isProblematic) {
            score += 0.3;
        } else if (queryEvaluation.clarity === 'low') {
            score += 0.15;
        }
        
        // Factor 3: Diversidad de fuentes (20%)
        if (searchEvaluation.sourceDiversity.size === 1) {
            score += 0.2;
        } else if (searchEvaluation.sourceDiversity.size === 2) {
            score += 0.1;
        }
        
        // Factor 4: Presencia de palabras clave (10%)
        if (!queryEvaluation.hasKeywords) {
            score += 0.1;
        }
        
        return Math.min(1, score);
    }
    
    /**
     * Selecciona la estrategia óptima de fallback
     * @param {string} query - Query del usuario
     * @param {Object} searchEvaluation - Evaluación de búsqueda
     * @returns {string} - Estrategia seleccionada
     */
    selectOptimalStrategy(query, searchEvaluation) {
        // Basado en el historial y contexto actual
        const context = this.detectQueryContext(query);
        
        if (context && this.options.fallbackStrategies.includes(FallbackStrategy.CONTEXT_AWARE)) {
            return FallbackStrategy.CONTEXT_AWARE;
        }
        
        if (searchEvaluation.totalResults > 0 && searchEvaluation.averageScore > 0.2) {
            return FallbackStrategy.SEMANTIC_FALLBACK;
        }
        
        if (this.options.adaptiveScoring && this.fallbackHistory.length > 10) {
            return FallbackStrategy.ADAPTIVE;
        }
        
        return FallbackStrategy.KEYWORD_BASED;
    }
    
    /**
     * Ejecuta la estrategia de fallback seleccionada
     * @param {string} strategy - Estrategia a ejecutar
     * @param {string} query - Query del usuario
     * @param {Object} context - Contexto adicional
     * @returns {Object} - Resultado del fallback
     */
    async executeFallback(strategy, query, context = {}) {
        const startTime = Date.now();
        const result = {
            strategy: strategy,
            query: query,
            success: false,
            response: '',
            confidence: FallbackConfidence.VERY_LOW,
            score: 0,
            sources: [],
            reasoning: '',
            executionTime: 0
        };
        
        try {
            switch (strategy) {
                case FallbackStrategy.CONTEXT_AWARE:
                    result.response = await this.executeContextAwareFallback(query, context);
                    break;
                case FallbackStrategy.SEMANTIC_FALLBACK:
                    result.response = await this.executeSemanticFallback(query, context);
                    break;
                case FallbackStrategy.HYBRID:
                    result.response = await this.executeHybridFallback(query, context);
                    break;
                case FallbackStrategy.ADAPTIVE:
                    result.response = await this.executeAdaptiveFallback(query, context);
                    break;
                default:
                    result.response = await this.executeKeywordBasedFallback(query, context);
            }
            
            result.success = true;
            result.confidence = this.calculateResponseConfidence(result.response, query);
            result.score = this.calculateFallbackScore(result.response, query);
            result.reasoning = this.generateReasoning(strategy, query, result);
            
        } catch (error) {
            console.error(`Fallback strategy ${strategy} failed:`, error);
            result.response = this.generateEmergencyFallback(query);
            result.success = false;
            result.confidence = FallbackConfidence.VERY_LOW;
            result.reasoning = 'Strategy failed, using emergency fallback';
        }
        
        result.executionTime = Date.now() - startTime;
        
        // Actualizar métricas
        this.updateMetrics(result);
        
        // Agregar al historial
        this.addToHistory(result);
        
        return result;
    }
    
    /**
     * Ejecuta fallback basado en contexto
     * @param {string} query - Query del usuario
     * @param {Object} context - Contexto adicional
     * @returns {string} - Respuesta generada
     */
    async executeContextAwareFallback(query, context) {
        const queryContext = this.detectQueryContext(query);
        
        if (queryContext && this.contextCategories[queryContext]) {
            const category = this.contextCategories[queryContext];
            
            // Intentar leer archivos relevantes
            const fileContent = await this.readCategoryFiles(category.files);
            
            if (fileContent.length > 0) {
                return this.generateContextualResponse(query, fileContent, category);
            } else {
                return category.fallbackResponse;
            }
        }
        
        // Si no hay contexto claro, usar keyword-based
        return await this.executeKeywordBasedFallback(query, context);
    }
    
    /**
     * Ejecuta fallback semántico
     * @param {string} query - Query del usuario
     * @param {Object} context - Contexto adicional
     * @returns {string} - Respuesta generada
     */
    async executeSemanticFallback(query, context) {
        // Usar búsqueda semántica con umbral más bajo
        const { simpleSearch } = require('./embedding');
        const chunks = await this.loadAllChunks();
        
        // Búsqueda con umbral reducido
        const results = simpleSearch(query, chunks);
        const relevantResults = results.filter(r => r.score > 0.1);
        
        if (relevantResults.length > 0) {
            // Generar respuesta con resultados semánticos
            return this.generateSemanticResponse(query, relevantResults);
        }
        
        // Fallback a keyword-based
        return await this.executeKeywordBasedFallback(query, context);
    }
    
    /**
     * Ejecuta fallback híbrido
     * @param {string} query - Query del usuario
     * @param {Object} context - Contexto adicional
     * @returns {string} - Respuesta generada
     */
    async executeHybridFallback(query, context) {
        // Combinar múltiples estrategias
        const contextResult = await this.executeContextAwareFallback(query, context);
        const keywordResult = await this.executeKeywordBasedFallback(query, context);
        
        // Elegir la mejor respuesta basada en longitud y relevancia
        const responses = [contextResult, keywordResult].filter(r => r && r.length > 20);
        
        if (responses.length > 0) {
            // Seleccionar la respuesta más completa
            return responses.reduce((best, current) => 
                current.length > best.length ? current : best
            );
        }
        
        return this.generateEmergencyFallback(query);
    }
    
    /**
     * Ejecuta fallback adaptativo
     * @param {string} query - Query del usuario
     * @param {Object} context - Contexto adicional
     * @returns {string} - Respuesta generada
     */
    async executeAdaptiveFallback(query, context) {
        // Analizar historial para encontrar patrones
        const similarQueries = this.findSimilarQueries(query);
        
        if (similarQueries.length > 0) {
            // Usar la estrategia que funcionó mejor para queries similares
            const bestStrategy = this.findBestStrategyForQueries(similarQueries);
            return await this.executeFallback(bestStrategy, query, context);
        }
        
        // Si no hay historial relevante, usar contexto-aware
        return await this.executeContextAwareFallback(query, context);
    }
    
    /**
     * Ejecuta fallback basado en palabras clave
     * @param {string} query - Query del usuario
     * @param {Object} context - Contexto adicional
     * @returns {string} - Respuesta generada
     */
    async executeKeywordBasedFallback(query, context) {
        const categories = this.classifyQuestion(query);
        const relevantFiles = this.getRelevantFiles(categories);
        const fileContent = await this.readCategoryFiles(relevantFiles);
        
        if (fileContent.length > 0) {
            return this.generateKeywordResponse(query, fileContent, categories);
        }
        
        return this.generateGenericFallback(query);
    }
    
    /**
     * Detecta el contexto del query
     * @param {string} query - Query a analizar
     * @returns {string|null} - Contexto detectado
     */
    detectQueryContext(query) {
        const queryLower = query.toLowerCase();
        
        for (const [context, category] of Object.entries(this.contextCategories)) {
            const keywordMatches = category.keywords.filter(keyword => 
                queryLower.includes(keyword)
            ).length;
            
            if (keywordMatches >= 2) {
                return context;
            }
        }
        
        return null;
    }
    
    /**
     * Clasifica la pregunta por categorías
     * @param {string} question - Pregunta a clasificar
     * @returns {Array} - Categorías detectadas
     */
    classifyQuestion(question) {
        const questionLower = question.toLowerCase();
        const detectedCategories = new Set();
        
        for (const [context, category] of Object.entries(this.contextCategories)) {
            const hasKeyword = category.keywords.some(keyword => 
                questionLower.includes(keyword)
            );
            
            if (hasKeyword) {
                detectedCategories.add(context);
            }
        }
        
        return Array.from(detectedCategories);
    }
    
    /**
     * Obtiene archivos relevantes para las categorías
     * @param {Array} categories - Categorías detectadas
     * @returns {Array} - Archivos relevantes
     */
    getRelevantFiles(categories) {
        const files = new Set();
        
        categories.forEach(category => {
            if (this.contextCategories[category]) {
                this.contextCategories[category].files.forEach(file => 
                    files.add(file)
                );
            }
        });
        
        return Array.from(files);
    }
    
    /**
     * Lee archivos de categorías
     * @param {Array} files - Archivos a leer
     * @returns {Array} - Contenido de los archivos
     */
    async readCategoryFiles(files) {
        const content = [];
        
        for (const file of files) {
            try {
                const filePath = path.join(__dirname, 'data', file);
                const fileContent = await fs.readFile(filePath, 'utf8');
                content.push({ file, content: fileContent.trim() });
            } catch (error) {
                console.warn(`Could not read file ${file}:`, error.message);
            }
        }
        
        return content;
    }
    
    /**
     * Genera respuesta contextual
     * @param {string} query - Query del usuario
     * @param {Array} fileContent - Contenido de archivos
     * @param {Object} category - Categoría detectada
     * @returns {string} - Respuesta generada
     */
    generateContextualResponse(query, fileContent, category) {
        const combinedContent = fileContent.map(f => f.content).join('\n\n');
        
        // Extraer información relevante
        const relevantInfo = this.extractRelevantInfo(query, combinedContent);
        
        if (relevantInfo.length > 0) {
            return this.formatResponse(query, relevantInfo, category);
        }
        
        return category.fallbackResponse;
    }
    
    /**
     * Genera respuesta semántica
     * @param {string} query - Query del usuario
     * @param {Array} results - Resultados semánticos
     * @returns {string} - Respuesta generada
     */
    generateSemanticResponse(query, results) {
        const relevantTexts = results
            .filter(r => r.score > 0.2)
            .slice(0, 3)
            .map(r => r.text);
        
        if (relevantTexts.length > 0) {
            const combinedText = relevantTexts.join('\n\n');
            return this.formatResponse(query, combinedText, { priority: 2 });
        }
        
        return this.generateGenericFallback(query);
    }
    
    /**
     * Genera respuesta basada en palabras clave
     * @param {string} query - Query del usuario
     * @param {Array} fileContent - Contenido de archivos
     * @param {Array} categories - Categorías detectadas
     * @returns {string} - Respuesta generada
     */
    generateKeywordResponse(query, fileContent, categories) {
        const combinedContent = fileContent.map(f => f.content).join('\n\n');
        const relevantInfo = this.extractRelevantInfo(query, combinedContent);
        
        if (relevantInfo.length > 0) {
            return this.formatResponse(query, relevantInfo, { priority: 2 });
        }
        
        return this.generateGenericFallback(query);
    }
    
    /**
     * Extrae información relevante del contenido
     * @param {string} query - Query del usuario
     * @param {string} content - Contenido a analizar
     * @returns {string} - Información relevante
     */
    extractRelevantInfo(query, content) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const contentLines = content.split('\n');
        
        const relevantLines = contentLines.filter(line => {
            const lineLower = line.toLowerCase();
            return queryWords.some(word => 
                word.length > 2 && lineLower.includes(word)
            );
        });
        
        return relevantLines.slice(0, 5).join('\n');
    }
    
    /**
     * Formatea la respuesta
     * @param {string} query - Query del usuario
     * @param {string} relevantInfo - Información relevante
     * @param {Object} category - Categoría
     * @returns {string} - Respuesta formateada
     */
    formatResponse(query, relevantInfo, category) {
        return `Basado en la información disponible sobre ${category.priority === 1 ? 'contacto y ubicación' : 'la oferta educativa'}, te puedo decir que:\n\n${relevantInfo}\n\nSi necesitas más información específica, te recomiendo contactar directamente con secretaría del instituto.`;
    }
    
    /**
     * Genera fallback genérico
     * @param {string} query - Query del usuario
     * @returns {string} - Respuesta genérica
     */
    generateGenericFallback(query) {
        return `Entiendo que quieres información sobre "${query}". Como asistente del IES Juan de Lanuza, te recomiendo:\n\n1. Contactar directamente con secretaría en el 976 867 368\n2. Visitar nuestra web oficial\n3. Especificar mejor tu consulta (por ejemplo: "horario de secretaría", "FP de informática", etc.)\n\n¿Hay algún tema específico sobre el que pueda ayudarte?`;
    }
    
    /**
     * Genera fallback de emergencia
     * @param {string} query - Query del usuario
     * @returns {string} - Respuesta de emergencia
     */
    generateEmergencyFallback(query) {
        return `Lo siento, no puedo encontrar información específica sobre "${query}". Por favor, contacta con el IES Juan de Lanuza:\n\nTeléfono: 976 867 368\nEmail: iesborja@educa.aragon.es\nUbicación: C/ Capuchinos, 1, Borja (Zaragoza)`;
    }
    
    /**
     * Calcula confianza de la respuesta
     * @param {string} response - Respuesta generada
     * @param {string} query - Query original
     * @returns {string} - Nivel de confianza
     */
    calculateResponseConfidence(response, query) {
        const responseLength = response.length;
        const queryWords = query.toLowerCase().split(/\s+/);
        const responseLower = response.toLowerCase();
        
        // Contar palabras del query en la respuesta
        const matchingWords = queryWords.filter(word => 
            word.length > 2 && responseLower.includes(word)
        ).length;
        
        const matchRatio = matchingWords / queryWords.length;
        
        if (responseLength > 200 && matchRatio > 0.5) {
            return FallbackConfidence.HIGH;
        } else if (responseLength > 100 && matchRatio > 0.3) {
            return FallbackConfidence.MEDIUM;
        } else if (responseLength > 50) {
            return FallbackConfidence.LOW;
        } else {
            return FallbackConfidence.VERY_LOW;
        }
    }
    
    /**
     * Calcula score del fallback
     * @param {string} response - Respuesta generada
     * @param {string} query - Query original
     * @returns {number} - Score calculado
     */
    calculateFallbackScore(response, query) {
        const confidence = this.calculateResponseConfidence(response, query);
        const confidenceScores = {
            [FallbackConfidence.VERY_HIGH]: 0.9,
            [FallbackConfidence.HIGH]: 0.7,
            [FallbackConfidence.MEDIUM]: 0.5,
            [FallbackConfidence.LOW]: 0.3,
            [FallbackConfidence.VERY_LOW]: 0.1
        };
        
        return Math.min(this.options.maxFallbackScore, confidenceScores[confidence] * 2);
    }
    
    /**
     * Genera razonamiento del fallback
     * @param {string} strategy - Estrategia usada
     * @param {string} query - Query original
     * @param {Object} result - Resultado del fallback
     * @returns {string} - Razonamiento generado
     */
    generateReasoning(strategy, query, result) {
        return `Fallback activated using ${strategy} strategy for query "${query}". Confidence: ${result.confidence}, Score: ${result.score.toFixed(2)}`;
    }
    
    /**
     * Actualiza métricas del sistema
     * @param {Object} result - Resultado del fallback
     */
    updateMetrics(result) {
        this.metrics.totalFallbacks++;
        
        if (result.success) {
            this.metrics.successfulFallbacks++;
        }
        
        // Actualizar uso de estrategias
        this.metrics.strategyUsage[result.strategy] = 
            (this.metrics.strategyUsage[result.strategy] || 0) + 1;
        
        // Actualizar confianza promedio
        const confidenceValues = {
            [FallbackConfidence.VERY_HIGH]: 1.0,
            [FallbackConfidence.HIGH]: 0.8,
            [FallbackConfidence.MEDIUM]: 0.6,
            [FallbackConfidence.LOW]: 0.4,
            [FallbackConfidence.VERY_LOW]: 0.2
        };
        
        const confidenceValue = confidenceValues[result.confidence];
        this.metrics.averageConfidence = 
            (this.metrics.averageConfidence * (this.metrics.totalFallbacks - 1) + confidenceValue) / 
            this.metrics.totalFallbacks;
        
        // Guardar calidad de respuesta
        this.metrics.responseQuality.push({
            timestamp: new Date().toISOString(),
            score: result.score,
            confidence: result.confidence,
            strategy: result.strategy,
            success: result.success
        });
        
        // Mantener tamaño del historial
        if (this.metrics.responseQuality.length > 100) {
            this.metrics.responseQuality = this.metrics.responseQuality.slice(-100);
        }
    }
    
    /**
     * Agrega resultado al historial
     * @param {Object} result - Resultado a agregar
     */
    addToHistory(result) {
        this.fallbackHistory.push({
            ...result,
            timestamp: new Date().toISOString()
        });
        
        // Mantener tamaño del historial
        if (this.fallbackHistory.length > this.maxHistorySize) {
            this.fallbackHistory = this.fallbackHistory.slice(-this.maxHistorySize);
        }
    }
    
    /**
     * Encuentra queries similares en el historial
     * @param {string} query - Query a comparar
     * @returns {Array} - Queries similares
     */
    findSimilarQueries(query) {
        const queryWords = query.toLowerCase().split(/\s+/);
        
        return this.fallbackHistory.filter(entry => {
            const entryWords = entry.query.toLowerCase().split(/\s+/);
            const commonWords = queryWords.filter(word => 
                entryWords.includes(word)
            ).length;
            
            return commonWords >= 2;
        });
    }
    
    /**
     * Encuentra la mejor estrategia para queries similares
     * @param {Array} similarQueries - Queries similares
     * @returns {string} - Mejor estrategia
     */
    findBestStrategyForQueries(similarQueries) {
        const strategyScores = {};
        
        similarQueries.forEach(entry => {
            if (!strategyScores[entry.strategy]) {
                strategyScores[entry.strategy] = {
                    count: 0,
                    totalScore: 0,
                    successCount: 0
                };
            }
            
            strategyScores[entry.strategy].count++;
            strategyScores[entry.strategy].totalScore += entry.score;
            if (entry.success) {
                strategyScores[entry.strategy].successCount++;
            }
        });
        
        // Encontrar la estrategia con mejor score promedio
        let bestStrategy = FallbackStrategy.KEYWORD_BASED;
        let bestScore = 0;
        
        for (const [strategy, stats] of Object.entries(strategyScores)) {
            const avgScore = stats.totalScore / stats.count;
            const successRate = stats.successCount / stats.count;
            const combinedScore = avgScore * 0.7 + successRate * 0.3;
            
            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                bestStrategy = strategy;
            }
        }
        
        return bestStrategy;
    }
    
    /**
     * Verifica si el query tiene palabras clave relevantes
     * @param {string} query - Query a verificar
     * @returns {boolean} - Si tiene palabras clave
     */
    hasRelevantKeywords(query) {
        const queryLower = query.toLowerCase();
        
        for (const category of Object.values(this.contextCategories)) {
            if (category.keywords.some(keyword => queryLower.includes(keyword))) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Detecta el intent del query
     * @param {string} query - Query a analizar
     * @returns {string} - Intent detectado
     */
    detectQueryIntent(query) {
        const queryLower = query.toLowerCase();
        
        if (queryLower.includes('qué') || queryLower.includes('cuál')) {
            return 'information_seeking';
        } else if (queryLower.includes('dónde') || queryLower.includes('ubicación')) {
            return 'location_seeking';
        } else if (queryLower.includes('cuándo') || queryLower.includes('horario')) {
            return 'time_seeking';
        } else if (queryLower.includes('cómo') || queryLower.includes('contacto')) {
            return 'process_seeking';
        }
        
        return 'general';
    }
    
    /**
     * Genera recomendaciones
     * @param {string} query - Query original
     * @param {Object} searchEvaluation - Evaluación de búsqueda
     * @returns {Array} - Lista de recomendaciones
     */
    generateRecommendations(query, searchEvaluation) {
        const recommendations = [];
        
        if (searchEvaluation.totalResults === 0) {
            recommendations.push('Try using more specific keywords');
            recommendations.push('Consider rephrasing your question');
        }
        
        if (searchEvaluation.averageScore < 0.3) {
            recommendations.push('Your query might be too broad');
            recommendations.push('Try including specific terms like "FP", "bachillerato", or "contacto"');
        }
        
        if (searchEvaluation.sourceDiversity.size === 1) {
            recommendations.push('Try asking about different topics');
        }
        
        return recommendations;
    }
    
    /**
     * Carga todos los chunks disponibles
     * @returns {Array} - Chunks cargados
     */
    async loadAllChunks() {
        try {
            const chunksPath = path.join(__dirname, 'data', 'chunks.json');
            const chunksData = await fs.readFile(chunksPath, 'utf8');
            return JSON.parse(chunksData);
        } catch (error) {
            console.error('Error loading chunks:', error.message);
            return [];
        }
    }
    
    /**
     * Obtiene métricas del sistema
     * @returns {Object} - Métricas actuales
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalFallbacks > 0 ? 
                this.metrics.successfulFallbacks / this.metrics.totalFallbacks : 0,
            historySize: this.fallbackHistory.length
        };
    }
    
    /**
     * Reinicia las métricas del sistema
     */
    resetMetrics() {
        this.metrics = {
            totalFallbacks: 0,
            successfulFallbacks: 0,
            averageConfidence: 0,
            strategyUsage: {},
            responseQuality: []
        };
        this.fallbackHistory = [];
    }
}

/**
 * Factory function
 */
function createFallbackLogicManager(options = {}) {
    return new FallbackLogicManager(options);
}

module.exports = {
    FallbackLogicManager,
    FallbackStrategy,
    FallbackConfidence,
    createFallbackLogicManager
};
