/**
 * Sistema de Observabilidad para Chatbot IES Juan de Lanuza
 * Logging estructurado, debugging y QA automático
 */

const fs = require('fs');
const path = require('path');

class ObservabilitySystem {
    constructor() {
        this.logs = [];
        this.metrics = {
            totalRequests: 0,
            ragHits: 0,
            fallbackUsed: 0,
            hallucinationDetected: 0,
            memoryUsed: 0,
            averageLatency: 0,
            retrievalHitRate: 0
        };
        
        this.debugMode = process.env.DEBUG === 'true';
        this.logFile = path.join(__dirname, 'logs', 'chatbot-observability.json');
        
        // Asegurar que el directorio de logs existe
        this.ensureLogDirectory();
    }

    /**
     * Asegura que el directorio de logs exista
     */
    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    /**
     * Registra una request completa con logging estructurado
     */
    logRequest(requestData) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            query: requestData.query,
            intent: requestData.intent,
            memory_used: requestData.memoryUsed || false,
            top_chunks: requestData.topChunks || [],
            selected_chunks: requestData.selectedChunks || [],
            context_length: requestData.contextLength || 0,
            prompt_mode: requestData.promptMode || 'unknown',
            response_length: requestData.responseLength || 0,
            latency_ms: requestData.latency || 0,
            source: requestData.source || 'rag',
            confidence: requestData.confidence || 0,
            failures: requestData.failures || [],
            chunk_trace: requestData.chunkTrace || []
        };

        this.logs.push(logEntry);
        this.updateMetrics(logEntry);

        // Logging en consola según modo debug
        if (this.debugMode) {
            this.logDetailedDebug(logEntry);
        } else {
            this.logSummary(logEntry);
        }

        // Guardar logs a archivo
        this.saveLogs();
    }

    /**
     * Logging detallado para modo debug
     */
    logDetailedDebug(logEntry) {
        console.log('\n=== OBSERVABILITY - DEBUG MODE ===');
        console.log(`Timestamp: ${logEntry.timestamp}`);
        console.log(`Query: "${logEntry.query}"`);
        console.log(`Intent: ${logEntry.intent}`);
        console.log(`Memory Used: ${logEntry.memory_used}`);
        console.log(`Prompt Mode: ${logEntry.prompt_mode}`);
        console.log(`Source: ${logEntry.source}`);
        console.log(`Confidence: ${logEntry.confidence}`);
        console.log(`Latency: ${logEntry.latency_ms}ms`);
        
        if (logEntry.chunk_trace && logEntry.chunk_trace.length > 0) {
            console.log('\n--- CHUNK TRACE ---');
            logEntry.chunk_trace.forEach(trace => {
                console.log(`\nChunk ${trace.chunk_id}:`);
                trace.score_breakdown.forEach(item => {
                    console.log(`  ${item}`);
                });
                console.log(`  Score final: ${trace.final_score}`);
            });
            console.log('--- END CHUNK TRACE ---\n');
        }

        if (logEntry.failures && logEntry.failures.length > 0) {
            console.log('\n⚠️  FAILURES DETECTED:');
            logEntry.failures.forEach(failure => {
                console.log(`  - ${failure.type}: ${failure.description}`);
            });
        }

        console.log('=== END DEBUG ===\n');
    }

    /**
     * Logging resumido para modo normal
     */
    logSummary(logEntry) {
        const status = logEntry.failures.length > 0 ? '⚠️  FAIL' : '✅ OK';
        const source = logEntry.source.toUpperCase();
        const latency = logEntry.latency_ms;
        
        console.log(`${status} [${source}] ${logEntry.query.substring(0, 30)}... (${latency}ms)`);
        
        if (logEntry.failures.length > 0) {
            console.log(`   Failures: ${logEntry.failures.map(f => f.type).join(', ')}`);
        }
    }

    /**
     * Registra trace detallado de RAG
     */
    logRAGTrace(query, chunks, intent) {
        if (!this.debugMode) return;

        console.log('\n=== RAG TRACE ===');
        console.log(`Query: ${query}`);
        console.log(`Intent: ${intent}`);
        console.log(`Total chunks evaluated: ${chunks.length}`);

        chunks.forEach(chunk => {
            console.log(`\n--- Chunk ID: ${chunk.id} (Source: ${chunk.source}) ---`);
            if (chunk.debug && chunk.debug.length > 0) {
                chunk.debug.forEach(debugLine => {
                    console.log(`  ${debugLine}`);
                });
            }
            console.log(`  Final Score: ${chunk.score}`);
        });

        console.log('=== END RAG TRACE ===\n');
    }

    /**
     * Detecta y registra fallos automáticamente
     */
    detectFailures(requestData) {
        const failures = [];

        // Detectar si no hay chunks relevantes
        if (requestData.topChunks && requestData.topChunks.length === 0) {
            failures.push({
                type: 'no_relevant_chunks',
                description: 'No se encontraron chunks relevantes'
            });
        }

        // Detectar si se usó fallback
        if (requestData.promptMode === 'fallback') {
            failures.push({
                type: 'fallback_used',
                description: 'Se usó sistema de fallback'
            });
        }

        // Detectar si memoria no se aplicó
        if (requestData.memoryExpected && !requestData.memoryUsed) {
            failures.push({
                type: 'memory_not_applied',
                description: 'Memoria esperada pero no aplicada'
            });
        }

        // Detectar si contexto está vacío
        if (requestData.contextLength === 0) {
            failures.push({
                type: 'empty_context',
                description: 'Contexto vacío'
            });
        }

        // Detectar si respuesta no usa contexto
        if (requestData.responseLength > 0 && requestData.confidence < 0.3) {
            failures.push({
                type: 'low_confidence_response',
                description: 'Respuesta con baja confianza'
            });
        }

        return failures;
    }

    /**
     * Actualiza métricas globales
     */
    updateMetrics(logEntry) {
        this.metrics.totalRequests++;
        
        if (logEntry.source === 'rag') {
            this.metrics.ragHits++;
        } else if (logEntry.source === 'fallback') {
            this.metrics.fallbackUsed++;
        }

        if (logEntry.memory_used) {
            this.metrics.memoryUsed++;
        }

        if (logEntry.confidence < 0.5) {
            this.metrics.hallucinationDetected++;
        }

        // Actualizar latencia promedio
        const totalLatency = this.metrics.averageLatency * (this.metrics.totalRequests - 1) + logEntry.latency_ms;
        this.metrics.averageLatency = totalLatency / this.metrics.totalRequests;

        // Calcular retrieval hit rate
        if (logEntry.selected_chunks && logEntry.selected_chunks.length > 0) {
            this.metrics.retrievalHitRate = (this.metrics.ragHits / this.metrics.totalRequests) * 100;
        }
    }

    /**
     * Guarda logs a archivo
     */
    saveLogs() {
        try {
            const logData = {
                last_updated: new Date().toISOString(),
                metrics: this.metrics,
                recent_logs: this.logs.slice(-100) // Últimos 100 logs
            };
            
            fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
        } catch (error) {
            console.error('Error guardando logs de observabilidad:', error.message);
        }
    }

    /**
     * Obtiene métricas actuales
     */
    getMetrics() {
        return {
            ...this.metrics,
            retrieval_hit_rate: this.metrics.retrievalHitRate.toFixed(2) + '%',
            fallback_rate: ((this.metrics.fallbackUsed / this.metrics.totalRequests) * 100).toFixed(2) + '%',
            hallucination_rate: ((this.metrics.hallucinationDetected / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        };
    }

    /**
     * Limpia logs antiguos
     */
    clearOldLogs(daysToKeep = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        this.logs = this.logs.filter(log => 
            new Date(log.timestamp) > cutoffDate
        );
        
        this.saveLogs();
    }
}

// Instancia global del sistema
const observability = new ObservabilitySystem();

/**
 * Interfaz pública del sistema de observabilidad
 */
const ObservabilityManager = {
    /**
     * Registra una request completa
     */
    logRequest: (requestData) => {
        return observability.logRequest(requestData);
    },

    /**
     * Registra trace de RAG
     */
    logRAGTrace: (query, chunks, intent) => {
        return observability.logRAGTrace(query, chunks, intent);
    },

    /**
     * Detecta fallos automáticamente
     */
    detectFailures: (requestData) => {
        return observability.detectFailures(requestData);
    },

    /**
     * Obtiene métricas
     */
    getMetrics: () => {
        return observability.getMetrics();
    },

    /**
     * Limpia logs antiguos
     */
    clearOldLogs: (days) => {
        return observability.clearOldLogs(days);
    },

    /**
     * Verifica si está en modo debug
     */
    isDebugMode: () => {
        return observability.debugMode;
    }
};

module.exports = {
    ObservabilitySystem,
    ObservabilityManager
};
