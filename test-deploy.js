/**
 * Script de prueba de deploy para el chatbot
 */

const axios = require('axios');

async function testDeploy() {
    console.log('=== TEST DEPLOY CHATBOT IES JUAN DE LANUZA ===\n');
    
    const baseURL = 'http://localhost:3000';
    
    try {
        // 1. Test health endpoint
        console.log('1. Testeando /health endpoint...');
        const healthResponse = await axios.get(`${baseURL}/health`);
        console.log('Health check:', healthResponse.data);
        console.log('Health test: PASADO\n');
        
        // 2. Test login
        console.log('2. Testeando /auth/login endpoint...');
        const loginResponse = await axios.post(`${baseURL}/auth/login`, {
            email: 'test@test.com',
            password: 'test123'
        });
        console.log('Login response:', loginResponse.data);
        const token = loginResponse.data.token;
        console.log('Login test: PASADO\n');
        
        // 3. Test chat endpoint
        console.log('3. Testeando /chat endpoint...');
        const chatResponse = await axios.post(`${baseURL}/chat`, {
            message: 'Hola, qué información tienes sobre el instituto?'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Chat response:', chatResponse.data);
        console.log('Chat test: PASADO\n');
        
        // 4. Test chunks endpoint
        console.log('4. Testeando /chunks endpoint...');
        const chunksResponse = await axios.get(`${baseURL}/chunks`);
        console.log('Chunks count:', chunksResponse.data.data.length);
        console.log('Chunks test: PASADO\n');
        
        console.log('=== TODOS LOS TESTS PASADOS ===');
        console.log('Deploy exitoso! El chatbot está funcionando correctamente.');
        
        return true;
        
    } catch (error) {
        console.error('ERROR EN TEST DEPLOY:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        return false;
    }
}

// Ejecutar test
testDeploy().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});
