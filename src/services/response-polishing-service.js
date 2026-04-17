/**
 * Sistema de Response Polishing para Chatbot IES Juan de Lanuza
 * Transforma respuestas LLM en outputs naturales y profesionales
 */

class ResponsePolisher {
    constructor() {
        this.noisePatterns = [
            /Eres (un )?asistente.*?(\.|\n|$)/gi,
            /Como (modelo de lenguaje|asistente|IA).*?(\.|\n|$)/gi,
            /Según el contexto.*?(\.|\n|$)/gi,
            /Basado en la información.*?(\.|\n|$)/gi,
            /\[CONTEXTO\]|\[\/CONTEXTO\]/gi,
            /\[SYSTEM\]|\[\/SYSTEM\]/gi,
            /\[MEMORIA\]|\[\/MEMORIA\]/gi,
            /---+/g,
            /RESPUESTA\:/gi,
            /PREGUNTA DEL USUARIO\:/gi
        ];

        this.repetitivePatterns = [
            /(el centro|el instituto) (ofrece|proporciona|tiene) (\w+), (el centro|el instituto) (ofrece|proporciona|tiene)/gi,
            /(\w+), (\w+)/gi // Detecta palabras repetidas consecutivas
        ];
    }

    /**
     * Aplica polishing completo a una respuesta
     * @param {string} response - Respuesta original del LLM
     * @param {string} source - Fuente de la respuesta (rag|fallback|memory)
     * @returns {Object} - Respuesta pulida con metadatos
     */
    polish(response, source = 'rag') {
        if (!response || typeof response !== 'string') {
            return {
                answer: 'No dispongo de esa información.',
                source: source,
                confidence: 0,
                originalLength: 0,
                polishedLength: 0,
                changes: ['Respuesta vacía o inválida']
            };
        }

        const originalLength = response.length;
        let polished = response;
        const changes = [];

        // 1. Eliminar ruido del prompt
        polished = this.removeNoise(polished);
        if (polished !== response) {
            changes.push('Ruido del prompt eliminado');
        }

        // 2. Detectar respuestas débiles y mantenerlas sin modificación
        if (this.isWeakResponse(polished)) {
            return {
                answer: polished.trim(),
                source: source,
                confidence: 0.2,
                originalLength: originalLength,
                polishedLength: polished.length,
                changes: ['Respuesta débil detectada, sin modificación']
            };
        }

        // 3. Normalizar y limpiar
        polished = this.normalizeResponse(polished);
        changes.push('Normalización aplicada');

        // 4. Eliminar duplicados y repeticiones
        const beforeDedup = polished;
        polished = this.removeDuplicates(polished);
        if (polished !== beforeDedup) {
            changes.push('Duplicados eliminados');
        }

        // 5. Mejorar estructura y claridad
        polished = this.improveStructure(polished);
        changes.push('Estructura mejorada');

        // 6. Aplicar estilo profesional
        polished = this.applyProfessionalStyle(polished);
        changes.push('Estilo profesional aplicado');

        // 7. Validar longitud (recortar si es necesario)
        const beforeTrim = polished;
        polished = this.optimizeLength(polished);
        if (polished !== beforeTrim) {
            changes.push('Longitud optimizada');
        }

        // 8. Añadir UX improvements mínimos
        polished = this.addUXImprovements(polished);
        changes.push('Mejoras UX aplicadas');

        // 9. Limpieza final
        polished = this.finalCleanup(polished);

        const confidence = this.calculateConfidence(response, polished, source);

        return {
            answer: polished.trim(),
            source: source,
            confidence: confidence,
            originalLength: originalLength,
            polishedLength: polished.length,
            changes: changes
        };
    }

    /**
     * Elimina ruido del prompt y metadatos internos
     */
    removeNoise(text) {
        let cleaned = text;

        // Eliminar patrones de ruido
        this.noisePatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });

        // Eliminar líneas vacías consecutivas
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

        return cleaned;
    }

    /**
     * Detecta si es una respuesta débil que no debe modificarse
     */
    isWeakResponse(text) {
        const weakPatterns = [
            /no dispongo de (esa|esta) información/gi,
            /no tengo información/gi,
            /información no disponible/gi,
            /no puedo responder/gi,
            /no se encuentra/gi
        ];

        return weakPatterns.some(pattern => pattern.test(text.trim()));
    }

    /**
     * Normaliza la respuesta
     */
    normalizeResponse(text) {
        let normalized = text;

        // Eliminar espacios múltiples
        normalized = normalized.replace(/\s+/g, ' ');

        // Eliminar espacios al inicio y final
        normalized = normalized.trim();

        // Corregir puntuación común
        normalized = normalized.replace(/\s+([.,;:!])/g, '$1');
        normalized = normalized.replace(/([.,;:!])(?!\s)/g, '$1 ');

        // Normalizar comillas
        normalized = normalized.replace(/[""]/g, '"');

        return normalized;
    }

    /**
     * Elimina duplicados y repeticiones
     */
    removeDuplicates(text) {
        let deduped = text;

        // Eliminar frases repetidas
        this.repetitivePatterns.forEach(pattern => {
            deduped = deduped.replace(pattern, (match, p1, p2, p3, p4) => {
                if (p1 && p2 && p3 && p4) {
                    return `${p1} ${p2}`;
                }
                return match;
            });
        });

        // Eliminar palabras duplicadas consecutivas
        deduped = deduped.replace(/\b(\w+)(?:\s+\1)+\b/gi, '$1');

        return deduped;
    }

    /**
     * Mejora la estructura y claridad
     */
    improveStructure(text) {
        let improved = text;

        // Detectar si hay una lista implícita y formatearla
        if (this.containsList(improved)) {
            improved = this.formatList(improved);
        }

        // Mejorar estructura de párrafos
        improved = this.improveParagraphs(improved);

        return improved;
    }

    /**
     * Aplica estilo profesional
     */
    applyProfessionalStyle(text) {
        let styled = text;

        // Reemplazar frases robóticas
        styled = styled.replace(/Le informo que/gi, 'Te informo que');
        styled = styled.replace(/Se le informa que/gi, 'Te informo que');
        styled = styled.replace(/El centro cuenta con/gi, 'El centro tiene');
        styled = styled.replace(/Se dispone de/gi, 'Hay');

        // Mejorar conectores
        styled = styled.replace(/Además de esto/gi, 'Además');
        styled = styled.replace(/En cuanto a/gi, 'Sobre');

        return styled;
    }

    /**
     * Optimiza longitud de la respuesta
     */
    optimizeLength(text) {
        const maxLength = 150; // palabras
        const words = text.split(/\s+/);

        if (words.length <= maxLength) {
            return text;
        }

        // Si es muy larga, intentar resumir manteniendo puntos clave
        const truncated = words.slice(0, maxLength).join(' ');
        return truncated + (text.endsWith('.') ? '.' : '...');
    }

    /**
     * Añade mejoras UX mínimas
     */
    addUXImprovements(text) {
        let improved = text;

        // Añadir emojis mínimos solo si mejoran claridad
        if (improved.includes('importante') && !improved.includes('⚠️')) {
            improved = improved.replace(/importante/gi, 'importante ⚠️');
        }

        if (improved.includes('nota') && !improved.includes('📌')) {
            improved = improved.replace(/nota/gi, 'nota 📌');
        }

        return improved;
    }

    /**
     * Limpieza final
     */
    finalCleanup(text) {
        let cleaned = text;

        // Eliminar espacios al inicio y final
        cleaned = cleaned.trim();

        // Eliminar múltiples espacios
        cleaned = cleaned.replace(/\s+/g, ' ');

        // Eliminar saltos de línea excesivos
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

        return cleaned;
    }

    /**
     * Detecta si el texto contiene una lista
     */
    containsList(text) {
        const listPatterns = [
            /:.*?,.*?,/g,
            /:.*?y.*?/g,
            /- .*?\n- .*?\n/g,
            /\d+\. .*?\n\d+\. /g
        ];

        return listPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Formatea listas de manera consistente
     */
    formatList(text) {
        let formatted = text;

        // Convertir diferentes formatos de lista a formato guion
        formatted = formatted.replace(/(\d+\.\s|•\s|\*\s)/g, '- ');
        formatted = formatted.replace(/:\s*([^.\n]+),\s*/g, '\n- $1\n');
        formatted = formatted.replace(/:\s*([^.\n]+)\s*y\s*([^.\n]+)/g, '\n- $1\n- $2');

        return formatted;
    }

    /**
     * Mejora estructura de párrafos
     */
    improveParagraphs(text) {
        let improved = text;

        // Asegurar que haya doble salto de línea después de puntos finales
        improved = improved.replace(/([.!?])\s*([A-ZÁÉÍÓÚÑ])/g, '$1\n\n$2');

        return improved;
    }

    /**
     * Calcula confianza de la respuesta pulida
     */
    calculateConfidence(original, polished, source) {
        let confidence = 0.5; // base

        // Ajustar por fuente
        if (source === 'rag') confidence += 0.3;
        else if (source === 'fallback') confidence += 0.1;
        else if (source === 'memory') confidence += 0.2;

        // Ajustar por cambios aplicados
        const changeRatio = polished.length / original.length;
        if (changeRatio > 0.8 && changeRatio < 1.2) confidence += 0.2;

        // Ajustar por calidad del contenido
        if (this.isWeakResponse(polished)) confidence -= 0.3;
        else if (polished.length > 20) confidence += 0.1;

        return Math.min(1, Math.max(0, confidence));
    }
}

// Instancia global del polisher
const polisher = new ResponsePolisher();

/**
 * Interfaz pública del sistema de polishing
 */
const ResponsePolishingSystem = {
    /**
     * Aplica polishing a una respuesta
     */
    polish: (response, source = 'rag') => {
        return polisher.polish(response, source);
    },

    /**
     * Verifica si una respuesta es débil
     */
    isWeakResponse: (text) => {
        return polisher.isWeakResponse(text);
    }
};

module.exports = {
    ResponsePolisher,
    ResponsePolishingSystem
};
