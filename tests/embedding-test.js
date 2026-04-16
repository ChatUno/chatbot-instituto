// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const { getEmbedding } = require('../services/embeddings');

/**
 * Sistema de validación para el módulo de embeddings
 */
class EmbeddingValidator {
    constructor() {
        this.results = {
            connection: null,
            format: null,
            consistency: null,
            errorHandling: null,
            overall: null
        };
    }

    async runAllTests() {
        console.log('🧪 INICIANDO VALIDACIÓN DE EMBEDDINGS');
        console.log('=====================================');

        try {
            await this.testConnection();
            await this.testVectorFormat();
            await this.testConsistency();
            await this.testErrorHandling();
            
            this.calculateOverallResult();
            this.printResults();
            
            return this.results;
        } catch (error) {
            console.error('❌ Error en validación:', error.message);
            this.results.overall = 'FAIL';
            this.printResults();
            return this.results;
        }
    }

    async testConnection() {
        console.log('📡 TEST 1: CONEXIÓN A API');
        
        try {
            const embedding = await getEmbedding("hola mundo");
            
            if (embedding && Array.isArray(embedding) && embedding.length > 0) {
                this.results.connection = 'PASS';
                console.log('✅ Conexión exitosa');
                console.log(`📊 Tamaño del vector: ${embedding.length}`);
            } else {
                this.results.connection = 'FAIL';
                console.log('❌ Conexión fallida - no se recibió vector válido');
            }
        } catch (error) {
            this.results.connection = 'FAIL';
            console.log('❌ Error de conexión:', error.message);
        }
    }

    async testVectorFormat() {
        console.log('📊 TEST 2: FORMATO DE VECTOR');
        
        try {
            const embedding = await getEmbedding("test format");
            
            if (this.isValidVector(embedding)) {
                this.results.format = 'PASS';
                console.log('✅ Formato de vector válido');
                console.log(`📋 Tipo: ${typeof embedding}`);
                console.log(`📋 Longitud: ${embedding.length}`);
                console.log(`📋 Muestra: [${embedding.slice(0, 3).join(', ')}...]`);
            } else {
                this.results.format = 'FAIL';
                console.log('❌ Formato de vector inválido');
            }
        } catch (error) {
            this.results.format = 'FAIL';
            console.log('❌ Error en formato:', error.message);
        }
    }

    async testConsistency() {
        console.log('🔄 TEST 3: CONSISTENCIA ENTRE LLAMADAS');
        
        try {
            const text1 = "texto de prueba consistencia";
            const text2 = "otro texto diferente";
            
            const embedding1 = await getEmbedding(text1);
            const embedding2 = await getEmbedding(text2);
            
            if (this.isValidVector(embedding1) && this.isValidVector(embedding2)) {
                // Calcular similitud entre vectores diferentes
                const similarity = this.calculateSimilarity(embedding1, embedding2);
                
                if (similarity < 0.9) { // Deben ser diferentes
                    this.results.consistency = 'PASS';
                    console.log('✅ Consistencia válida');
                    console.log(`📊 Similitud entre textos diferentes: ${similarity.toFixed(4)} (debe ser < 0.9)`);
                } else {
                    this.results.consistency = 'FAIL';
                    console.log('❌ Consistencia inválida - vectores demasiado similares');
                }
            } else {
                this.results.consistency = 'FAIL';
                console.log('❌ No se pudieron generar vectores para consistencia');
            }
        } catch (error) {
            this.results.consistency = 'FAIL';
            console.log('❌ Error en consistencia:', error.message);
        }
    }

    async testErrorHandling() {
        console.log('⚠️ TEST 4: MANEJO DE ERRORES');
        
        const testCases = [
            { name: "Input vacío", input: "" },
            { name: "Input muy largo", input: "a".repeat(1000) },
            { name: "Input con caracteres especiales", input: "texto con ñáéíóú y símbolos !@#$%" }
        ];

        let passedTests = 0;
        
        for (const testCase of testCases) {
            try {
                const embedding = await getEmbedding(testCase.input);
                
                if (this.isValidVector(embedding)) {
                    passedTests++;
                    console.log(`✅ ${testCase.name}: Manejado correctamente`);
                } else {
                    console.log(`❌ ${testCase.name}: No se generó vector válido`);
                }
            } catch (error) {
                console.log(`⚠️ ${testCase.name}: Error manejado - ${error.message}`);
                // Error esperado para algunos casos
                if (testCase.name !== "Input vacío") {
                    passedTests++;
                }
            }
        }

        this.results.errorHandling = passedTests === testCases.length ? 'PASS' : 'FAIL';
        console.log(`📊 Tests de error manejados: ${passedTests}/${testCases.length}`);
    }

    isValidVector(vector) {
        return vector && 
               Array.isArray(vector) && 
               vector.length > 0 && 
               vector.every(val => typeof val === 'number' && !isNaN(val));
    }

    calculateSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    calculateOverallResult() {
        const passCount = Object.values(this.results).filter(result => result === 'PASS').length;
        const totalTests = Object.keys(this.results).length;
        
        if (passCount === totalTests) {
            this.results.overall = 'PASS';
        } else {
            this.results.overall = 'FAIL';
        }
    }

    printResults() {
        console.log('\n📋 RESULTADOS DE VALIDACIÓN');
        console.log('=====================================');
        
        console.log(`🔗 Conexión API: ${this.results.connection}`);
        console.log(`📊 Formato Vector: ${this.results.format}`);
        console.log(`🔄 Consistencia: ${this.results.consistency}`);
        console.log(`⚠️ Manejo Errores: ${this.results.errorHandling}`);
        console.log(`🎯 Resultado Final: ${this.results.overall}`);
        
        console.log('\n🚨 CRITERIO DE ÉXITO');
        console.log('✅ Solo pasa si TODOS los tests son PASS');
        console.log('✅ Sistema estable para RAG');
        console.log('✅ Sin crashes ni errores críticos');
        
        if (this.results.overall === 'PASS') {
            console.log('\n🎉 EMBEDDINGS LISTOS PARA PRODUCCIÓN');
        } else {
            console.log('\n⚠️ EMBEDDINGS REQUIEREN ATENCIÓN');
        }
    }
}

// Ejecutar validación si se llama directamente
if (require.main === module) {
    const validator = new EmbeddingValidator();
    validator.runAllTests().then(results => {
        process.exit(results.overall === 'PASS' ? 0 : 1);
    });
}

module.exports = EmbeddingValidator;
