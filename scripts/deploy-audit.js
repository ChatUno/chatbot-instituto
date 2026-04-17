/**
 * Auditoría completa de deploy para el chatbot IES Juan De Lanuza
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Verifica estructura del proyecto
 */
async function checkProjectStructure() {
    console.log('\n=== VERIFICANDO ESTRUCTURA DEL PROYECTO ===');
    
    const requiredStructure = {
        'src': ['server.js', 'core', 'services', 'security', 'utils', 'quality'],
        'src/core': ['chatbot-backend.js', 'ai-client.js', 'fallback-logic-manager.js'],
        'src/services': ['search-service.js', 'embedding-service.js', 'memory-service.js', 'prompt-service.js', 'response-polishing-service.js', 'observability-service.js'],
        'src/security': ['auth.js', 'input-sanitizer.js', 'error-handler.js', 'circuit-breaker.js', 'validation.js'],
        'src/utils': ['config.js', 'file-utils.js', 'container.js'],
        'src/quality': ['chunk-quality-manager.js', 'optimize-chunks.js'],
        'data': ['chunks.json'],
        'frontend': ['index.html', 'style.css', 'app.js'],
        'logs': [],
        'tests': ['unit', 'integration', 'e2e'],
        'scripts': [],
        'docs': []
    };
    
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    for (const [dir, files] of Object.entries(requiredStructure)) {
        try {
            const dirPath = path.join(process.cwd(), dir);
            const dirExists = await fs.stat(dirPath).then(() => true).catch(() => false);
            
            if (!dirExists) {
                results.failed++;
                results.issues.push(`Missing directory: ${dir}`);
                continue;
            }
            
            console.log(`  ${dir} - OK`);
            results.passed++;
            
            // Verificar archivos en el directorio
            if (files.length > 0) {
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
                    
                    if (!fileExists) {
                        results.failed++;
                        results.issues.push(`Missing file: ${dir}/${file}`);
                    } else {
                        console.log(`    ${file} - OK`);
                    }
                }
            }
        } catch (error) {
            results.failed++;
            results.issues.push(`Error checking ${dir}: ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Verifica dependencias críticas
 */
async function checkDependencies() {
    console.log('\n=== VERIFICANDO DEPENDENCIAS ===');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    const criticalDeps = ['express', 'cors', 'axios', 'bcryptjs', 'jsonwebtoken', 'joi', 'dotenv', 'express-rate-limit'];
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    for (const dep of criticalDeps) {
        if (packageJson.dependencies[dep]) {
            console.log(`  ${dep} - OK (${packageJson.dependencies[dep]})`);
            results.passed++;
        } else {
            console.log(`  ${dep} - MISSING`);
            results.failed++;
            results.issues.push(`Missing dependency: ${dep}`);
        }
    }
    
    return results;
}

/**
 * Verifica archivos de configuración
 */
async function checkConfiguration() {
    console.log('\n=== VERIFICANDO CONFIGURACIÓN ===');
    
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    const configFiles = [
        '.env',
        '.gitignore',
        'package.json'
    ];
    
    for (const file of configFiles) {
        const filePath = path.join(process.cwd(), file);
        const exists = await fs.stat(filePath).then(() => true).catch(() => false);
        
        if (exists) {
            console.log(`  ${file} - OK`);
            results.passed++;
            
            // Verificar contenido de .env
            if (file === '.env') {
                const content = await fs.readFile(filePath, 'utf8');
                const requiredEnvVars = ['GROQ_API_KEY', 'PORT'];
                
                for (const envVar of requiredEnvVars) {
                    if (content.includes(envVar)) {
                        console.log(`    ${envVar} - OK`);
                    } else {
                        console.log(`    ${envVar} - WARNING: Not found`);
                    }
                }
            }
        } else {
            console.log(`  ${file} - MISSING`);
            results.failed++;
            results.issues.push(`Missing config file: ${file}`);
        }
    }
    
    return results;
}

/**
 * Verifica endpoints del servidor
 */
async function checkServerEndpoints() {
    console.log('\n=== VERIFICANDO ENDPOINTS DEL SERVIDOR ===');
    
    const serverPath = path.join(process.cwd(), 'src', 'server.js');
    const content = await fs.readFile(serverPath, 'utf8');
    
    const expectedEndpoints = [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/health' },
        { method: 'POST', path: '/chat' },
        { method: 'GET', path: '/chunks' },
        { method: 'POST', path: '/chunks' }
    ];
    
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    for (const endpoint of expectedEndpoints) {
        const pattern = new RegExp(`app\\.${endpoint.method.toLowerCase()}\\(\\s*['"]${endpoint.path}['"]`, 'gi');
        if (pattern.test(content)) {
            console.log(`  ${endpoint.method} ${endpoint.path} - OK`);
            results.passed++;
        } else {
            console.log(`  ${endpoint.method} ${endpoint.path} - MISSING`);
            results.failed++;
            results.issues.push(`Missing endpoint: ${endpoint.method} ${endpoint.path}`);
        }
    }
    
    return results;
}

/**
 * Verifica middleware de seguridad
 */
async function checkSecurityMiddleware() {
    console.log('\n=== VERIFICANDO MIDDLEWARE DE SEGURIDAD ===');
    
    const serverPath = path.join(process.cwd(), 'src', 'server.js');
    const content = await fs.readFile(serverPath, 'utf8');
    
    const securityMiddleware = [
        'cors',
        'express.json()',
        'rateLimit',
        'authMiddleware',
        'inputSanitizer',
        'errorHandler'
    ];
    
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    for (const middleware of securityMiddleware) {
        if (content.includes(middleware)) {
            console.log(`  ${middleware} - OK`);
            results.passed++;
        } else {
            console.log(`  ${middleware} - MISSING`);
            results.failed++;
            results.issues.push(`Missing security middleware: ${middleware}`);
        }
    }
    
    return results;
}

/**
 * Verifica datos y chunks
 */
async function checkDataAndChunks() {
    console.log('\n=== VERIFICANDO DATOS Y CHUNKS ===');
    
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    // Verificar chunks.json
    const chunksPath = path.join(process.cwd(), 'data', 'chunks.json');
    try {
        const chunksData = await fs.readFile(chunksPath, 'utf8');
        const chunks = JSON.parse(chunksData);
        
        if (Array.isArray(chunks) && chunks.length > 0) {
            console.log(`  chunks.json - OK (${chunks.length} chunks)`);
            results.passed++;
            
            // Verificar estructura de chunks
            const validChunks = chunks.filter(chunk => 
                chunk.id && chunk.text && chunk.source
            );
            
            if (validChunks.length === chunks.length) {
                console.log(`    Chunk structure - OK`);
                results.passed++;
            } else {
                console.log(`    Chunk structure - WARNING: ${chunks.length - validChunks.length} invalid chunks`);
                results.issues.push(`Invalid chunk structure in ${chunks.length - validChunks.length} chunks`);
            }
        } else {
            console.log(`  chunks.json - EMPTY OR INVALID`);
            results.failed++;
            results.issues.push('chunks.json is empty or invalid');
        }
    } catch (error) {
        console.log(`  chunks.json - ERROR: ${error.message}`);
        results.failed++;
        results.issues.push(`Error reading chunks.json: ${error.message}`);
    }
    
    return results;
}

/**
 * Verifica tests
 */
async function checkTests() {
    console.log('\n=== VERIFICANDO TESTS ===');
    
    const testDirs = ['tests/unit', 'tests/integration', 'tests/e2e'];
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    for (const testDir of testDirs) {
        const dirPath = path.join(process.cwd(), testDir);
        const exists = await fs.stat(dirPath).then(() => true).catch(() => false);
        
        if (exists) {
            const files = await fs.readdir(dirPath);
            const testFiles = files.filter(file => file.startsWith('test-') && file.endsWith('.js'));
            
            console.log(`  ${testDir} - OK (${testFiles.length} test files)`);
            results.passed++;
            
            if (testFiles.length === 0) {
                results.issues.push(`No test files found in ${testDir}`);
            }
        } else {
            console.log(`  ${testDir} - MISSING`);
            results.failed++;
            results.issues.push(`Missing test directory: ${testDir}`);
        }
    }
    
    return results;
}

/**
 * Simula pruebas de integración básicas
 */
async function runBasicTests() {
    console.log('\n=== EJECUTANDO PRUEBAS BÁSICAS ===');
    
    const results = {
        passed: 0,
        failed: 0,
        issues: []
    };
    
    // Test 1: Import del servidor
    try {
        const server = require('../src/server.js');
        console.log('  Server import - OK');
        results.passed++;
    } catch (error) {
        console.log(`  Server import - FAILED: ${error.message}`);
        results.failed++;
        results.issues.push(`Server import failed: ${error.message}`);
    }
    
    // Test 2: Import de servicios principales
    const services = [
        '../src/services/search-service',
        '../src/services/embedding-service',
        '../src/services/memory-service',
        '../src/services/prompt-service',
        '../src/services/response-polishing-service',
        '../src/services/observability-service'
    ];
    
    for (const service of services) {
        try {
            require(service);
            console.log(`  ${path.basename(service)} - OK`);
            results.passed++;
        } catch (error) {
            console.log(`  ${path.basename(service)} - FAILED: ${error.message}`);
            results.failed++;
            results.issues.push(`Service import failed: ${path.basename(service)} - ${error.message}`);
        }
    }
    
    // Test 3: Import de seguridad
    const security = [
        '../src/security/auth',
        '../src/security/input-sanitizer',
        '../src/security/error-handler',
        '../src/security/circuit-breaker',
        '../src/security/validation'
    ];
    
    for (const sec of security) {
        try {
            require(sec);
            console.log(`  ${path.basename(sec)} - OK`);
            results.passed++;
        } catch (error) {
            console.log(`  ${path.basename(sec)} - FAILED: ${error.message}`);
            results.failed++;
            results.issues.push(`Security import failed: ${path.basename(sec)} - ${error.message}`);
        }
    }
    
    return results;
}

/**
 * Genera reporte de deploy
 */
function generateDeployReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('           REPORTE DE AUDITORÍA DE DEPLOY');
    console.log('='.repeat(60));
    
    const totalPassed = Object.values(results).reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = Object.values(results).reduce((sum, result) => sum + result.failed, 0);
    const totalTests = totalPassed + totalFailed;
    
    console.log(`\nRESUMEN GENERAL:`);
    console.log(`  Tests pasados: ${totalPassed}/${totalTests} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
    console.log(`  Tests fallidos: ${totalFailed}/${totalTests}`);
    
    if (totalFailed === 0) {
        console.log(`\n  Estado: READY FOR DEPLOY`);
        console.log(`  Nivel de confianza: ALTO`);
    } else {
        console.log(`\n  Estado: NOT READY FOR DEPLOY`);
        console.log(`  Nivel de confianza: BAJO`);
    }
    
    console.log(`\nDETALLES POR CATEGORÍA:`);
    for (const [category, result] of Object.entries(results)) {
        console.log(`  ${category.toUpperCase()}:`);
        console.log(`    Pasados: ${result.passed}`);
        console.log(`    Fallidos: ${result.failed}`);
        
        if (result.issues.length > 0) {
            console.log(`    Issues:`);
            result.issues.forEach(issue => {
                console.log(`      - ${issue}`);
            });
        }
    }
    
    console.log('\n' + '='.repeat(60));
    
    return {
        ready: totalFailed === 0,
        confidence: totalPassed / totalTests,
        summary: {
            totalPassed,
            totalFailed,
            totalTests
        },
        details: results
    };
}

/**
 * Función principal
 */
async function main() {
    console.log('=== AUDITORÍA DE DEPLOY - CHATBOT IES JUAN DE LANUZA ===');
    console.log('Fecha:', new Date().toISOString());
    console.log('Node.js version:', process.version);
    console.log('Platform:', process.platform);
    
    const results = {
        structure: await checkProjectStructure(),
        dependencies: await checkDependencies(),
        configuration: await checkConfiguration(),
        endpoints: await checkServerEndpoints(),
        security: await checkSecurityMiddleware(),
        data: await checkDataAndChunks(),
        tests: await checkTests(),
        basicTests: await runBasicTests()
    };
    
    const report = generateDeployReport(results);
    
    // Guardar reporte en archivo
    const reportPath = path.join(process.cwd(), 'logs', 'deploy-audit-report.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        ...report
    }, null, 2));
    
    console.log(`\nReporte guardado en: ${reportPath}`);
    
    return report;
}

if (require.main === module) {
    main().catch(error => {
        console.error('Error en auditoría de deploy:', error);
        process.exit(1);
    });
}

module.exports = { main, generateDeployReport };
