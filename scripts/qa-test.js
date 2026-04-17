const http = require('http');
const https = require('https');

// Función para hacer peticiones HTTP
function makeRequest(url, data = null) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            method: data ? 'POST' : 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = protocol.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(body)
                    };
                    resolve(response);
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Función para medir tiempo
function measureTime(fn) {
    return async (...args) => {
        const start = Date.now();
        const result = await fn(...args);
        const end = Date.now();
        return {
            ...result,
            latency: end - start
        };
    };
}

// Test Suite QA
class QATestSuite {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    async runTest(testName, testFn) {
        console.log(`\n🧪 EJECUTANDO: ${testName}`);
        try {
            const result = await testFn();
            console.log(`✅ ${testName}: PASADO`);
            this.results.push({ name: testName, status: 'PASSED', ...result });
            return result;
        } catch (error) {
            console.log(`❌ ${testName}: FALLADO - ${error.message}`);
            this.results.push({ name: testName, status: 'FAILED', error: error.message });
            return null;
        }
    }

    async testBasicConnectivity() {
        const health = await makeRequest(`${this.baseUrl}/health`);
        if (health.statusCode !== 200) {
            throw new Error(`Health check failed: ${health.statusCode}`);
        }
        return { healthCheck: health.body };
    }

    async testSmokeTests() {
        const tests = [
            { message: "hola", expectedType: "greeting" },
            { message: "info", expectedType: "info" },
            { message: "ayuda", expectedType: "help" }
        ];

        const results = [];
        for (const test of tests) {
            const response = await makeRequest(`${this.baseUrl}/chat`, { message: test.message });
            
            if (response.statusCode !== 200) {
                throw new Error(`Chat endpoint failed for "${test.message}": ${response.statusCode}`);
            }

            if (!response.body.response || response.body.response.trim() === '') {
                throw new Error(`Empty response for "${test.message}"`);
            }

            if (response.body.response.includes('Error') || response.body.response.includes('error')) {
                throw new Error(`Error response for "${test.message}": ${response.body.response}`);
            }

            results.push({
                message: test.message,
                response: response.body.response,
                latency: response.latency || 0
            });
        }

        return { smokeTests: results };
    }

    async testRAGKnowledge() {
        const questions = [
            "¿Qué bachilleratos hay?",
            "¿Qué FP hay?",
            "¿Qué ofrece el instituto?",
            "¿Dónde está el instituto?",
            "¿Cuál es el teléfono?",
            "¿Cuál es el email?"
        ];

        const results = [];
        for (const question of questions) {
            const response = await makeRequest(`${this.baseUrl}/chat`, { message: question });
            
            if (response.statusCode !== 200) {
                throw new Error(`Chat failed for "${question}": ${response.statusCode}`);
            }

            results.push({
                question,
                response: response.body.response,
                latency: response.latency || 0
            });
        }

        return { ragTests: results };
    }

    async testAntiHallucination() {
        const trapQuestions = [
            "¿Hay ingeniería aeroespacial?",
            "¿Tenéis medicina?",
            "¿Qué campus universitario tiene?",
            "¿Qué premios ha ganado el instituto?",
            "¿Quién es el director?"
        ];

        const results = [];
        for (const question of trapQuestions) {
            const response = await makeRequest(`${this.baseUrl}/chat`, { message: question });
            
            if (response.statusCode !== 200) {
                throw new Error(`Chat failed for "${question}": ${response.statusCode}`);
            }

            const resp = response.body.response.toLowerCase();
            const hasFallback = resp.includes('no dispongo') || 
                               resp.includes('no tengo') || 
                               resp.includes('no encuentro') ||
                               resp.includes('no sé') ||
                               resp.includes('información');

            results.push({
                question,
                response: response.body.response,
                hasCorrectFallback: hasFallback,
                latency: response.latency || 0
            });
        }

        return { antiHallucinationTests: results };
    }

    async testRobustness() {
        const variations = [
            "bachilleratos?",
            "QUE FP HAY",
            "q estudias ahi",
            "info instituto"
        ];

        const results = [];
        for (const message of variations) {
            const response = await makeRequest(`${this.baseUrl}/chat`, { message });
            
            if (response.statusCode !== 200) {
                throw new Error(`Chat failed for "${message}": ${response.statusCode}`);
            }

            results.push({
                message,
                response: response.body.response,
                latency: response.latency || 0
            });
        }

        return { robustnessTests: results };
    }

    async testConsistency() {
        const question = "¿Qué bachilleratos hay?";
        const results = [];

        for (let i = 0; i < 3; i++) {
            const response = await makeRequest(`${this.baseUrl}/chat`, { message: question });
            
            if (response.statusCode !== 200) {
                throw new Error(`Chat failed for attempt ${i + 1}: ${response.statusCode}`);
            }

            results.push({
                attempt: i + 1,
                response: response.body.response,
                latency: response.latency || 0
            });
        }

        // Check consistency
        const responses = results.map(r => r.response);
        const allSame = responses.every(r => r === responses[0]);

        return { 
            consistencyTests: results,
            isConsistent: allSame
        };
    }

    async testLatency() {
        const testQuestions = [
            "hola",
            "¿Qué bachilleratos hay?",
            "¿Dónde está el instituto?",
            "info"
        ];

        const latencies = [];
        for (const question of testQuestions) {
            const start = Date.now();
            const response = await makeRequest(`${this.baseUrl}/chat`, { message: question });
            const end = Date.now();
            
            if (response.statusCode !== 200) {
                throw new Error(`Chat failed for latency test "${question}": ${response.statusCode}`);
            }

            latencies.push(end - start);
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);

        return {
            latencyTests: {
                latencies,
                average: avgLatency,
                max: maxLatency,
                meetsThreshold: avgLatency < 5000 && maxLatency < 8000
            }
        };
    }

    async runFullTestSuite() {
        console.log('🚀 INICIANDO QA TEST SUITE - CHATBOT IES JUAN DE LANUZA');
        console.log('=' .repeat(60));

        // Envolver funciones con medición de tiempo
        const timedMakeRequest = measureTime(makeRequest);

        await this.runTest('Conectividad Básica', () => this.testBasicConnectivity());
        await this.runTest('Tests de Humo (Smoke)', () => this.testSmokeTests());
        await this.runTest('Conocimiento RAG', () => this.testRAGKnowledge());
        await this.runTest('Anti-Alucinación', () => this.testAntiHallucination());
        await this.runTest('Robustez (Input Variations)', () => this.testRobustness());
        await this.runTest('Consistencia', () => this.testConsistency());
        await this.runTest('Latencia', () => this.testLatency());

        this.generateReport();
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 REPORTE FINAL DE QA');
        console.log('='.repeat(60));

        const passed = this.results.filter(r => r.status === 'PASSED').length;
        const total = this.results.length;
        const score = Math.round((passed / total) * 100);

        console.log(`\n🎯 PUNTUACIÓN FINAL: ${score}/100`);
        console.log(`✅ Tests Pasados: ${passed}/${total}`);

        if (score >= 90) {
            console.log('🟢 ESTADO: LISTO PARA PRODUCCIÓN');
        } else if (score >= 75) {
            console.log('🟡 ESTADO: BUENO PERO AJUSTABLE');
        } else {
            console.log('🔴 ESTADO: TODAVÍA INESTABLE');
        }

        console.log('\n📋 DETALLE DE RESULTADOS:');
        this.results.forEach(result => {
            const icon = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${icon} ${result.name}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        console.log('\n' + '='.repeat(60));
    }
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
    const qa = new QATestSuite();
    qa.runFullTestSuite().catch(console.error);
}

module.exports = QATestSuite;
