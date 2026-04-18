# V5.1 Visual RAG - Sistema de Ingestión Inteligente

Sistema de ingesta visual para RAG (Retrieval-Augmented Generation) del IES Juan de Lanuza.

## Características

- **Captura de páginas web** usando Puppeteer
- **Extracción de texto con IA** usando OpenRouter (Claude 3 Haiku + Llama 3.2 Vision)
- **Chunking inteligente** usando Groq (Llama 3.3 70B)
- **Interfaz web profesional** con validación y edición de chunks
- **Exportación segura** con backups automáticos

## Instalación

1. Copiar `.env.example` a `.env` y configurar las API keys:
   ```bash
   cp .env.example .env
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar servidor:
   ```bash
   npm start
   ```

4. Abrir http://localhost:3002

## Variables de Entorno

```env
GROQ_API_KEY=your_groq_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
PORT=3002
NODE_ENV=development
```

## Arquitectura

```
v5.1/
- client/                 # Frontend
  - index.html           # Interfaz principal
  - app.js               # Lógica del cliente
  - styles.css           # Estilos
  
- server/                # Backend
  - index.js             # Servidor Express
  - routes/              # Endpoints API
    - screenshot.js      # Captura de páginas
    - extract.js         # Extracción de texto
    - chunk.js           # Generación de chunks
    - export.js         # Exportación a DB
  - services/            # Lógica de negocio
    - puppeteerService.js    # Captura de screenshots
    - openrouterService.js   # Extracción con IA
    - groqService.js         # Chunking inteligente
    - storageService.js      # Gestión de datos

- data/                  # Almacenamiento
  - chunks.json          # Base de datos de chunks
  - backups/             # Backups automáticos
```

## API Endpoints

### POST /api/screenshot
Captura screenshot de una página web.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "metadata": {
    "url": "https://example.com",
    "capturedAt": "2026-04-18T10:30:00.000Z",
    "sizeBytes": 123456
  }
}
```

### POST /api/extract
Extrae texto y enlaces de una imagen usando IA.

**Request:**
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Texto extraído de la imagen",
    "links": ["https://example.com/page1", "https://example.com/page2"],
    "model": "anthropic/claude-3-haiku",
    "tokensUsed": 1234
  }
}
```

### POST /api/chunk
Genera chunks semánticos del texto.

**Request:**
```json
{
  "text": "Texto largo para procesar...",
  "sourceUrl": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chunks": [
      {
        "text": "Primer chunk",
        "category": "general",
        "quality_score": 85,
        "source_url": "https://example.com",
        "word_count": 45,
        "created_at": "2026-04-18T10:30:00.000Z"
      }
    ],
    "totalChunks": 1,
    "sourceUrl": "https://example.com"
  }
}
```

### POST /api/export
Exporta chunks aprobados a la base de datos.

**Request:**
```json
{
  "chunks": [
    {
      "text": "Chunk aprobado",
      "category": "general",
      "quality_score": 85
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exported": 1,
    "totalAfter": 10,
    "backupFile": "chunks-2026-04-18T10-30-00-000Z.json",
    "skippedDuplicates": 0
  }
}
```

## Flujo de Trabajo

1. **Captura**: Ingresa URL y captura screenshot
2. **Extracción**: IA extrae texto y enlaces del screenshot
3. **Chunking**: IA genera chunks semánticos con categorías
4. **Revisión**: Aprobar/rechazar/editar chunks manualmente
5. **Exportación**: Guardar chunks aprobados en la base de datos

## Manejo de Errores

- **Fallback local**: Si las APIs fallan, usa procesamiento local
- **Reintentos automáticos**: Para errores temporales
- **Logging detallado**: Para depuración
- **Backups automáticos**: Antes de cada exportación

## Mejoras Implementadas

- Dependencias actualizadas y completas
- Manejo robusto de errores con fallbacks
- Iconos SVG inline (sin dependencias externas)
- Logging mejorado para depuración
- Validación mejorada en todos los endpoints
- UX optimizada con retroalimentación clara

## Licencia

© 2026 IES Juan de Lanuza - Sistema Visual RAG v5.1
