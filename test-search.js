const { semanticSearch } = require('./search');

async function testSearch() {
  console.log('=== PROBANDO BÚSQUEDA DIRECTA ===\n');
  
  // Probar búsqueda de FP
  console.log('1. Buscando "qué fp hay":');
  const fpResults = semanticSearch('qué fp hay', 3);
  console.log('Resultados:', fpResults.length);
  fpResults.forEach((result, i) => {
    console.log(`  ${i+1}. [${result.source}] Score: ${result.score} - ${result.text.substring(0, 80)}...`);
  });
  
  console.log('\n2. Buscando "horarios":');
  const horariosResults = semanticSearch('horarios', 3);
  console.log('Resultados:', horariosResults.length);
  horariosResults.forEach((result, i) => {
    console.log(`  ${i+1}. [${result.source}] Score: ${result.score} - ${result.text.substring(0, 80)}...`);
  });
  
  console.log('\n3. Buscando "formación profesional":');
  const formacionResults = semanticSearch('formación profesional', 3);
  console.log('Resultados:', formacionResults.length);
  formacionResults.forEach((result, i) => {
    console.log(`  ${i+1}. [${result.source}] Score: ${result.score} - ${result.text.substring(0, 80)}...`);
  });
}

testSearch();
