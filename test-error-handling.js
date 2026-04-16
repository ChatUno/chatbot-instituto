/**
 * Tests para comprehensive error handling V4-16-T1
 */

const { 
    createErrorHandler, 
    createValidationError, 
    createAuthenticationError,
    createAuthorizationError,
    createRateLimitError,
    createExternalAPIError,
    createInternalServerError,
    createNotFoundError,
    createBusinessLogicError,
    createNetworkError,
    createTimeoutError,
    ErrorCategory,
    ErrorSeverity
} = require('./error-handler');

/**
 * Test helper para verificar resultados
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function testErrorCreation() {
    console.log('Testing error creation...');
    
    // Test validation error
    const validationError = createValidationError('Invalid input', { field: 'email' });
    assert(validationError.name === 'ValidationError', 'Should be ValidationError');
    assert(validationError.category === ErrorCategory.VALIDATION, 'Should be validation category');
    assert(validationError.statusCode === 400, 'Should be 400 status code');
    assert(validationError.severity === ErrorSeverity.LOW, 'Should be low severity');
    assert(validationError.userMessage.includes('válidos'), 'Should have user-friendly message');
    assert(typeof validationError.requestId === 'string', 'Should have request ID');
    
    // Test authentication error
    const authError = createAuthenticationError('Invalid token');
    assert(authError.name === 'AuthenticationError', 'Should be AuthenticationError');
    assert(authError.category === ErrorCategory.AUTHENTICATION, 'Should be auth category');
    assert(authError.statusCode === 401, 'Should be 401 status code');
    
    // Test internal server error
    const serverError = createInternalServerError('Database connection failed');
    assert(serverError.name === 'InternalServerError', 'Should be InternalServerError');
    assert(serverError.category === ErrorCategory.INTERNAL_SERVER, 'Should be internal server category');
    assert(serverError.statusCode === 500, 'Should be 500 status code');
    assert(serverError.severity === ErrorSeverity.HIGH, 'Should be high severity');
    
    console.log('Error creation: PASS');
}

function testErrorLogger() {
    console.log('Testing error logger...');
    
    const { createErrorLogger } = require('./error-handler');
    const logger = createErrorLogger();
    
    // Test logging
    const error = createValidationError('Test error', { test: true });
    logger.log(error, {
        method: 'POST',
        url: '/test',
        userAgent: 'test-agent',
        ip: '127.0.0.1'
    });
    
    // Test log retrieval
    const logs = logger.getLogs();
    assert(logs.length === 1, 'Should have one log entry');
    assert(logs[0].category === ErrorCategory.VALIDATION, 'Should log category');
    assert(logs[0].context.method === 'POST', 'Should log method');
    assert(logs[0].context.url === '/test', 'Should log URL');
    assert(logs[0].requestId === error.requestId, 'Should log request ID');
    
    // Test filtering
    const validationLogs = logger.getLogs({ category: ErrorCategory.VALIDATION });
    assert(validationLogs.length === 1, 'Should filter by category');
    
    const authLogs = logger.getLogs({ category: ErrorCategory.AUTHENTICATION });
    assert(authLogs.length === 0, 'Should return empty for non-matching category');
    
    console.log('Error logger: PASS');
}

function testErrorHandlerMiddleware() {
    console.log('Testing error handler middleware...');
    
    const errorHandler = createErrorHandler();
    
    // Test error normalization
    const genericError = new Error('Generic error');
    const normalizedError = errorHandler.normalizeError(genericError);
    
    assert(normalizedError.name === 'InternalServerError', 'Should convert to InternalServerError');
    assert(normalizedError.category === ErrorCategory.INTERNAL_SERVER, 'Should be internal server category');
    assert(normalizedError.statusCode === 500, 'Should be 500 status code');
    
    // Test JWT error normalization
    const jwtError = new Error('JsonWebTokenError');
    jwtError.name = 'JsonWebTokenError';
    const normalizedJWTError = errorHandler.normalizeError(jwtError);
    
    assert(normalizedJWTError.name === 'AuthenticationError', 'Should convert JWT error to AuthenticationError');
    assert(normalizedJWTError.category === ErrorCategory.AUTHENTICATION, 'Should be auth category');
    assert(normalizedJWTError.statusCode === 401, 'Should be 401 status code');
    
    // Test validation error normalization
    const validationError = { name: 'ValidationError', message: 'Invalid field' };
    const normalizedValidationError = errorHandler.normalizeError(validationError);
    
    assert(normalizedValidationError.name === 'ValidationError', 'Should preserve ValidationError');
    assert(normalizedValidationError.category === ErrorCategory.VALIDATION, 'Should be validation category');
    
    console.log('Error handler middleware: PASS');
}

function testErrorResponseFormatting() {
    console.log('Testing error response formatting...');
    
    const errorHandler = createErrorHandler();
    const error = createValidationError('Invalid input', { field: 'email' });
    
    // Mock request
    const req = {
        method: 'POST',
        originalUrl: '/test',
        get: (header) => header === 'User-Agent' ? 'test-agent' : undefined,
        ip: '127.0.0.1'
    };
    
    const response = errorHandler.formatErrorResponse(error, req);
    
    assert(response.success === false, 'Should indicate failure');
    assert(response.error.code === 'ValidationError', 'Should include error code');
    assert(response.error.message, 'Should include user message');
    assert(response.error.category === ErrorCategory.VALIDATION, 'Should include category');
    assert(response.error.severity === ErrorSeverity.LOW, 'Should include severity');
    assert(response.error.requestId === error.requestId, 'Should include request ID');
    assert(response.error.timestamp, 'Should include timestamp');
    assert(Array.isArray(response.error.suggestions), 'Should include suggestions');
    
    // Test development mode response
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const devResponse = errorHandler.formatErrorResponse(error, req);
    assert(devResponse.error.details, 'Should include details in development');
    assert(devResponse.error.stack, 'Should include stack in development');
    assert(devResponse.error.originalMessage, 'Should include original message in development');
    
    // Restore environment
    process.env.NODE_ENV = originalEnv;
    
    console.log('Error response formatting: PASS');
}

function testSuggestionsGeneration() {
    console.log('Testing suggestions generation...');
    
    const errorHandler = createErrorHandler();
    
    // Test validation error suggestions
    const validationError = createValidationError('Invalid input');
    const validationSuggestions = errorHandler.getSuggestions(validationError);
    assert(validationSuggestions.length > 0, 'Should have validation suggestions');
    assert(validationSuggestions.some(s => s.includes('datos')), 'Should suggest data review');
    
    // Test authentication error suggestions
    const authError = createAuthenticationError('Invalid token');
    const authSuggestions = errorHandler.getSuggestions(authError);
    assert(authSuggestions.length > 0, 'Should have auth suggestions');
    assert(authSuggestions.some(s => s.includes('credenciales')), 'Should suggest credentials check');
    
    // Test rate limit error suggestions
    const rateLimitError = createRateLimitError('Too many requests');
    const rateLimitSuggestions = errorHandler.getSuggestions(rateLimitError);
    assert(rateLimitSuggestions.length > 0, 'Should have rate limit suggestions');
    assert(rateLimitSuggestions.some(s => s.includes('minutos') || s.includes('espere')), 'Should suggest waiting');
    
    console.log('Suggestions generation: PASS');
}

function testBodySanitization() {
    console.log('Testing body sanitization...');
    
    const errorHandler = createErrorHandler();
    
    // Test sanitization of sensitive data
    const bodyWithSensitiveData = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'xyz789',
        normalField: 'normal value'
    };
    
    const sanitized = errorHandler.sanitizeBody(bodyWithSensitiveData);
    
    assert(sanitized.username === 'testuser', 'Should preserve normal fields');
    assert(sanitized.normalField === 'normal value', 'Should preserve normal fields');
    assert(sanitized.password === '[REDACTED]', 'Should redact password');
    assert(sanitized.token === '[REDACTED]', 'Should redact token');
    assert(sanitized.apiKey === '[REDACTED]', 'Should redact API key');
    
    // Test null/undefined body
    assert(errorHandler.sanitizeBody(null) === null, 'Should handle null body');
    assert(errorHandler.sanitizeBody(undefined) === null, 'Should handle undefined body');
    
    console.log('Body sanitization: PASS');
}

function testErrorInheritance() {
    console.log('Testing error inheritance...');
    
    const error = createValidationError('Test error');
    
    assert(error instanceof Error, 'Should inherit from Error');
    assert(error.name === 'ValidationError', 'Should have correct name');
    assert(error.message === 'Test error', 'Should have correct message');
    assert(error.stack, 'Should have stack trace');
    assert(error.category === ErrorCategory.VALIDATION, 'Should have category');
    assert(error.statusCode === 400, 'Should have status code');
    assert(error.severity === ErrorSeverity.LOW, 'Should have severity');
    assert(error.userMessage, 'Should have user message');
    assert(error.timestamp, 'Should have timestamp');
    assert(error.requestId, 'Should have request ID');
    
    console.log('Error inheritance: PASS');
}

function testErrorSerialization() {
    console.log('Testing error serialization...');
    
    const error = createValidationError('Test error', { field: 'test' });
    const serialized = error.toJSON();
    
    assert(serialized.name === 'ValidationError', 'Should serialize name');
    assert(serialized.message === 'Test error', 'Should serialize message');
    assert(serialized.category === ErrorCategory.VALIDATION, 'Should serialize category');
    assert(serialized.statusCode === 400, 'Should serialize status code');
    assert(serialized.severity === ErrorSeverity.LOW, 'Should serialize severity');
    assert(serialized.userMessage, 'Should serialize user message');
    assert(serialized.details.field === 'test', 'Should serialize details');
    assert(serialized.timestamp, 'Should serialize timestamp');
    assert(serialized.requestId, 'Should serialize request ID');
    
    // Test development mode serialization
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const devSerialized = error.toJSON();
    assert(devSerialized.stack, 'Should include stack in development');
    
    // Restore environment
    process.env.NODE_ENV = originalEnv;
    
    console.log('Error serialization: PASS');
}

function testAllErrorTypes() {
    console.log('Testing all error types...');
    
    const errors = [
        createValidationError('Validation error'),
        createAuthenticationError('Auth error'),
        createAuthorizationError('Authz error'),
        createRateLimitError('Rate limit error'),
        createExternalAPIError('API error'),
        createInternalServerError('Server error'),
        createNotFoundError('Not found error'),
        createBusinessLogicError('Business logic error'),
        createNetworkError('Network error'),
        createTimeoutError('Timeout error')
    ];
    
    errors.forEach(error => {
        assert(error.name, 'Should have name');
        assert(error.category, 'Should have category');
        assert(error.statusCode, 'Should have status code');
        assert(error.severity, 'Should have severity');
        assert(error.userMessage, 'Should have user message');
        assert(error.timestamp, 'Should have timestamp');
        assert(error.requestId, 'Should have request ID');
    });
    
    console.log('All error types: PASS');
}

/**
 * Ejecutar todos los tests
 */
async function runAllErrorHandlingTests() {
    console.log('=== RUNNING COMPREHENSIVE ERROR HANDLING TESTS V4-16-T1 ===\n');
    
    try {
        testErrorCreation();
        testErrorLogger();
        testErrorHandlerMiddleware();
        testErrorResponseFormatting();
        testSuggestionsGeneration();
        testBodySanitization();
        testErrorInheritance();
        testErrorSerialization();
        testAllErrorTypes();
        
        console.log('\n=== ALL ERROR HANDLING TESTS PASSED ===');
        console.log('Comprehensive error handling working correctly');
        return true;
    } catch (error) {
        console.error('\n=== ERROR HANDLING TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Ejecutar tests si este archivo es llamado directamente
if (require.main === module) {
    runAllErrorHandlingTests();
}

module.exports = {
    runAllErrorHandlingTests,
    testErrorCreation,
    testErrorLogger,
    testErrorHandlerMiddleware,
    testErrorResponseFormatting,
    testSuggestionsGeneration,
    testBodySanitization,
    testErrorInheritance,
    testErrorSerialization,
    testAllErrorTypes
};
