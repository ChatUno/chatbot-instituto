const http = require('http');

const longText = `
El Instituto de Educación Secundaria Juan de Lanuza es un centro educativo público ubicado en Zaragoza, España. Ofrece una educación de calidad a estudiantes de secundaria y bachillerato, con un enfoque en la excelencia académica y el desarrollo personal de los alumnos.

El centro cuenta con instalaciones modernas que incluyen laboratorios de ciencias equipados con la última tecnología, aulas informáticas con acceso a internet de alta velocidad, una biblioteca con más de 10,000 volúmenes, y instalaciones deportivas que incluyen pistas de atletismo, campos de fútbol y baloncesto, y un pabellón cubierto.

La oferta educativa del IES Juan de Lanuza incluye diversas especialidades en bachillerato como ciencias, letras y artes. Además, el centro ofrece programas de formación profesional en áreas como informática, administración y gestión, y electricidad y electrónica.

El horario del centro es de lunes a viernes de 8:00 a 14:30 horas. Las actividades extraescolares comienzan a partir de las 16:00 e incluyen deportes, música, teatro y clubes de debate. Estas actividades están diseñadas para complementar la formación académica y fomentar el desarrollo de habilidades sociales y creativas.

Para el proceso de matriculación, los padres deben presentar la documentación requerida en el mes de junio. Los requisitos incluyen el certificado de estudios anteriores, el DNI del estudiante y padres, y justificante de domicilio. Las plazas son limitadas y se asignan según los criterios establecidos por el Departamento de Educación del Gobierno de Aragón.

El centro también ofrece servicios de orientación educativa y psicopedagógica para ayudar a los estudiantes en su desarrollo académico y personal. Hay un equipo de profesionales especializados que proporcionan apoyo tanto a nivel individual como grupal.

Durante el año escolar, se organizan diversas actividades culturales y deportivas como la semana cultural, el día de la ciencia, campeonatos deportivos intercentros y excursiones educativas. Estas actividades enriquecen la experiencia educativa y promueven los valores de trabajo en equipo y respeto.

El calendario escolar sigue las directrices del Departamento de Educación, con vacaciones de Navidad, Semana Santa y verano. Además, hay días festivos locales y autonómicos que se comunican con antelación a las familias a través del portal web del centro y comunicados oficiales.
`;

const testData = {
  text: longText.trim(),
  sourceUrl: "https://iesjuandelanuza.catedu.es/"
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/chunk',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n=== CHECK 4 - Quality Results ===');
      console.log('Success:', response.success);
      
      if (response.success) {
        const chunks = response.data.chunks;
        console.log('Total chunks:', chunks.length);
        
        // Quality validations
        let allValid = true;
        let hasHighQuality = false;
        let emptyTextCount = 0;
        let shortChunkCount = 0;
        
        chunks.forEach((chunk, index) => {
          console.log(`\nChunk ${index + 1}:`);
          console.log(`  Word count: ${chunk.word_count}`);
          console.log(`  Quality score: ${chunk.quality_score}`);
          console.log(`  Category: ${chunk.category}`);
          console.log(`  Text length: ${chunk.text.length} chars`);
          
          // Validations
          if (chunk.word_count < 10) {
            shortChunkCount++;
            allValid = false;
            console.log(`  ERROR: Word count < 10`);
          }
          
          if (chunk.text.trim() === '') {
            emptyTextCount++;
            allValid = false;
            console.log(`  ERROR: Empty text`);
          }
          
          if (chunk.quality_score >= 70) {
            hasHighQuality = true;
          }
        });
        
        console.log('\n=== Quality Summary ===');
        console.log(`All chunks have >= 10 words: ${allValid}`);
        console.log(`At least one chunk has quality >= 70: ${hasHighQuality}`);
        console.log(`Empty text chunks: ${emptyTextCount}`);
        console.log(`Chunks with < 10 words: ${shortChunkCount}`);
        
        if (allValid && hasHighQuality && emptyTextCount === 0) {
          console.log('\nCHECK 4: PASSED');
        } else {
          console.log('\nCHECK 4: FAILED');
        }
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
