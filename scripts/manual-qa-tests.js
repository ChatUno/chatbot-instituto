const QATestSuite = require('./qa-test.js');

class ManualQATests extends QATestSuite {
    constructor(baseUrl = 'http://localhost:3000') {
        super(baseUrl);
        this.conversationHistory = [];
    }

    async sendMessage(message) {
        const response = await makeRequest(`${this.baseUrl}/chat`, { message });
        this.conversationHistory.push({
            message,
            response: response.body.response,
            timestamp: new Date().toISOString()
        });
        return response.body.response;
    }

    async testConversationalMemory() {
        console.log('\n🧠 TEST DE MEMORIA CONVERSACIONAL');
        console.log('=' .repeat(50));

        // Limpiar historial para este test
        this.conversationHistory = [];

        const testSequence = [
            "¿Qué bachilleratos hay?",
            "¿y ese cuál es más difícil?",
            "¿cuál recomendarías?"
        ];

        const results = [];
        for (const [index, question] of testSequence.entries()) {
            console.log(`\nPregunta ${index + 1}: "${question}"`);
            const response = await this.sendMessage(question);
            console.log(`Respuesta: "${response}"`);
            
            results.push({
                step: index + 1,
                question,
                response,
                understandsContext: index > 0 ? this.analyzeContextUnderstanding(response) : null
            });
        }

        return { memoryTests: results };
    }

    analyzeContextUnderstanding(response) {
        const contextIndicators = [
            'bachillerato',
            'ciencias',
            'tecnología',
            'humanidades',
            'sociales',
            'ambos',
            'cualquiera',
            'depende'
        ];
        
        const responseLower = response.toLowerCase();
        return contextIndicators.some(indicator => responseLower.includes(indicator));
    }

    async testRealUserSimulation() {
        console.log('\n👤 SIMULACIÓN DE USUARIO REAL');
        console.log('=' .repeat(50));

        this.conversationHistory = [];

        const realConversation = [
            "hola",
            "quiero información sobre el instituto",
            "¿qué estudiar ahí?",
            "¿dónde está ubicado?",
            "¿y cómo contacto?",
            "gracias",
            "adiós"
        ];

        const results = [];
        for (const [index, message] of realConversation.entries()) {
            console.log(`\nUsuario: "${message}"`);
            const response = await this.sendMessage(message);
            console.log(`Bot: "${response}"`);
            
            results.push({
                turn: index + 1,
                userMessage: message,
                botResponse: response,
                isNatural: this.evaluateNaturalness(response),
                maintainsContext: this.evaluateContextMaintenance(message, response)
            });
        }

        return { realUserTests: results };
    }

    evaluateNaturalness(response) {
        // Evaluar si la respuesta suena natural vs robótica
        const roboticPatterns = [
            /^soy un asistente/,
            /^puedo ayudarte con/,
            /información sobre/,
            /el instituto ofrece/
        ];
        
        const responseLower = response.toLowerCase();
        const isRobotic = roboticPatterns.some(pattern => pattern.test(responseLower));
        
        return {
            isNatural: !isRobotic,
            score: isRobotic ? 0.3 : 0.8,
            reason: isRobotic ? 'Respuesta muy estructurada' : 'Respuesta natural'
        };
    }

    evaluateContextMaintenance(userMessage, botResponse) {
        // Evaluar si el bot mantiene el contexto de la conversación
        const userLower = userMessage.toLowerCase();
        const responseLower = botResponse.toLowerCase();
        
        if (userLower.includes('gracias') || userLower.includes('adiós')) {
            const appropriateResponses = ['de nada', 'hasta luego', 'nada', 'adiós'];
            return appropriateResponses.some(resp => responseLower.includes(resp));
        }
        
        return true; // Por defecto asumimos que mantiene contexto
    }

    async testDetailedKnowledge() {
        console.log('\n📚 TEST DETALLADO DE CONOCIMIENTO');
        console.log('=' .repeat(50));

        const detailedQuestions = [
            {
                question: "¿Qué bachilleratos específicos ofrecen?",
                expectedKeywords: ['ciencias', 'tecnología', 'humanidades', 'sociales'],
                category: 'bachillerato'
            },
            {
                question: "¿Qué ciclos de FP tienen?",
                expectedKeywords: ['hostelería', 'servicios', 'socioculturales'],
                category: 'fp'
            },
            {
                question: "¿Cuál es la dirección exacta?",
                expectedKeywords: ['capuchinos', 'borja', 'zaragoza'],
                category: 'contacto'
            },
            {
                question: "¿Qué teléfono de contacto?",
                expectedKeywords: ['976', '867', '368'],
                category: 'contacto'
            }
        ];

        const results = [];
        for (const test of detailedQuestions) {
            console.log(`\nPregunta: "${test.question}"`);
            const response = await this.sendMessage(test.question);
            console.log(`Respuesta: "${response}"`);
            
            const responseLower = response.toLowerCase();
            const foundKeywords = test.expectedKeywords.filter(keyword => 
                responseLower.includes(keyword.toLowerCase())
            );
            
            const completeness = foundKeywords.length / test.expectedKeywords.length;
            
            results.push({
                question: test.question,
                category: test.category,
                response,
                expectedKeywords: test.expectedKeywords,
                foundKeywords,
                completeness,
                isAccurate: completeness >= 0.5
            });
        }

        return { detailedKnowledgeTests: results };
    }

    async testAntiHallucinationDetailed() {
        console.log('\n🚫 TEST ANTI-ALUCINACIÓN DETALLADO');
        console.log('=' .repeat(50));

        const hallucinationTests = [
            {
                question: "¿Hay ingeniería aeroespacial?",
                shouldNotContain: ['aeroespacial', 'ingeniería', 'espacial'],
                shouldContain: ['no dispongo', 'no tengo', 'no encuentro']
            },
            {
                question: "¿Tenéis medicina?",
                shouldNotContain: ['medicina', 'médica', 'facultad'],
                shouldContain: ['no dispongo', 'no tengo', 'no encuentro']
            },
            {
                question: "¿Qué campus universitario tienen?",
                shouldNotContain: ['campus', 'universidad', 'universitario'],
                shouldContain: ['no dispongo', 'no tengo', 'no encuentro']
            },
            {
                question: "¿Qué premios ha ganado el instituto?",
                shouldNotContain: ['premio', 'galardón', 'reconocimiento'],
                shouldContain: ['no dispongo', 'no tengo', 'no encuentro']
            }
        ];

        const results = [];
        for (const test of hallucinationTests) {
            console.log(`\nPregunta trampa: "${test.question}"`);
            const response = await this.sendMessage(test.question);
            console.log(`Respuesta: "${response}"`);
            
            const responseLower = response.toLowerCase();
            
            const hasForbiddenContent = test.shouldNotContain.some(word => 
                responseLower.includes(word.toLowerCase())
            );
            
            const hasCorrectFallback = test.shouldContain.some(phrase => 
                responseLower.includes(phrase.toLowerCase())
            );
            
            results.push({
                question: test.question,
                response,
                hasForbiddenContent,
                hasCorrectFallback,
                isCorrect: !hasForbiddenContent && hasCorrectFallback
            });
        }

        return { antiHallucinationDetailed: results };
    }

    async runCompleteManualQA() {
        console.log('🚀 INICIANDO QA MANUAL COMPLETO');
        console.log('=' .repeat(60));

        await this.runTest('Memoria Conversacional', () => this.testConversationalMemory());
        await this.runTest('Simulación Usuario Real', () => this.testRealUserSimulation());
        await this.runTest('Conocimiento Detallado', () => this.testDetailedKnowledge());
        await this.runTest('Anti-Alucinación Detallado', () => this.testAntiHallucinationDetailed());

        this.generateDetailedReport();
    }

    generateDetailedReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 REPORTE DETALLADO DE QA MANUAL');
        console.log('='.repeat(60));

        const passed = this.results.filter(r => r.status === 'PASSED').length;
        const total = this.results.length;
        const score = Math.round((passed / total) * 100);

        console.log(`\n🎯 PUNTUACIÓN FINAL QA MANUAL: ${score}/100`);
        console.log(`✅ Tests Pasados: ${passed}/${total}`);

        // Análisis específico por categorías
        console.log('\n📋 ANÁLISIS POR CATEGORÍAS:');
        
        this.results.forEach(result => {
            const icon = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${icon} ${result.name}`);
            
            if (result.memoryTests) {
                const memoryResults = result.memoryTests;
                const contextUnderstanding = memoryResults
                    .filter(r => r.understandsContext !== null)
                    .map(r => r.understandsContext)
                    .filter(Boolean).length;
                
                console.log(`   🧠 Memoria: ${contextUnderstanding}/${memoryResults.length - 1} con contexto`);
            }
            
            if (result.detailedKnowledgeTests) {
                const knowledgeResults = result.detailedKnowledgeTests;
                const avgCompleteness = knowledgeResults.reduce((sum, r) => sum + r.completeness, 0) / knowledgeResults.length;
                console.log(`   📚 Conocimiento: ${Math.round(avgCompleteness * 100)}% completitud`);
            }
            
            if (result.antiHallucinationDetailed) {
                const antiHallucResults = result.antiHallucinationDetailed;
                const correctResponses = antiHallucResults.filter(r => r.isCorrect).length;
                console.log(`   🚫 Anti-alucinación: ${correctResponses}/${antiHallucResults.length} correctas`);
            }
            
            if (result.realUserTests) {
                const realUserResults = result.realUserTests;
                const naturalResponses = realUserResults.filter(r => r.isNatural.isNatural).length;
                console.log(`   👤 Naturalidad: ${naturalResponses}/${realUserResults.length} naturales`);
            }
        });

        // Recomendaciones específicas
        console.log('\n💡 RECOMENDACIONES:');
        if (score >= 90) {
            console.log('🟢 El chatbot está listo para producción');
            console.log('   • Todos los tests críticos pasados');
            console.log('   • Buen manejo de anti-alucinación');
            console.log('   • Respuestas naturales y coherentes');
        } else if (score >= 75) {
            console.log('🟡 El chatbot es bueno pero necesita ajustes');
            console.log('   • Revisar respuestas que fallaron');
            console.log('   • Mejorar detección de contexto');
            console.log('   • Refinar respuestas anti-alucinación');
        } else {
            console.log('🔴 El chatbot necesita trabajo importante');
            console.log('   • Revisar sistema RAG');
            console.log('   • Mejorar prompts');
            console.log('   • Revisar datos de entrenamiento');
        }

        console.log('\n' + '='.repeat(60));
    }
}

// Función helper para hacer peticiones
function makeRequest(url, data = null) {
    return new Promise((resolve, reject) => {
        const http = require('http');
        const https = require('https');
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

// Ejecutar tests manuales si se llama directamente
if (require.main === module) {
    const manualQA = new ManualQATests();
    manualQA.runCompleteManualQA().catch(console.error);
}

module.exports = ManualQATests;
