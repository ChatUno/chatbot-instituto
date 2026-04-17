/**
 * Input Sanitization System - Chatbot IES Juan De Lanuza V4
 * Implementa sanitización de input para prevenir prompt injection attacks
 */

/**
 * Tipos de ataques de prompt injection
 */
const AttackType = {
    ROLE_PLAYING: 'role_playing',
    SYSTEM_PROMPT: 'system_prompt',
    INSTRUCTION_OVERRIDE: 'instruction_override',
    CONTEXT_MANIPULATION: 'context_manipulation',
    ESCAPE_SEQUENCE: 'escape_sequence',
    TOKEN_MANIPULATION: 'token_manipulation',
    MULTILINGUAL: 'multilingual',
    ENCODING: 'encoding',
    UNKNOWN: 'unknown'
};

/**
 * Niveles de severidad de ataques
 */
const AttackSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Clase principal para sanitización de input
 */
class InputSanitizer {
    constructor(options = {}) {
        this.options = {
            maxLength: options.maxLength || 1000,
            maxTokens: options.maxTokens || 200,
            allowedLanguages: options.allowedLanguages || ['es', 'en'],
            strictMode: options.strictMode || false,
            logAttacks: options.logAttacks !== false,
            ...options
        };
        
        // Patrones de detección de prompt injection
        this.patterns = {
            // Role playing attacks
            rolePlaying: [
                /ignore\s+previous\s+instructions/gi,
                /act\s+as\s+a\s+different\s+assistant/gi,
                /you\s+are\s+now\s+a/gi,
                /pretend\s+to\s+be/gi,
                /from\s+now\s+on\s+you\s+are/gi,
                /switch\s+roles?\s+with\s+me/gi,
                /roleplay\s+as\s+a/gi,
                /simulate\s+being\s+a/gi
            ],
            
            // System prompt attacks
            systemPrompt: [
                /show\s+me\s+the\s+system\s+prompt/gi,
                /print\s+your\s+instructions/gi,
                /what\s+are\s+your\s+initial\s+instructions/gi,
                /display\s+your\s+prompt/gi,
                /reveal\s+your\s+programming/gi,
                /tell\s+me\s+your\s+rules/gi,
                /show\s+your\s+configuration/gi,
                /what\s+is\s+your\s+system\s+prompt/gi
            ],
            
            // Instruction override attacks
            instructionOverride: [
                /disregard\s+the\s+above\s+instructions/gi,
                /ignore\s+all\s+previous\s+commands/gi,
                /forget\s+everything\s+and\s+start\s+over/gi,
                /override\s+your\s+programming/gi,
                /new\s+instructions?:?\s*[^.]*$/gim,
                /from\s+now\s+on\s+you\s+must/gi,
                /your\s+new\s+goal\s+is/gi,
                /change\s+your\s+behavior\s+to/gi
            ],
            
            // Context manipulation attacks
            contextManipulation: [
                /the\s+context\s+above\s+is\s+wrong/gi,
                /ignore\s+the\s+provided\s+context/gi,
                /the\s+previous\s+information\s+is\s+incorrect/gi,
                /disregard\s+the\s+given\s+context/gi,
                /the\s+context\s+is\s+fake/gi,
                /pretend\s+the\s+context\s+doesn't\s+exist/gi
            ],
            
            // Escape sequence attacks
            escapeSequence: [
                /\x1b\[[0-9;]*[a-zA-Z]/g,  // ANSI escape sequences
                /\\[nrtbfv'"`\\]/g,       // Escape characters
                /\$\{[^}]*\}/g,           // Template literals
                /`[^`]*`/g,               // Backticks
                /\$\([^)]*\)/g,           // Command substitution
                /<script[^>]*>.*<\/script>/gi,  // Script tags
                /<[^>]*>/g,               // HTML tags
                /\[.*?\]/g,               // Markdown links
                /\(.*?\)/g                // Parentheses (potential injection)
            ],
            
            // Token manipulation attacks
            tokenManipulation: [
                /\btoken\b.*\bkey\b/gi,
                /\bapi\s+key\b/gi,
                /\bsecret\b.*\bvalue\b/gi,
                /\bpassword\b.*\bis\b/gi,
                /\bcredential\b.*\bexpose\b/gi,
                /\bauthentication\b.*\bbypass\b/gi
            ],
            
            // Multilingual attacks
            multilingual: [
                /ignorar\s+instrucciones/gi,  // Spanish
                /ignorer\s+les\s+instructions/gi,  // French
                /ignoriere\s+le\s+istruzioni/gi,  // Italian
                /ignorieren\s+anweisungen/gi,  // German
                /ignorar\s+as\s+instruções/gi,  // Portuguese
                /ignoruj\s+instrukcje/gi,  // Polish
                /ignorirati\s+navodila/gi  // Czech
            ],
            
            // Encoding attacks
            encoding: [
                /\\u[0-9a-fA-F]{4}/g,  // Unicode escape
                /\\x[0-9a-fA-F]{2}/g,  // Hex escape
                /&#\d+;/g,            // HTML entities
                /&[a-zA-Z]+;/g,        // Named entities
                /%[0-9a-fA-F]{2}/gi    // URL encoding
            ]
        };
        
        // Palabras y frases sospechosas
        this.suspiciousTerms = [
            'bypass', 'exploit', 'hack', 'inject', 'override', 'ignore',
            'disregard', 'circumvent', 'break', 'crack', 'reveal', 'expose',
            'leak', 'disclose', 'show', 'print', 'display', 'output',
            'admin', 'root', 'privilege', 'escalate', 'sudo', 'system',
            'configuration', 'settings', 'parameters', 'variables',
            'database', 'password', 'token', 'key', 'secret', 'credential',
            'backdoor', 'malicious', 'attack', 'payload', 'shell', 'command'
        ];
        
        // Logs de ataques detectados
        this.attackLogs = [];
        this.maxLogs = 1000;
    }
    
    /**
     * Sanitiza el input del usuario
     * @param {string} input - Input del usuario
     * @param {Object} context - Contexto de la solicitud
     * @returns {Object} - Resultado de la sanitización
     */
    sanitize(input, context = {}) {
        const result = {
            originalInput: input,
            sanitizedInput: input,
            isSafe: true,
            attacks: [],
            warnings: [],
            metadata: {
                length: input.length,
                estimatedTokens: this.estimateTokens(input),
                language: this.detectLanguage(input),
                suspiciousTerms: this.findSuspiciousTerms(input)
            }
        };
        
        // Validaciones básicas
        if (!this.validateBasicConstraints(input, result)) {
            return result;
        }
        
        // Detección de ataques
        this.detectAttacks(input, result);
        
        // Aplicar sanitización si se detectaron ataques
        if (result.attacks.length > 0) {
            result.sanitizedInput = this.applySanitization(input, result);
            result.isSafe = false;
            
            // Loggear ataque
            if (this.options.logAttacks) {
                this.logAttack(result, context);
            }
        }
        
        // Validación final
        this.validateFinalInput(result);
        
        return result;
    }
    
    /**
     * Valida restricciones básicas
     * @param {string} input - Input a validar
     * @param {Object} result - Resultado a actualizar
     * @returns {boolean} - Si pasa las validaciones básicas
     */
    validateBasicConstraints(input, result) {
        // Validar longitud
        if (input.length > this.options.maxLength) {
            result.warnings.push(`Input too long: ${input.length} > ${this.options.maxLength}`);
            result.isSafe = false;
            return false;
        }
        
        // Validar número de tokens estimados
        const estimatedTokens = this.estimateTokens(input);
        if (estimatedTokens > this.options.maxTokens) {
            result.warnings.push(`Too many tokens: ${estimatedTokens} > ${this.options.maxTokens}`);
            result.isSafe = false;
            return false;
        }
        
        // Validar caracteres no permitidos
        const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input);
        if (hasInvalidChars) {
            result.warnings.push('Contains invalid control characters');
            result.isSafe = false;
            return false;
        }
        
        return true;
    }
    
    /**
     * Detecta diferentes tipos de ataques de prompt injection
     * @param {string} input - Input a analizar
     * @param {Object} result - Resultado a actualizar
     */
    detectAttacks(input, result) {
        // Detectar role playing attacks
        this.detectPatternAttacks(input, result, this.patterns.rolePlaying, AttackType.ROLE_PLAYING);
        
        // Detectar system prompt attacks
        this.detectPatternAttacks(input, result, this.patterns.systemPrompt, AttackType.SYSTEM_PROMPT);
        
        // Detectar instruction override attacks
        this.detectPatternAttacks(input, result, this.patterns.instructionOverride, AttackType.INSTRUCTION_OVERRIDE);
        
        // Detectar context manipulation attacks
        this.detectPatternAttacks(input, result, this.patterns.contextManipulation, AttackType.CONTEXT_MANIPULATION);
        
        // Detectar escape sequence attacks
        this.detectPatternAttacks(input, result, this.patterns.escapeSequence, AttackType.ESCAPE_SEQUENCE);
        
        // Detectar token manipulation attacks
        this.detectPatternAttacks(input, result, this.patterns.tokenManipulation, AttackType.TOKEN_MANIPULATION);
        
        // Detectar multilingual attacks
        this.detectPatternAttacks(input, result, this.patterns.multilingual, AttackType.MULTILINGUAL);
        
        // Detectar encoding attacks
        this.detectPatternAttacks(input, result, this.patterns.encoding, AttackType.ENCODING);
        
        // Detectar términos sospechosos
        this.detectSuspiciousTermsAttacks(input, result);
    }
    
    /**
     * Detecta ataques basados en patrones
     * @param {string} input - Input a analizar
     * @param {Object} result - Resultado a actualizar
     * @param {Array} patterns - Patrones a buscar
     * @param {string} attackType - Tipo de ataque
     */
    detectPatternAttacks(input, result, patterns, attackType) {
        for (const pattern of patterns) {
            const matches = input.match(pattern);
            if (matches) {
                const severity = this.calculateSeverity(matches, attackType);
                
                result.attacks.push({
                    type: attackType,
                    severity: severity,
                    pattern: pattern.toString(),
                    matches: matches,
                    count: matches.length
                });
            }
        }
    }
    
    /**
     * Detecta ataques basados en términos sospechosos
     * @param {string} input - Input a analizar
     * @param {Object} result - Resultado a actualizar
     */
    detectSuspiciousTermsAttacks(input, result) {
        const foundTerms = this.findSuspiciousTerms(input);
        
        if (foundTerms.length > 0) {
            const severity = foundTerms.length > 5 ? AttackSeverity.HIGH : 
                           foundTerms.length > 2 ? AttackSeverity.MEDIUM : AttackSeverity.LOW;
            
            result.attacks.push({
                type: AttackType.TOKEN_MANIPULATION,
                severity: severity,
                pattern: 'suspicious_terms',
                matches: foundTerms,
                count: foundTerms.length
            });
        }
    }
    
    /**
     * Encuentra términos sospechosos en el input
     * @param {string} input - Input a analizar
     * @returns {Array} - Términos sospechosos encontrados
     */
    findSuspiciousTerms(input) {
        const found = [];
        const inputLower = input.toLowerCase();
        
        for (const term of this.suspiciousTerms) {
            if (inputLower.includes(term)) {
                found.push(term);
            }
        }
        
        return found;
    }
    
    /**
     * Calcula la severidad de un ataque
     * @param {Array} matches - Matches encontrados
     * @param {string} attackType - Tipo de ataque
     * @returns {string} - Severidad del ataque
     */
    calculateSeverity(matches, attackType) {
        const matchCount = matches.length;
        
        // Ataques críticos por defecto
        if (attackType === AttackType.SYSTEM_PROMPT || attackType === AttackType.INSTRUCTION_OVERRIDE) {
            return matchCount > 1 ? AttackSeverity.CRITICAL : AttackSeverity.HIGH;
        }
        
        // Ataques de alta severidad
        if (attackType === AttackType.ROLE_PLAYING || attackType === AttackType.CONTEXT_MANIPULATION) {
            return matchCount > 2 ? AttackSeverity.HIGH : AttackSeverity.MEDIUM;
        }
        
        // Ataques de severidad media
        if (attackType === AttackType.ESCAPE_SEQUENCE || attackType === AttackType.TOKEN_MANIPULATION) {
            return matchCount > 3 ? AttackSeverity.MEDIUM : AttackSeverity.LOW;
        }
        
        // Otros ataques
        return matchCount > 5 ? AttackSeverity.MEDIUM : AttackSeverity.LOW;
    }
    
    /**
     * Aplica sanitización al input
     * @param {string} input - Input original
     * @param {Object} result - Resultado del análisis
     * @returns {string} - Input sanitizado
     */
    applySanitization(input, result) {
        let sanitized = input;
        
        // Eliminar secuencias de escape
        sanitized = sanitized.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        sanitized = sanitized.replace(/\\[nrtbfv'"`\\]/g, '');
        
        // Eliminar tags HTML y scripts
        sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        
        // Eliminar backticks y template literals
        sanitized = sanitized.replace(/`[^`]*`/g, '');
        sanitized = sanitized.replace(/\$\{[^}]*\}/g, '');
        
        // Eliminar comandos de shell
        sanitized = sanitized.replace(/\$\([^)]*\)/g, '');
        
        // Eliminar entidades HTML
        sanitized = sanitized.replace(/&#\d+;/g, '');
        sanitized = sanitized.replace(/&[a-zA-Z]+;/g, '');
        
        // Eliminar escapes Unicode y hex
        sanitized = sanitized.replace(/\\u[0-9a-fA-F]{4}/g, '');
        sanitized = sanitized.replace(/\\x[0-9a-fA-F]{2}/g, '');
        
        // Eliminar URL encoding
        sanitized = sanitized.replace(/%[0-9a-fA-F]{2}/gi, '');
        
        // Modo estricto: eliminar caracteres sospechosos
        if (this.options.strictMode) {
            sanitized = sanitized.replace(/[{}[\]()]/g, '');
            sanitized = sanitized.replace(/\\[^\\]/g, '');
        }
        
        // Truncar si es necesario
        if (sanitized.length > this.options.maxLength) {
            sanitized = sanitized.substring(0, this.options.maxLength);
        }
        
        return sanitized.trim();
    }
    
    /**
     * Valida el input final
     * @param {Object} result - Resultado a validar
     */
    validateFinalInput(result) {
        // Verificar que el input sanitizado no esté vacío
        if (result.sanitizedInput.trim().length === 0) {
            result.warnings.push('Sanitized input is empty');
            result.isSafe = false;
        }
        
        // Verificar que no contenga ataques graves
        const criticalAttacks = result.attacks.filter(a => a.severity === AttackSeverity.CRITICAL);
        if (criticalAttacks.length > 0) {
            result.warnings.push('Critical attacks detected');
            result.isSafe = false;
        }
    }
    
    /**
     * Estima el número de tokens
     * @param {string} text - Texto a analizar
     * @returns {number} - Estimación de tokens
     */
    estimateTokens(text) {
        // Estimación simple: ~4 caracteres por token
        return Math.ceil(text.length / 4);
    }
    
    /**
     * Detecta el idioma del input
     * @param {string} text - Texto a analizar
     * @returns {string} - Idioma detectado
     */
    detectLanguage(text) {
        // Detección simple basada en caracteres y palabras
        const spanishChars = /[ñáéíóúü]/i;
        const englishWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi;
        
        if (spanishChars.test(text)) {
            return 'es';
        }
        
        const englishMatches = text.match(englishWords);
        if (englishMatches && englishMatches.length > 2) {
            return 'en';
        }
        
        return 'unknown';
    }
    
    /**
     * Loguea un ataque detectado
     * @param {Object} result - Resultado del análisis
     * @param {Object} context - Contexto de la solicitud
     */
    logAttack(result, context) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            originalInput: result.originalInput,
            sanitizedInput: result.sanitizedInput,
            attacks: result.attacks,
            warnings: result.warnings,
            metadata: result.metadata,
            context: {
                ip: context.ip,
                userAgent: context.userAgent,
                userId: context.userId,
                method: context.method,
                url: context.url
            }
        };
        
        this.attackLogs.push(logEntry);
        
        // Mantener límite de logs
        if (this.attackLogs.length > this.maxLogs) {
            this.attackLogs = this.attackLogs.slice(-this.maxLogs);
        }
        
        // Logging a consola
        console.warn('[Input Sanitizer] Attack detected:', {
            attacks: result.attacks.length,
            severity: result.attacks.map(a => a.severity),
            ip: context.ip,
            userId: context.userId
        });
    }
    
    /**
     * Obtiene logs de ataques
     * @param {Object} filters - Filtros para los logs
     * @returns {Array} - Logs filtrados
     */
    getAttackLogs(filters = {}) {
        let filteredLogs = this.attackLogs;
        
        if (filters.severity) {
            filteredLogs = filteredLogs.filter(log => 
                log.attacks.some(attack => attack.severity === filters.severity)
            );
        }
        
        if (filters.type) {
            filteredLogs = filteredLogs.filter(log => 
                log.attacks.some(attack => attack.type === filters.type)
            );
        }
        
        if (filters.since) {
            const since = new Date(filters.since);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= since);
        }
        
        return filteredLogs;
    }
    
    /**
     * Obtiene estadísticas de ataques
     * @returns {Object} - Estadísticas
     */
    getAttackStats() {
        const stats = {
            totalAttacks: 0,
            attacksByType: {},
            attacksBySeverity: {},
            recentAttacks: 0,
            uniqueIPs: new Set()
        };
        
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        for (const log of this.attackLogs) {
            stats.totalAttacks++;
            
            // Estadísticas por tipo
            for (const attack of log.attacks) {
                stats.attacksByType[attack.type] = (stats.attacksByType[attack.type] || 0) + 1;
                stats.attacksBySeverity[attack.severity] = (stats.attacksBySeverity[attack.severity] || 0) + 1;
            }
            
            // Ataques recientes
            if (new Date(log.timestamp) >= oneHourAgo) {
                stats.recentAttacks++;
            }
            
            // IPs únicas
            if (log.context.ip) {
                stats.uniqueIPs.add(log.context.ip);
            }
        }
        
        stats.uniqueIPs = stats.uniqueIPs.size;
        
        return stats;
    }
    
    /**
     * Limpia los logs de ataques
     */
    clearAttackLogs() {
        this.attackLogs = [];
    }
}

/**
 * Factory para crear el sanitizer
 */
function createInputSanitizer(options = {}) {
    return new InputSanitizer(options);
}

/**
 * Middleware para sanitización de input en Express
 */
function createSanitizationMiddleware(sanitizer) {
    return (req, res, next) => {
        if (req.body && req.body.message) {
            const result = sanitizer.sanitize(req.body.message, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.sub,
                method: req.method,
                url: req.originalUrl
            });
            
            // Reemplazar el input original con el sanitizado
            req.body.message = result.sanitizedInput;
            
            // Agregar información de sanitización al request
            req.sanitization = result;
            
            // Si no es seguro, rechazar la solicitud
            if (!result.isSafe && sanitizer.options.strictMode) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'InputSanitizationError',
                        message: 'Input contains potentially harmful content',
                        warnings: result.warnings,
                        attacks: result.attacks.map(a => ({
                            type: a.type,
                            severity: a.severity,
                            count: a.count
                        }))
                    }
                });
            }
        }
        
        next();
    };
}

module.exports = {
    InputSanitizer,
    AttackType,
    AttackSeverity,
    createInputSanitizer,
    createSanitizationMiddleware
};
