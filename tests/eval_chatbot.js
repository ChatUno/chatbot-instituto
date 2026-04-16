/**
 * Suite de Evaluación Automática QA para Chatbot IES Juan de Lanuza
 */

const { handleUserQuery } = require('../chatbot-backend');
const { ObservabilityManager } = require('../observability');

class ChatbotEvaluator {
    constructor() {
        this.testCases = [
            {
                id: 1,
                q: "¿Qué bachilleratos hay?",
                expected_contains: ["Ciencias", "Humanidades"],
                expected_source: "oferta",
                min_confidence: 0.7
            },
            {
                id: 2,
                q: "¿Dónde está el instituto?",
                expected_contains: ["Borja", "Capuchinos"],
                expected_source: "centro",
                min_confidence: 0.7
            },
            {
                id: 3,
                q: "¿Qué FP hay?",
                expected_contains: ["Cocina", "Dependencia"],
                expected_source: "oferta",
                min_confidence: 0.7
            },
            {
                id: 4,
                q: "¿Cuál es el teléfono?",
                expected_contains: ["976", "867", "368"],
                expected_source: "centro",
                min_confidence: 0.7
            },
            {
                id: 5,
                q: "¿Qué asignaturas tiene filosofía?",
                expected_contains: [],
                expected_source: "fallback",
                min_confidence: 0.3,
                should_be_negative: true
            },
            {
                id: 6,
                q: "¿Qué horarios tienen?",
                expected_contains: [],
                expected_source: "fallback",
                min_confidence: 0.3,
                should_be_negative: true
            }
        ];
        
        this.results = [];
    }

    /**
     * Ejecuta todos los tests de evaluación
     */
    async runAllTests() {
        console.log('=== INICIANDO EVALUACIÓN AUTOMÁTICA QA ===');
        console.log(`Total de tests: ${this.testCases.length}\n`);

        for (const testCase of this.testCases) {
            await this.runSingleTest(testCase);
        }

        this.generateReport();
    }

    /**
     * Ejecuta un test individual
     */
    async runSingleTest(testCase) {
        console.log(`--- Test ${testCase.id}: ${testCase.q} ---`);
        
        const startTime = Date.now();
        
        try {
            // Ejecutar consulta al chatbot
            const response = await handleUserQuery(testCase.q);
            
            const endTime = Date.now();
            const latency = endTime - startTime;

            // Evaluar respuesta
            const evaluation = this.evaluateResponse(response, testCase);
            
            // Guardar resultado
            const result = {
                test_id: testCase.id,
                query: testCase.q,
                response: response,
                expected: testCase,
                evaluation: evaluation,
                latency_ms: latency,
                timestamp: new Date().toISOString()
            };

            this.results.push(result);
            
            // Mostrar resultado inmediato
            const status = evaluation.pass ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} - Latency: ${latency}ms - Score: ${evaluation.score}/100`);
            
            if (!evaluation.pass) {
                console.log(`   Motivo: ${evaluation.reason}`);
                console.log(`   Respuesta: ${response.substring(0, 100)}...`);
            }
            
        } catch (error) {
            console.log(`❌ ERROR - ${error.message}`);
            
            this.results.push({
                test_id: testCase.id,
                query: testCase.q,
                error: error.message,
                evaluation: { pass: false, reason: 'Error en ejecución' },
                timestamp: new Date().toISOString()
            });
        }
        
        console.log('');
    }

    /**
     * Evalúa una respuesta contra los criterios esperados
     */
    evaluateResponse(response, testCase) {
        let score = 0;
        let maxScore = 100;
        const issues = [];

        // 1. Verificar contenido esperado
        if (testCase.expected_contains.length > 0) {
            const responseLower = response.toLowerCase();
            const allExpectedFound = testCase.expected_contains.every(expected => 
                responseLower.includes(expected.toLowerCase())
            );
            
            if (allExpectedFound) {
                score += 40; // 40% del score
            } else {
                issues.push('Contenido esperado no encontrado');
            }
        }

        // 2. Verificar si debe ser negativa
        if (testCase.should_be_negative) {
            const isNegativeResponse = response.toLowerCase().includes('no dispongo') ||
                                   response.toLowerCase().includes('no tengo información') ||
                                   response.toLowerCase().includes('información no disponible');
            
            if (isNegativeResponse) {
                score += 40;
            } else {
                issues.push('Debería ser respuesta negativa pero no lo es');
            }
        } else {
            // Si no debe ser negativa, verificar que no lo sea
            const isNegativeResponse = response.toLowerCase().includes('no dispongo') ||
                                   response.toLowerCase().includes('no tengo información');
            
            if (!isNegativeResponse) {
                score += 10; // Bonus por no ser negativa cuando no debe
            }
        }

        // 3. Verificar longitud apropiada
        if (response.length > 20 && response.length < 500) {
            score += 10; // 10% por longitud apropiada
        } else if (response.length < 20) {
            issues.push('Respuesta demasiado corta');
        } else if (response.length > 500) {
            issues.push('Respuesta demasiado larga');
        }

        // 4. Verificar calidad del contenido
        if (!this.containsHallucinations(response, testCase)) {
            score += 10; // 10% por no tener alucinaciones
        } else {
            issues.push('Posibles alucinaciones detectadas');
        }

        // 5. Verificar estructura
        if (this.hasGoodStructure(response)) {
            score += 10; // 10% por buena estructura
        } else {
            issues.push('Estructura pobre');
        }

        const pass = issues.length === 0 && score >= 70; // Mínimo 70% para pasar

        return {
            pass: pass,
            score: Math.min(100, score),
            issues: issues,
            reason: issues.join('; ')
        };
    }

    /**
     * Verifica si la respuesta contiene alucinaciones
     */
    containsHallucinations(response, testCase) {
        // Para respuestas negativas, no verificar alucinaciones
        if (testCase.should_be_negative) {
            return false;
        }

        // Patrones comunes de alucinación
        const hallucinationPatterns = [
            /el centro ofrece.*cuando.*no está en el contexto/i,
            /según mi información.*pero no está en los datos/i,
            /el instituto tiene.*programas.*no mencionados/i
        ];

        return !hallucinationPatterns.some(pattern => pattern.test(response));
    }

    /**
     * Verifica si la respuesta tiene buena estructura
     */
    hasGoodStructure(response) {
        // Respuestas con listas tienen buena estructura
        if (response.includes('- ') || response.includes('\n-')) {
            return true;
        }

        // Respuestas con párrafos bien definidos
        if (response.includes('. ') && response.split('.').length >= 2) {
            return true;
        }

        // Respuestas cortas y directas
        if (response.length < 100 && response.includes('.')) {
            return true;
        }

        return false;
    }

    /**
     * Genera reporte final de evaluación
     */
    generateReport() {
        console.log('\n=== REPORTE DE EVALUACIÓN QA ===');
        
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.evaluation && r.evaluation.pass).length;
        const failedTests = totalTests - passedTests;
        const passRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} (${passRate}%)`);
        console.log(`Failed: ${failedTests}`);
        
        // Tests fallidos
        const failedResults = this.results.filter(r => r.evaluation && !r.evaluation.pass);
        if (failedResults.length > 0) {
            console.log('\n--- TESTS FALLIDOS ---');
            failedResults.forEach(result => {
                console.log(`Test ${result.test_id}: ${result.query}`);
                console.log(`  Issues: ${result.evaluation.issues.join(', ')}`);
                console.log(`  Score: ${result.evaluation.score}/100`);
            });
        }

        // Métricas de rendimiento
        const avgLatency = this.results
            .filter(r => r.latency_ms)
            .reduce((sum, r) => sum + r.latency_ms, 0) / passedTests;

        console.log('\n--- MÉTRICAS DE RENDIMIENTO ---');
        console.log(`Latencia promedio: ${avgLatency.toFixed(0)}ms`);
        console.log(`Score promedio: ${(this.results.reduce((sum, r) => sum + (r.evaluation?.score || 0), 0) / totalTests).toFixed(1)}/100`);

        // Métricas del sistema
        const systemMetrics = ObservabilityManager.getMetrics();
        console.log('\n--- MÉTRICAS DEL SISTEMA ---');
        console.log(`RAG Hit Rate: ${systemMetrics.retrieval_hit_rate}`);
        console.log(`Fallback Rate: ${systemMetrics.fallback_rate}`);
        console.log(`Hallucination Rate: ${systemMetrics.hallucination_rate}`);

        // Veredicto final
        console.log('\n--- VEREDICTO FINAL ---');
        if (passRate >= 80) {
            console.log('✅ SISTENO APROBADO - Calidad aceptable para producción');
        } else if (passRate >= 60) {
            console.log('⚠️  SISTENO CONDICIONAL - Necesita mejoras antes de producción');
        } else {
            console.log('❌ SISTENO NO APROBADO - Requiere mejoras significativas');
        }

        console.log('\n=== FIN EVALUACIÓN ===');
    }
}

// Ejecutar evaluación si se llama directamente
if (require.main === module) {
    const evaluator = new ChatbotEvaluator();
    evaluator.runAllTests().catch(console.error);
}

module.exports = {
    ChatbotEvaluator
};
