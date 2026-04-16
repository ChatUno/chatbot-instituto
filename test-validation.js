/**
 * Tests para sistema de validación V4-05-T1
 */

const {
    validateChatRequest,
    validateChunksRequest,
    validateChunksQuery,
    chatRequestSchema,
    chunksRequestSchema,
    chunksQuerySchema
} = require('./validation.js');

/**
 * Mock Express request/response para testing
 */
function createMockRequest(method, path, body = {}, query = {}) {
    return {
        method,
        path,
        body,
        query,
        headers: {}
    };
}

function createMockResponse() {
    const res = {
        statusCode: null,
        responseData: null,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.responseData = data;
            return this;
        }
    };
    return res;
}

/**
 * Test helper para middleware
 */
function testMiddleware(middleware, req, expectedStatus = 200) {
    return new Promise((resolve) => {
        const res = createMockResponse();
        let nextCalled = false;
        let responseSent = false;
        
        const next = () => {
            nextCalled = true;
            resolve({ success: true, status: res.statusCode, data: res.responseData });
        };
        
        // Override res.json y res.status para detectar respuestas
        const originalStatus = res.status;
        const originalJson = res.json;
        
        res.status = function(code) {
            responseSent = true;
            return originalStatus.call(this, code);
        };
        
        res.json = function(data) {
            resolve({ success: false, status: res.statusCode, data: res.responseData });
            return originalJson.call(this, data);
        };
        
        middleware(req, res, next);
        
        // Si no se envió respuesta ni se llamó next, esperar
        setTimeout(() => {
            if (!nextCalled && !responseSent) {
                resolve({ success: true, status: res.statusCode, data: res.responseData });
            }
        }, 100);
    });
}

/**
 * Tests de schemas
 */
async function testChatRequestSchema() {
    console.log('Testing chat request schema...');
    
    // Test valid request
    const validResult = chatRequestSchema.validate({ message: 'Hola mundo' });
    if (validResult.error) {
        throw new Error(`Valid request should pass: ${validResult.error.message}`);
    }
    
    // Test invalid request (empty message)
    const invalidResult = chatRequestSchema.validate({ message: '' });
    if (!invalidResult.error) {
        throw new Error('Empty message should fail validation');
    }
    
    // Test too long message
    const longResult = chatRequestSchema.validate({ message: 'x'.repeat(2000) });
    if (!longResult.error) {
        throw new Error('Too long message should fail validation');
    }
    
    console.log('Chat request schema: PASS');
}

async function testChunksRequestSchema() {
    console.log('Testing chunks request schema...');
    
    // Test valid request
    const validChunks = [
        { id: 1, text: 'Este es un chunk válido', source: 'centro' },
        { id: 2, text: 'Otro chunk válido', source: 'oferta' }
    ];
    const validResult = chunksRequestSchema.validate({ chunks: validChunks });
    if (validResult.error) {
        throw new Error(`Valid chunks should pass: ${validResult.error.message}`);
    }
    
    // Test invalid chunks (missing required fields)
    const invalidChunks = [
        { id: 1, text: 'Chunk sin source' }
    ];
    const invalidResult = chunksRequestSchema.validate({ chunks: invalidChunks });
    if (!invalidResult.error) {
        throw new Error('Chunks missing required fields should fail');
    }
    
    // Test empty chunks array
    const emptyResult = chunksRequestSchema.validate({ chunks: [] });
    if (!emptyResult.error) {
        throw new Error('Empty chunks array should fail');
    }
    
    console.log('Chunks request schema: PASS');
}

async function testChunksQuerySchema() {
    console.log('Testing chunks query schema...');
    
    // Test valid query
    const validResult = chunksQuerySchema.validate({ limit: 10, offset: 0 });
    if (validResult.error) {
        throw new Error(`Valid query should pass: ${validResult.error.message}`);
    }
    
    // Test invalid limit
    const invalidResult = chunksQuerySchema.validate({ limit: -1 });
    if (!invalidResult.error) {
        throw new Error('Negative limit should fail');
    }
    
    // Test defaults
    const defaultResult = chunksQuerySchema.validate({});
    if (defaultResult.error) {
        throw new Error(`Default values should work: ${defaultResult.error.message}`);
    }
    if (defaultResult.value.limit !== 10 || defaultResult.value.offset !== 0) {
        throw new Error('Default values not applied correctly');
    }
    
    console.log('Chunks query schema: PASS');
}

/**
 * Tests de middleware
 */
async function testChatRequestMiddleware() {
    console.log('Testing chat request middleware...');
    
    // Test valid request
    const validReq = createMockRequest('POST', '/chat', { message: 'Hola mundo' });
    const validResult = await testMiddleware(validateChatRequest, validReq);
    if (!validResult.success) {
        throw new Error('Valid chat request should pass middleware');
    }
    
    // Test invalid request
    const invalidReq = createMockRequest('POST', '/chat', { message: '' });
    const invalidResult = await testMiddleware(validateChatRequest, invalidReq, 400);
    if (invalidResult.success || invalidResult.status !== 400) {
        throw new Error('Invalid chat request should fail with 400');
    }
    
    console.log('Chat request middleware: PASS');
}

async function testChunksRequestMiddleware() {
    console.log('Testing chunks request middleware...');
    
    // Test valid request
    const validChunks = [
        { id: 1, text: 'Chunk válido', source: 'centro' }
    ];
    const validReq = createMockRequest('POST', '/chunks', { chunks: validChunks });
    const validResult = await testMiddleware(validateChunksRequest, validReq);
    if (!validResult.success) {
        throw new Error('Valid chunks request should pass middleware');
    }
    
    // Test invalid request
    const invalidReq = createMockRequest('POST', '/chunks', { chunks: [] });
    const invalidResult = await testMiddleware(validateChunksRequest, invalidReq, 400);
    if (invalidResult.success || invalidResult.status !== 400) {
        throw new Error('Invalid chunks request should fail with 400');
    }
    
    console.log('Chunks request middleware: PASS');
}

async function testChunksQueryMiddleware() {
    console.log('Testing chunks query middleware...');
    
    // Test valid query
    const validReq = createMockRequest('GET', '/chunks', {}, { limit: 5 });
    const validResult = await testMiddleware(validateChunksQuery, validReq);
    if (!validResult.success) {
        throw new Error('Valid chunks query should pass middleware');
    }
    
    // Test invalid query
    const invalidReq = createMockRequest('GET', '/chunks', {}, { limit: -1 });
    const invalidResult = await testMiddleware(validateChunksQuery, invalidReq, 400);
    if (invalidResult.success || invalidResult.status !== 400) {
        throw new Error('Invalid chunks query should fail with 400');
    }
    
    console.log('Chunks query middleware: PASS');
}

/**
 * Test de integración con configuración
 */
async function testConfigurationIntegration() {
    console.log('Testing configuration integration...');
    
    // Test que usa valores de configuración
    const veryLongMessage = 'x'.repeat(2000);
    const result = chatRequestSchema.validate({ message: veryLongMessage });
    
    if (!result.error) {
        throw new Error('Should respect frontend.maxInputLength from config');
    }
    
    console.log('Configuration integration: PASS');
}

/**
 * Ejecutar todos los tests
 */
async function runAllValidationTests() {
    console.log('=== RUNNING VALIDATION TESTS V4-05-T1 ===\n');
    
    try {
        await testChatRequestSchema();
        await testChunksRequestSchema();
        await testChunksQuerySchema();
        await testChatRequestMiddleware();
        await testChunksRequestMiddleware();
        await testChunksQueryMiddleware();
        await testConfigurationIntegration();
        
        console.log('\n=== ALL VALIDATION TESTS PASSED ===');
        console.log('Request validation system working correctly');
        return true;
    } catch (error) {
        console.error('\n=== VALIDATION TEST FAILED ===');
        console.error('Error:', error.message);
        return false;
    }
}

// Ejecutar tests si este archivo es llamado directamente
if (require.main === module) {
    runAllValidationTests();
}

module.exports = {
    runAllValidationTests,
    testChatRequestSchema,
    testChunksRequestSchema,
    testChunksQuerySchema,
    testChatRequestMiddleware,
    testChunksRequestMiddleware,
    testChunksQueryMiddleware,
    testConfigurationIntegration
};
