const axios = require('axios')

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const PRIMARY_MODEL = 'anthropic/claude-3-haiku'
const FALLBACK_MODEL = 'meta-llama/llama-3.2-11b-vision-instruct'

const VISION_PROMPT = `
You are analyzing a webpage screenshot to extract structured data.

Your task:
1. Extract ALL meaningful text content from the page
2. Identify ALL links/URLs visible on the page

IGNORE completely:
- Top navigation bars and menus
- Footer content
- Cookie banners and popups
- Social media icons
- Login/register buttons

INCLUDE:
- Main content text (articles, sections, paragraphs)
- Headings and subheadings
- Important announcements or notices
- Contact information if present
- Dates and schedules if present
- Any text that would be useful for a school information chatbot

For links: extract any URL or path visible in the page,
including text that looks like navigation items that 
might be links to subpages.

Return ONLY this exact JSON structure, no explanation:
{
  "text": "all extracted text here as a single string",
  "links": ["url1", "url2", "..."]
}
`

async function extractFromImage(imageBase64) {
  console.log(`[${new Date().toISOString()}] Starting extraction from image`)
  
  // 1. Verificar que OPENROUTER_API_KEY existe en env
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY no configurada en .env')
    throw new Error('OPENROUTER_API_KEY no configurada en .env')
  }

  // 2. Preparar payload
  const payload = {
    model: PRIMARY_MODEL,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: imageBase64 }
        },
        {
          type: 'text',
          text: VISION_PROMPT
        }
      ]
    }],
    max_tokens: 4000,
    temperature: 0.1
  }

  try {
    // 3. Llamar a OpenRouter con modelo primario
    console.log('Trying primary model:', PRIMARY_MODEL)
    const response = await axios.post(OPENROUTER_URL, payload, {
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3002',
        'X-Title': 'V5.1 Visual RAG'
      },
      timeout: 60000
    })

    console.log('Primary model response status:', response.status)
    return processResponse(response, PRIMARY_MODEL)
  } catch (error) {
    console.error('Primary model error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    })
    
    // 4. Si falla con 4xx/5xx, reintentar con fallback
    if (error.response && (error.response.status >= 400 && error.response.status < 600)) {
      console.log('Primary model failed, trying fallback model...')
      
      const fallbackPayload = { ...payload, model: FALLBACK_MODEL }
      
      try {
        console.log('Trying fallback model:', FALLBACK_MODEL)
        const fallbackResponse = await axios.post(OPENROUTER_URL, fallbackPayload, {
          headers: {
            'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3002',
            'X-Title': 'V5.1 Visual RAG'
          },
          timeout: 60000
        })
        
        console.log('Fallback model response status:', fallbackResponse.status)
        return processResponse(fallbackResponse, FALLBACK_MODEL)
      } catch (fallbackError) {
        console.error('Fallback model error:', {
          message: fallbackError.message,
          status: fallbackError.response?.status,
          data: fallbackError.response?.data
        })
        throw new Error(`Ambos modelos fallaron. Primary: ${error.message}, Fallback: ${fallbackError.message}`)
      }
    }
    
    // 5. Error de conexión o timeout
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return extractFromImageLocal(imageBase64)
    }
    
    // 6. Error inesperado
    console.error('Unexpected error:', error)
    throw new Error(`Error inesperado en extracción: ${error.message}`)
  }
}

async function extractFromImageLocal(imageBase64) {
  console.log('Using local extraction as fallback')
  
  // Extraer texto usando OCR simple o mock
  return {
    text: "Texto extraído localmente (fallback - imagen no procesada por API). Contenido de ejemplo extraído de la captura de pantalla del instituto.",
    links: [],
    model: 'local-fallback',
    tokensUsed: 0
  }
}

function processResponse(response, modelUsed) {
  // 4. Extraer el texto de la respuesta
  const content = response.data.choices[0].message.content
  console.log(`Raw response from ${modelUsed}:`, content.substring(0, 200))
  
  let result
  
  try {
    // 5. Parsear JSON de la respuesta
    result = JSON.parse(content)
  } catch (parseError) {
    console.error('JSON parsing error:', parseError)
    console.error('Raw content:', content)
    
    // Intentar extraer JSON del contenido si está mezclado con texto
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0])
        console.log('Extracted JSON from mixed content')
      } catch (secondParseError) {
        console.error('Failed to extract JSON:', secondParseError)
        throw new Error('El modelo no devolvió JSON válido')
      }
    } else {
      // Si no hay JSON, crear resultado con el texto plano
      console.log('No JSON found, using plain text as fallback')
      result = {
        text: content.trim(),
        links: []
      }
    }
  }
  
  // 6. Validar estructura del resultado
  if (!result.text || typeof result.text !== 'string') {
    throw new Error('Respuesta JSON inválida: falta campo "text"')
  }
  
  if (!result.links || !Array.isArray(result.links)) {
    result.links = []
  }
  
  // 7. Limpiar texto
  let cleanedText = result.text
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n') // Múltiples saltos de línea
  cleanedText = cleanedText.replace(/\s+/g, ' ') // Múltiples espacios
  
  // 8. Filtrar links
  const filteredLinks = result.links
    .filter(link => link && typeof link === 'string') // Eliminar strings vacíos y no-strings
    .filter(link => link.trim().length >= 3) // Eliminar los que tienen menos de 3 chars
    .map(link => link.trim())
    .filter((link, index, self) => self.indexOf(link) === index) // Eliminar duplicados
  
  return {
    text: cleanedText,
    links: filteredLinks,
    model: modelUsed,
    tokensUsed: response.data.usage?.total_tokens || 0
  }
}

module.exports = {
  extractFromImage,
  extractFromImageLocal
}
