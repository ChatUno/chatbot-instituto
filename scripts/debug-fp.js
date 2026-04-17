const { semanticSearch } = require('./search.js');

async function debugFP() {
    console.log('🔍 Debug búsqueda FP:');
    
    const results = semanticSearch('¿Qué FP hay?', 5);
    console.log('Resultados:', results.length);
    results.forEach((r, i) => {
        console.log(`${i+1}. Score: ${r.score} | Source: ${r.source}`);
        console.log(`   Text: "${r.text}"`);
    });
}

debugFP();
