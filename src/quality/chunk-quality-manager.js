/**
 * Chunk Quality Management System - Chatbot IES Juan De Lanuza V4
 * Implementa optimización de chunks, deduplicación, scoring de calidad y categorización
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Calidad de chunks
 */
const ChunkQuality = {
    POOR: 'poor',
    FAIR: 'fair',
    GOOD: 'good',
    EXCELLENT: 'excellent'
};

/**
 * Categorías de chunks
 */
const ChunkCategory = {
    GENERAL: 'general',
    CONTACT: 'contact',
    ACADEMIC: 'academic',
    ADMINISTRATIVE: 'administrative',
    FACILITIES: 'facilities',
    SCHEDULES: 'schedules',
    PROGRAMS: 'programs',
    NEWS: 'news',
    UNKNOWN: 'unknown'
};

/**
 * Sistema de gestión de calidad de chunks
 */
class ChunkQualityManager {
    constructor(options = {}) {
        this.options = {
            minChunkLength: options.minChunkLength || 20,
            maxChunkLength: options.maxChunkLength || 500,
            optimalChunkLength: options.optimalChunkLength || 100,
            qualityThresholds: {
                poor: options.poorThreshold || 0.3,
                fair: options.fairThreshold || 0.5,
                good: options.goodThreshold || 0.7,
                excellent: options.excellentThreshold || 0.9
            },
            deduplicationThreshold: options.deduplicationThreshold || 0.8,
            ...options
        };
        
        // Patrones para categorización
        this.categoryPatterns = {
            [ChunkCategory.CONTACT]: [
                /teléfono|phone|contacto|contact|email|mail|correo/i,
                /c\/|calle|direccion|address|ubicación|location/i,
                /976\s*\d{3}\s*\d{3}|\d{3}[-\s]\d{3}[-\s]\d{3}/i,
                /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i
            ],
            [ChunkCategory.ACADEMIC]: [
                /bachillerato|fp|formación profesional|ciclo|ciclo formativo/i,
                /asignatura|materia|módulo|crédito|credit/i,
                /estudiar|educación|enseñanza|aprendizaje/i,
                /grado|título|titulación|certificado|diploma/i
            ],
            [ChunkCategory.ADMINISTRATIVE]: [
                /matrícula|inscripción|registro|admisión/i,
                /secretaría|administración|gestión|trámite/i,
                /plazos|fechas límite|periodo|convocatoria/i,
                /requisitos|documentación|papeles|expediente/i
            ],
            [ChunkCategory.FACILITIES]: [
                /aula|laboratorio|biblioteca|comedor|gimnasio/i,
                /edificio|pabellón|planta|piso|instalación/i,
                /equipamiento|recurso|material|infraestructura/i,
                /acceso|entrada|salida|parking|aparcamiento/i
            ],
            [ChunkCategory.SCHEDULES]: [
                /horario|horarios|calendario|agenda/i,
                /lunes|martes|miércoles|jueves|viernes|sábado|domingo/i,
                /mañana|tarde|noche|hora|h/i,
                /periodo|trimestre|semestre|cuatrimestre/i
            ],
            [ChunkCategory.PROGRAMS]: [
                /programa|plan|currículo|currículum/i,
                /oferta|oferta educativa|opciones/i,
                /especialidad|especialización|área/i,
                /itinerario|recorrido|camino/i
            ],
            [ChunkCategory.NEWS]: [
                /aviso|comunicado|noticia|novedad|anuncio/i,
                /importante|urgente|informativo|comunicación/i,
                /evento|actividad|celebración|reunión/i,
                /actualización|cambio|modificación/i
            ]
        };
    }
    
    /**
     * Analiza la calidad de un chunk
     * @param {Object} chunk - Chunk a analizar
     * @returns {Object} - Análisis de calidad
     */
    analyzeChunkQuality(chunk) {
        const analysis = {
            id: chunk.id,
            text: chunk.text,
            source: chunk.source,
            quality: ChunkQuality.POOR,
            score: 0,
            issues: [],
            suggestions: [],
            category: this.categorizeChunk(chunk.text),
            metrics: this.calculateMetrics(chunk.text)
        };
        
        // Calcular score basado en múltiples factores
        let score = 0;
        
        // 1. Longitud del texto (25%)
        const lengthScore = this.calculateLengthScore(chunk.text);
        score += lengthScore * 0.25;
        
        // 2. Densidad de información (25%)
        const densityScore = this.calculateDensityScore(chunk.text);
        score += densityScore * 0.25;
        
        // 3. Estructura y formato (20%)
        const structureScore = this.calculateStructureScore(chunk.text);
        score += structureScore * 0.20;
        
        // 4. Relevancia de contenido (20%)
        const relevanceScore = this.calculateRelevanceScore(chunk.text);
        score += relevanceScore * 0.20;
        
        // 5. Unicidad (10%)
        const uniquenessScore = this.calculateUniquenessScore(chunk.text);
        score += uniquenessScore * 0.10;
        
        analysis.score = Math.round(score * 100) / 100;
        analysis.quality = this.determineQuality(analysis.score);
        
        // Generar sugerencias
        analysis.suggestions = this.generateSuggestions(analysis);
        
        return analysis;
    }
    
    /**
     * Calcula métricas del chunk
     * @param {string} text - Texto del chunk
     * @returns {Object} - Métricas calculadas
     */
    calculateMetrics(text) {
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        
        return {
            length: text.length,
            wordCount: words.length,
            sentenceCount: sentences.length,
            paragraphCount: paragraphs.length,
            avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length * 10) / 10 : 0,
            avgSentenceLength: sentences.length > 0 ? Math.round(text.length / sentences.length) : 0,
            hasNumbers: /\d/.test(text),
            hasEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text),
            hasPhone: /976\s*\d{3}\s*\d{3}|\d{3}[-\s]\d{3}[-\s]\d{3}/.test(text),
            hasUrls: /https?:\/\/[^\s]+/.test(text),
            punctuationRatio: this.calculatePunctuationRatio(text),
            capitalizationRatio: this.calculateCapitalizationRatio(text)
        };
    }
    
    /**
     * Calcula score de longitud
     * @param {string} text - Texto a evaluar
     * @returns {number} - Score de longitud (0-1)
     */
    calculateLengthScore(text) {
        const length = text.length;
        
        if (length < this.options.minChunkLength) {
            return 0.2; // Demasiado corto
        } else if (length > this.options.maxChunkLength) {
            return 0.6; // Demasiado largo pero usable
        } else if (length >= this.options.optimalChunkLength * 0.8 && 
                   length <= this.options.optimalChunkLength * 1.2) {
            return 1.0; // Longitud óptima
        } else {
            // Penalización proporcional a la distancia del óptimo
            const distance = Math.abs(length - this.options.optimalChunkLength);
            const maxDistance = Math.max(
                this.options.optimalChunkLength - this.options.minChunkLength,
                this.options.maxChunkLength - this.options.optimalChunkLength
            );
            return Math.max(0.6, 1 - (distance / maxDistance) * 0.4);
        }
    }
    
    /**
     * Calcula score de densidad de información
     * @param {string} text - Texto a evaluar
     * @returns {number} - Score de densidad (0-1)
     */
    calculateDensityScore(text) {
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const meaningfulWords = words.filter(w => w.length > 3); // Palabras significativas
        
        if (words.length === 0) return 0;
        
        // Ratio de palabras significativas
        const meaningfulRatio = meaningfulWords.length / words.length;
        
        // Presencia de información específica
        const hasSpecificInfo = this.hasSpecificInformation(text);
        
        // Densidad numérica
        const numberDensity = (text.match(/\d/g) || []).length / text.length;
        
        return Math.min(1, meaningfulRatio * 0.5 + (hasSpecificInfo ? 0.3 : 0) + Math.min(numberDensity * 10, 0.2));
    }
    
    /**
     * Calcula score de estructura
     * @param {string} text - Texto a evaluar
     * @returns {number} - Score de estructura (0-1)
     */
    calculateStructureScore(text) {
        let score = 0.5; // Base score
        
        // Estructura de oraciones
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 1) score += 0.1;
        
        // Puntuación adecuada
        const punctuationRatio = this.calculatePunctuationRatio(text);
        if (punctuationRatio > 0.05 && punctuationRatio < 0.15) score += 0.1;
        
        // Capitalización adecuada
        const capitalizationRatio = this.calculateCapitalizationRatio(text);
        if (capitalizationRatio > 0.05 && capitalizationRatio < 0.2) score += 0.1;
        
        // Formato estructurado
        if (text.includes(':') || text.includes('-') || text.includes('·')) score += 0.1;
        
        // Sin caracteres extraños
        if (!/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) score += 0.1;
        
        return Math.min(1, score);
    }
    
    /**
     * Calcula score de relevancia
     * @param {string} text - Texto a evaluar
     * @returns {number} - Score de relevancia (0-1)
     */
    calculateRelevanceScore(text) {
        const textLower = text.toLowerCase();
        
        // Palabras clave relevantes para el contexto educativo
        const relevantKeywords = [
            'instituto', 'educación', 'estudio', 'alumno', 'profesor', 'clase',
            'curso', 'asignatura', 'materia', 'horario', 'evaluación', 'nota',
            'examen', 'trabajo', 'proyecto', 'título', 'certificado', 'diploma',
            'bachillerato', 'fp', 'formación', 'ciclo', 'módulo', 'crédito',
            'matrícula', 'inscripción', 'secretaría', 'contacto', 'información'
        ];
        
        const foundKeywords = relevantKeywords.filter(keyword => 
            textLower.includes(keyword)
        );
        
        const keywordRatio = foundKeywords.length / Math.max(relevantKeywords.length, 10);
        
        return Math.min(1, keywordRatio * 2); // Escalar para dar más peso
    }
    
    /**
     * Calcula score de unicidad
     * @param {string} text - Texto a evaluar
     * @returns {number} - Score de unicidad (0-1)
     */
    calculateUniquenessScore(text) {
        // Simplificación: basado en la variedad de palabras
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const uniqueWords = new Set(words);
        
        if (words.length === 0) return 0;
        
        const uniquenessRatio = uniqueWords.size / words.length;
        
        // Penalizar repeticiones obvias
        const hasRepetitions = words.some((word, index) => 
            words.indexOf(word) !== index && word.length > 5
        );
        
        return hasRepetitions ? Math.max(0.3, uniquenessRatio) : uniquenessRatio;
    }
    
    /**
     * Determina la calidad basada en el score
     * @param {number} score - Score numérico
     * @returns {string} - Calidad determinada
     */
    determineQuality(score) {
        const thresholds = this.options.qualityThresholds;
        
        if (score >= thresholds.excellent) return ChunkQuality.EXCELLENT;
        if (score >= thresholds.good) return ChunkQuality.GOOD;
        if (score >= thresholds.fair) return ChunkQuality.FAIR;
        return ChunkQuality.POOR;
    }
    
    /**
     * Categoriza un chunk basado en su contenido
     * @param {string} text - Texto del chunk
     * @returns {string} - Categoría determinada
     */
    categorizeChunk(text) {
        const textLower = text.toLowerCase();
        
        for (const [category, patterns] of Object.entries(this.categoryPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(textLower)) {
                    return category;
                }
            }
        }
        
        return ChunkCategory.UNKNOWN;
    }
    
    /**
     * Genera sugerencias de mejora
     * @param {Object} analysis - Análisis del chunk
     * @returns {Array} - Lista de sugerencias
     */
    generateSuggestions(analysis) {
        const suggestions = [];
        const { metrics, quality } = analysis;
        
        // Sugerencias de longitud
        if (metrics.length < this.options.minChunkLength) {
            suggestions.push('Consider expanding this chunk with more relevant information');
        } else if (metrics.length > this.options.maxChunkLength) {
            suggestions.push('Consider splitting this chunk into smaller, more focused pieces');
        }
        
        // Sugerencias de estructura
        if (metrics.sentenceCount === 0) {
            suggestions.push('Add proper sentence structure with punctuation');
        } else if (metrics.avgWordsPerSentence > 25) {
            suggestions.push('Consider breaking down long sentences for better readability');
        }
        
        // Sugerencias de contenido
        if (quality === ChunkQuality.POOR) {
            suggestions.push('This chunk needs significant improvement in content quality');
            suggestions.push('Add more specific and relevant information');
        } else if (quality === ChunkQuality.FAIR) {
            suggestions.push('Good foundation, but could benefit from more detail');
        }
        
        // Sugerencias específicas
        if (!metrics.hasNumbers && analysis.category === ChunkCategory.CONTACT) {
            suggestions.push('Add specific contact numbers or identifiers');
        }
        
        if (!metrics.hasEmail && analysis.category === ChunkCategory.CONTACT) {
            suggestions.push('Include email addresses for contact information');
        }
        
        return suggestions;
    }
    
    /**
     * Verifica si el texto tiene información específica
     * @param {string} text - Texto a evaluar
     * @returns {boolean} - Si tiene información específica
     */
    hasSpecificInformation(text) {
        // Patrones de información específica
        const specificPatterns = [
            /\d{4}/, // Años
            /\d{1,2}[:]\d{2}/, // Horas
            /\d{1,2}\/\d{1,2}\/\d{2,4}/, // Fechas
            /976\s*\d{3}\s*\d{3}/, // Teléfonos
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Emails
            /c\/|calle|direccion|address/i, // Direcciones
            /aula\s*\d+|edificio\s*[a-zA-Z]/i // Ubicaciones específicas
        ];
        
        return specificPatterns.some(pattern => pattern.test(text));
    }
    
    /**
     * Calcula ratio de puntuación
     * @param {string} text - Texto a evaluar
     * @returns {number} - Ratio de puntuación
     */
    calculatePunctuationRatio(text) {
        const punctuation = text.match(/[.,;:!?¡¿'"()[\]{}]/g) || [];
        return punctuation.length / text.length;
    }
    
    /**
     * Calcula ratio de capitalización
     * @param {string} text - Texto a evaluar
     * @returns {number} - Ratio de capitalización
     */
    calculateCapitalizationRatio(text) {
        const uppercase = text.match(/[A-Z]/g) || [];
        return uppercase.length / text.length;
    }
    
    /**
     * Encuentra chunks duplicados
     * @param {Array} chunks - Array de chunks
     * @returns {Array} - Array de duplicados
     */
    findDuplicates(chunks) {
        const duplicates = [];
        const processed = new Set();
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk1 = chunks[i];
            
            for (let j = i + 1; j < chunks.length; j++) {
                const chunk2 = chunks[j];
                
                if (processed.has(i) || processed.has(j)) continue;
                
                const similarity = this.calculateSimilarity(chunk1.text, chunk2.text);
                
                if (similarity >= this.options.deduplicationThreshold) {
                    duplicates.push({
                        chunk1: chunk1,
                        chunk2: chunk2,
                        similarity: similarity,
                        recommendation: 'Consider merging or removing one of these chunks'
                    });
                    
                    processed.add(i);
                    processed.add(j);
                }
            }
        }
        
        return duplicates;
    }
    
    /**
     * Calcula similitud entre dos textos
     * @param {string} text1 - Primer texto
     * @param {string} text2 - Segundo texto
     * @returns {number} - Similitud (0-1)
     */
    calculateSimilarity(text1, text2) {
        // Implementación simple de similitud de Jaccard
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }
    
    /**
     * Optimiza un array de chunks
     * @param {Array} chunks - Array de chunks original
     * @returns {Object} - Resultado de la optimización
     */
    optimizeChunks(chunks) {
        const result = {
            original: chunks,
            optimized: [],
            removed: [],
            merged: [],
            improved: [],
            qualityReport: {
                total: chunks.length,
                byQuality: {},
                byCategory: {},
                avgQuality: 0
            }
        };
        
        // Analizar calidad de todos los chunks
        const analyses = chunks.map(chunk => this.analyzeChunkQuality(chunk));
        
        // Generar reporte de calidad
        result.qualityReport = this.generateQualityReport(analyses);
        
        // Encontrar duplicados
        const duplicates = this.findDuplicates(chunks);
        
        // Proceso de optimización
        const processedIds = new Set();
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const analysis = analyses[i];
            
            if (processedIds.has(chunk.id)) continue;
            
            // Verificar si está duplicado
            const duplicate = duplicates.find(d => 
                (d.chunk1.id === chunk.id || d.chunk2.id === chunk.id)
            );
            
            if (duplicate) {
                // Mantener el chunk de mayor calidad
                const analysis1 = analyses.find(a => a.id === duplicate.chunk1.id);
                const analysis2 = analyses.find(a => a.id === duplicate.chunk2.id);
                
                const betterChunk = analysis1.score > analysis2.score ? duplicate.chunk1 : duplicate.chunk2;
                const worseChunk = analysis1.score > analysis2.score ? duplicate.chunk2 : duplicate.chunk1;
                
                result.optimized.push(betterChunk);
                result.removed.push(worseChunk);
                result.merged.push({
                    kept: betterChunk,
                    removed: worseChunk,
                    reason: 'Duplicate content'
                });
                
                processedIds.add(duplicate.chunk1.id);
                processedIds.add(duplicate.chunk2.id);
            } else if (analysis.quality === ChunkQuality.POOR) {
                // Eliminar chunks de muy baja calidad
                result.removed.push(chunk);
                processedIds.add(chunk.id);
            } else {
                // Mantener chunk (posiblemente mejorado)
                const improvedChunk = this.improveChunk(chunk, analysis);
                result.optimized.push(improvedChunk);
                
                if (improvedChunk.text !== chunk.text) {
                    result.improved.push({
                        original: chunk,
                        improved: improvedChunk,
                        improvements: analysis.suggestions
                    });
                }
                
                processedIds.add(chunk.id);
            }
        }
        
        return result;
    }
    
    /**
     * Mejora un chunk basado en el análisis
     * @param {Object} chunk - Chunk original
     * @param {Object} analysis - Análisis del chunk
     * @returns {Object} - Chunk mejorado
     */
    improveChunk(chunk, analysis) {
        let improvedText = chunk.text;
        
        // Mejoras básicas de formato
        improvedText = improvedText.trim();
        
        // Asegurar capitalización adecuada
        if (improvedText.length > 0) {
            improvedText = improvedText[0].toUpperCase() + improvedText.slice(1);
        }
        
        // Asegurar puntuación final
        if (improvedText.length > 0 && !improvedText.match(/[.!?]$/)) {
            improvedText += '.';
        }
        
        // Eliminar espacios múltiples
        improvedText = improvedText.replace(/\s+/g, ' ');
        
        return {
            ...chunk,
            text: improvedText,
            quality: analysis.quality,
            score: analysis.score,
            category: analysis.category,
            lastOptimized: new Date().toISOString()
        };
    }
    
    /**
     * Genera reporte de calidad
     * @param {Array} analyses - Análisis de chunks
     * @returns {Object} - Reporte de calidad
     */
    generateQualityReport(analyses) {
        const report = {
            total: analyses.length,
            byQuality: {},
            byCategory: {},
            avgQuality: 0,
            qualityDistribution: {
                excellent: 0,
                good: 0,
                fair: 0,
                poor: 0
            }
        };
        
        // Contar por calidad
        analyses.forEach(analysis => {
            report.byQuality[analysis.quality] = (report.byQuality[analysis.quality] || 0) + 1;
            report.byCategory[analysis.category] = (report.byCategory[analysis.category] || 0) + 1;
            report.qualityDistribution[analysis.quality]++;
            report.avgQuality += analysis.score;
        });
        
        // Calcular promedio
        report.avgQuality = analyses.length > 0 ? 
            Math.round((report.avgQuality / analyses.length) * 100) / 100 : 0;
        
        return report;
    }
    
    /**
     * Guarda chunks optimizados
     * @param {Array} chunks - Chunks optimizados
     * @param {string} filePath - Ruta del archivo
     */
    async saveOptimizedChunks(chunks, filePath) {
        try {
            const jsonData = JSON.stringify(chunks, null, 2);
            await fs.writeFile(filePath, jsonData, 'utf8');
            return true;
        } catch (error) {
            console.error('Error saving optimized chunks:', error);
            return false;
        }
    }
    
    /**
     * Carga chunks desde archivo
     * @param {string} filePath - Ruta del archivo
     * @returns {Array} - Chunks cargados
     */
    async loadChunks(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading chunks:', error);
            return [];
        }
    }
}

/**
 * Factory function
 */
function createChunkQualityManager(options = {}) {
    return new ChunkQualityManager(options);
}

module.exports = {
    ChunkQualityManager,
    ChunkQuality,
    ChunkCategory,
    createChunkQualityManager
};
