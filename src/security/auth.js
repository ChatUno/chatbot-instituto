/**
 * Authentication System - Chatbot IES Juan de Lanuza V4
 * Implementa JWT y API key authentication para V4.2 Security & Reliability
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getValidatedConfig } = require("../utils/config");
const config = getValidatedConfig();

/**
 * Interfaz del servicio de autenticación
 */
class IAuthService {
    /**
     * Genera un token JWT
     * @param {Object} payload - Payload del token
     * @returns {string} - Token JWT
     */
    generateToken(payload) {
        throw new Error('Method not implemented');
    }

    /**
     * Verifica un token JWT
     * @param {string} token - Token JWT
     * @returns {Object} - Payload decodificado
     */
    verifyToken(token) {
        throw new Error('Method not implemented');
    }

    /**
     * Valida una API key
     * @param {string} apiKey - API key a validar
     * @returns {boolean} - Si es válida
     */
    validateApiKey(apiKey) {
        throw new Error('Method not implemented');
    }

    /**
     * Hashea una contraseña
     * @param {string} password - Contraseña en texto plano
     * @returns {string} - Contraseña hasheada
     */
    hashPassword(password) {
        throw new Error('Method not implemented');
    }

    /**
     * Compara una contraseña con su hash
     * @param {string} password - Contraseña en texto plano
     * @param {string} hash - Hash almacenado
     * @returns {boolean} - Si coinciden
     */
    comparePassword(password, hash) {
        throw new Error('Method not implemented');
    }
}

/**
 * Implementación real del servicio de autenticación
 */
class JWTAuthService extends IAuthService {
    constructor() {
        super();
        this.jwtSecret = config.auth.jwtSecret;
        this.jwtExpiration = config.auth.jwtExpiration;
        this.apiKeys = new Set(config.auth.apiKeys || []);
        this.bcryptRounds = 12;
    }

    generateToken(payload) {
        try {
            // Payload estándar
            const tokenPayload = {
                sub: payload.id || 'anonymous',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + this.jwtExpiration,
                type: payload.type || 'api',
                permissions: payload.permissions || ['read']
            };

            return jwt.sign(tokenPayload, this.jwtSecret, { algorithm: 'HS256' });
        } catch (error) {
            throw new Error(`Error generating token: ${error.message}`);
        }
    }

    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
            
            // Verificación adicional
            if (decoded.exp < Math.floor(Date.now() / 1000)) {
                throw new Error('Token expired');
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            } else {
                throw new Error(`Token verification failed: ${error.message}`);
            }
        }
    }

    validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // Validar formato (ejemplo:Bearer o API key)
        if (apiKey.startsWith('Bearer ')) {
            const token = apiKey.substring(7);
            try {
                this.verifyToken(token);
                return true;
            } catch (error) {
                return false;
            }
        }

        // Validar API key directa
        return this.apiKeys.has(apiKey);
    }

    async hashPassword(password) {
        try {
            return await bcrypt.hash(password, this.bcryptRounds);
        } catch (error) {
            throw new Error(`Error hashing password: ${error.message}`);
        }
    }

    async comparePassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new Error(`Error comparing password: ${error.message}`);
        }
    }

    /**
     * Genera una API key temporal
     * @param {Object} options - Opciones de la API key
     * @returns {string} - API key generada
     */
    generateApiKey(options = {}) {
        const payload = {
            id: options.id || 'api-key',
            type: 'api-key',
            permissions: options.permissions || ['read'],
            created: Date.now()
        };

        const token = this.generateToken(payload);
        // Agregar al set de API keys válidas para testing
        this.apiKeys.add(token);
        return token;
    }

    /**
     * Refresca un token existente
     * @param {string} token - Token actual
     * @returns {string} - Nuevo token
     */
    refreshToken(token) {
        try {
            const decoded = this.verifyToken(token);
            
            // Crear nuevo token con mismo payload pero nueva expiración
            const newPayload = {
                ...decoded,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + this.jwtExpiration
            };

            return jwt.sign(newPayload, this.jwtSecret, { algorithm: 'HS256' });
        } catch (error) {
            throw new Error(`Error refreshing token: ${error.message}`);
        }
    }
}

/**
 * Middleware de autenticación para Express
 */
class AuthMiddleware {
    constructor(authService) {
        this.authService = authService;
    }

    /**
     * Middleware principal de autenticación
     * @param {Object} options - Opciones de autenticación
     * @returns {Function} - Middleware de Express
     */
    authenticate(options = {}) {
        const {
            required = true,
            permissions = [],
            allowApiKey = true
        } = options;

        return (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                
                if (!authHeader) {
                    if (required) {
                        return res.status(401).json({
                            error: 'Authentication required',
                            message: 'Authorization header is required',
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        req.user = null;
                        return next();
                    }
                }

                // Validar API key o JWT
                let user = null;
                
                if (allowApiKey && this.authService.validateApiKey(authHeader)) {
                    if (authHeader.startsWith('Bearer ')) {
                        const token = authHeader.substring(7);
                        user = this.authService.verifyToken(token);
                    } else {
                        // API key directa
                        user = {
                            sub: 'api-key',
                            type: 'api-key',
                            permissions: ['read']
                        };
                    }
                } else if (authHeader.startsWith('Bearer ')) {
                    const token = authHeader.substring(7);
                    user = this.authService.verifyToken(token);
                } else {
                    return res.status(401).json({
                        error: 'Invalid authentication format',
                        message: 'Use "Bearer <token>" or valid API key',
                        timestamp: new Date().toISOString()
                    });
                }

                // Verificar permisos
                if (permissions.length > 0) {
                    const userPermissions = user.permissions || [];
                    const hasPermission = permissions.some(perm => userPermissions.includes(perm));
                    
                    if (!hasPermission) {
                        return res.status(403).json({
                            error: 'Insufficient permissions',
                            message: `Required permissions: ${permissions.join(', ')}`,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                req.user = user;
                next();

            } catch (error) {
                console.error('Authentication error:', error.message);
                
                if (error.message.includes('expired')) {
                    return res.status(401).json({
                        error: 'Token expired',
                        message: 'Authentication token has expired',
                        timestamp: new Date().toISOString()
                    });
                } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
                    return res.status(401).json({
                        error: 'Invalid token',
                        message: 'Authentication token is invalid',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    return res.status(500).json({
                        error: 'Authentication error',
                        message: 'Failed to authenticate request',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        };
    }

    /**
     * Middleware para requerir permisos específicos
     * @param {Array} permissions - Permisos requeridos
     * @returns {Function} - Middleware de Express
     */
    requirePermissions(permissions) {
        return this.authenticate({ required: true, permissions });
    }

    /**
     * Middleware para autenticación opcional
     * @returns {Function} - Middleware de Express
     */
    optionalAuth() {
        return this.authenticate({ required: false });
    }
}

/**
 * Factory para crear el servicio de autenticación
 */
function createAuthService() {
    return new JWTAuthService();
}

/**
 * Factory para crear el middleware de autenticación
 */
function createAuthMiddleware(authService) {
    return new AuthMiddleware(authService);
}

module.exports = {
    IAuthService,
    JWTAuthService,
    AuthMiddleware,
    createAuthService,
    createAuthMiddleware
};
