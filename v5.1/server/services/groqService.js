const axios = require('axios')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const CHUNK_PROMPT = `
You are a text chunking assistant for a RAG system used by
a Spanish educational institution (IES Juan de Lanuza).

Split the following text into semantic chunks following
these rules:

CHUNKING RULES:
- Each chunk: 50 to 300 words
- Each chunk must be self-contained and meaningful
- Split at natural semantic boundaries (topics, sections)
- Never split mid-sentence
- If a section is too long, split it into multiple chunks
- If a section is too short (<50 words), merge with adjacent

METADATA RULES per chunk:
- category: one of these exact values:
  "general" | "horario" | "matricula" | "oferta" |
  "contacto" | "actividades" | "calendario" | "servicios"
  Choose based on content. Default: "general"
- quality_score: integer 0-100 based on:
  * 0-40: very short, navigation text, or low info density
  * 41-70: acceptable content, some useful info
  * 71-90: good content, clear and informative
  * 91-100: excellent, specific facts, dates, or data

Return ONLY a valid JSON array, no explanation:
[
  {
    "text": "chunk text here",
    "category": "general",
    "quality_score": 85
  }
]
`

async function chunkText(text, sourceUrl) {
  console.log(`[Groq] Starting chunking for URL: ${sourceUrl}, text length: ${text.length}`);
  
  // 1. Verificar GROQ_API_KEY en env
  if (!process.env.GROQ_API_KEY) {
    console.error('[Groq] GROQ_API_KEY not configured');
    throw new Error('GROQ_API_KEY no configurada en .env')
  }

  // 2. Si text tiene menos de 50 palabras
  const wordCount = text.trim().split(/\s+/).length
  if (wordCount < 50) {
    return [{
      text: text.trim(),
      category: 'general',
      quality_score: 30
    }]
  }

  // 3. Si text tiene más de 8000 palabras, dividir en bloques
  let chunks = []
  if (wordCount > 8000) {
    const words = text.split(/\s+/)
    const blockSize = 4000
    const blocks = []
    
    for (let i = 0; i < words.length; i += blockSize) {
      blocks.push(words.slice(i, i + blockSize).join(' '))
    }
    
    for (const block of blocks) {
      const blockChunks = await processBlock(block, sourceUrl)
      chunks = chunks.concat(blockChunks)
    }
  } else {
    chunks = await processBlock(text, sourceUrl)
  }

  return chunks
}

async function processBlock(text, sourceUrl) {
  // 4. Construir user message
  const userMessage = `Source URL: ${sourceUrl}\n\nText to chunk:\n${text}`

  try {
    // 5. Llamar a Groq
    const response = await axios.post(GROQ_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: CHUNK_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 4000,
      temperature: 0.1
    }, {
      headers: {
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    // 6. Extraer contenido
    const content = response.data.choices[0].message.content

    // 7. Parsear JSON
    let chunks
    try {
      chunks = JSON.parse(content)
    } catch (parseError) {
      // Intentar extraer array con regex
      const arrayMatch = content.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        try {
          chunks = JSON.parse(arrayMatch[0])
        } catch {
          // Si sigue fallando, devolver chunk único
          return [{
            text: text.trim(),
            category: 'general',
            quality_score: 50,
            source_url: sourceUrl,
            word_count: text.trim().split(/\s+/).length,
            created_at: new Date().toISOString()
          }]
        }
      } else {
        // Devolver chunk único
        return [{
          text: text.trim(),
          category: 'general',
          quality_score: 50,
          source_url: sourceUrl,
          word_count: text.trim().split(/\s+/).length,
          created_at: new Date().toISOString()
        }]
      }
    }

    // 8. Validar cada chunk
    const validChunks = chunks
      .filter(chunk => chunk.text && typeof chunk.text === 'string')
      .filter(chunk => chunk.text.trim() !== '')
      .filter(chunk => chunk.text.trim().split(/\s+/).length >= 10)
      .filter(chunk => chunk.category && typeof chunk.category === 'string')
      .filter(chunk => typeof chunk.quality_score === 'number' && chunk.quality_score >= 0 && chunk.quality_score <= 100)

    // 9. Añadir metadata a cada chunk
    return validChunks.map(chunk => ({
      ...chunk,
      source_url: sourceUrl,
      word_count: chunk.text.split(/\s+/).length,
      created_at: new Date().toISOString()
    }))

  } catch (error) {
    console.error('[Groq] API Error:', error.message);
    
    // Fallback to simple local chunking if API fails
    console.log('[Groq] Using local fallback chunking');
    return createFallbackChunks(text, sourceUrl);
  }
}

function createFallbackChunks(text, sourceUrl) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  let wordCount = 0;
  
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    
    if (wordCount + sentenceWords > 300 && currentChunk.trim()) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        category: 'general',
        quality_score: 60,
        source_url: sourceUrl,
        word_count: currentChunk.trim().split(/\s+/).length,
        created_at: new Date().toISOString()
      });
      
      currentChunk = sentence;
      wordCount = sentenceWords;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
      wordCount += sentenceWords;
    }
  }
  
  // Add last chunk if exists
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      category: 'general',
      quality_score: 60,
      source_url: sourceUrl,
      word_count: currentChunk.trim().split(/\s+/).length,
      created_at: new Date().toISOString()
    });
  }
  
  return chunks.length > 0 ? chunks : [{
    text: text.trim(),
    category: 'general',
    quality_score: 50,
    source_url: sourceUrl,
    word_count: text.trim().split(/\s+/).length,
    created_at: new Date().toISOString()
  }];
}

module.exports = { chunkText }
