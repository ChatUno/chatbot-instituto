# V5.1 Visual RAG - Pipeline Completo

## **Pipeline Actual: Flujo End-to-End**

```
URL INPUT --> CAPTURA --> EXTRACIÓN --> CHUNKING --> REVISIÓN --> EXPORTACIÓN
    |           |          |          |          |           |
    v           v          v          v          v           v
  Frontend   Puppeteer   OpenRouter   Groq      Usuario     Storage
```

---

## **Paso 1: Captura de Página Web**

### **Frontend:**
- **Input:** URL del usuario
- **Validación:** Formato URL, no localhost
- **Request:** `POST /api/screenshot`
- **UI:** Loading states, feedback visual

### **Backend:**
- **Service:** `puppeteerService.js`
- **Process:**
  1. Validar URL
  2. Iniciar Puppeteer con flags de estabilidad
  3. Navegar a URL
  4. Tomar screenshot (PNG base64)
  5. Cerrar navegador
  6. Retornar imagen + metadatos

### **Output:**
```json
{
  "success": true,
  "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
  "metadata": {
    "url": "https://example.com",
    "capturedAt": "2026-04-18T10:30:00.000Z",
    "sizeBytes": 1234567
  }
}
```

### **Potenciales Mejoras:**
- [ ] Captura con diferentes resoluciones
- [ ] Captura de múltiples páginas (scroll)
- [ ] Detección de cambios en página
- [ ] Cache de screenshots
- [ ] Manejo de sitios bloqueados

---

## **Paso 2: Extracción de Texto con IA**

### **Frontend:**
- **Input:** Imagen base64 del paso 1
- **Request:** `POST /api/extract`
- **UI:** Preview de imagen, tabs para texto/links/metadata

### **Backend:**
- **Service:** `openrouterService.js`
- **Process:**
  1. Validar imagen base64
  2. Llamar a OpenRouter (Claude 3 Haiku)
  3. Fallback a Llama 3.2 Vision
  4. Extraer texto y enlaces
  5. Fallback local si APIs fallan
  6. Retornar texto + metadatos

### **AI Models:**
- **Primary:** `anthropic/claude-3-haiku`
- **Fallback:** `meta-llama/llama-3.2-11b-vision-instruct`
- **Local:** Simple OCR si APIs fallan

### **Output:**
```json
{
  "success": true,
  "data": {
    "text": "Texto extraído completo...",
    "links": ["https://example.com/page1", "https://example.com/page2"],
    "model": "anthropic/claude-3-haiku",
    "tokensUsed": 1234
  }
}
```

### **Potenciales Mejoras:**
- [ ] Extracción de tablas y formularios
- [ ] Detección de idioma automáticamente
- [ ] Extracción de imágenes con descripciones
- [ ] OCR mejorado para imágenes complejas
- [ ] Clasificación de contenido

---

## **Paso 3: Generación de Chunks Semánticos**

### **Frontend:**
- **Input:** Texto extraído + URL original
- **Request:** `POST /api/chunk`
- **UI:** Controles de tamaño/solapamiento, preview de chunks

### **Backend:**
- **Service:** `groqService.js`
- **Process:**
  1. Validar longitud mínima de texto (10 palabras)
  2. Llamar a Groq (Llama 3.3 70B)
  3. Prompt para chunking semántico
  4. Parsear respuesta JSON
  5. Fallback local si API falla
  6. Asignar metadatos a chunks

### **AI Prompt:**
```
Analiza el siguiente texto y divídelo en chunks semánticos coherentes.
Cada chunk debe:
- Tener entre 50-300 palabras
- Ser semánticamente coherente
- Incluir categoría (general, horario, matricula, etc.)
- Tener un score de calidad (0-100)

Texto: {TEXT}
URL: {URL}
```

### **Output:**
```json
{
  "success": true,
  "data": {
    "chunks": [
      {
        "text": "Primer chunk coherente...",
        "category": "general",
        "quality_score": 85,
        "source_url": "https://example.com",
        "word_count": 97,
        "created_at": "2026-04-18T10:30:00.000Z"
      }
    ],
    "totalChunks": 3,
    "sourceUrl": "https://example.com"
  }
}
```

### **Potenciales Mejoras:**
- [ ] Chunking adaptativo por tipo de contenido
- [ ] Detección automática de categorías
- [ ] Chunking con contexto cruzado
- [ ] Mejor scoring de calidad
- [ ] Deduplicación semántica

---

## **Paso 4: Revisión y Edición Humana**

### **Frontend:**
- **Input:** Chunks generados
- **Actions:**
  - Aprobar/rechazar chunks individuales
  - Editar texto de chunks
  - Seleccionar múltiples chunks
  - Bulk actions
- **UI:** Cards interactivos, estadísticas en tiempo real

### **Backend:**
- **State Management:** Frontend maneja estado de aprobación
- **Validation:** Frontend valida antes de exportar
- **No API calls:** Solo en exportación final

### **Features:**
- **Individual Actions:** Aprobar, rechazar, editar
- **Bulk Actions:** Seleccionar todo, aprobar/rechazar masivo
- **Filters:** Por estado (pending, approved, rejected)
- **Statistics:** Contadores en tiempo real
- **Quality Indicators:** Scores visuales por calidad

### **Potenciales Mejoras:**
- [ ] Comparación side-by-side de chunks
- [ ] Merge de chunks similares
- [ ] Split de chunks largos
- [ ] Auto-suggestion de categorías
- [ ] Historial de cambios

---

## **Paso 5: Exportación a Base de Datos**

### **Frontend:**
- **Input:** Chunks aprobados
- **Request:** `POST /api/export`
- **UI:** Resumen de exportación, confirmación modal

### **Backend:**
- **Service:** `storageService.js`
- **Process:**
  1. Validar formato de chunks
  2. Crear backup automático
  3. Leer chunks existentes
  4. Transformar chunks a formato chatbot
  5. Merge y deduplicación
  6. Guardar en `chunks.json`
  7. Retornar resultados

### **Transformación:**
```javascript
{
  // Input format
  "text": "Chunk aprobado",
  "category": "general", 
  "quality_score": 85
}

// Output format
{
  "id": 42,
  "text": "Chunk aprobado",
  "source": "ingestion-v51",
  "quality": "good",
  "score": 0.85,
  "category": "general",
  "lastOptimized": "2026-04-18T10:30:00.000Z"
}
```

### **Backup System:**
- **Location:** `data/backups/chunks-{timestamp}.json`
- **Frequency:** Antes de cada exportación
- **Format:** JSON completo del estado anterior

### **Deduplication:**
- **Method:** Hash de primeros 120 caracteres
- **Logic:** Prevenir duplicados exactos
- **Result:** Mantener chunk más reciente

### **Output:**
```json
{
  "success": true,
  "data": {
    "exported": 3,
    "totalAfter": 42,
    "backupFile": "chunks-2026-04-18T10-30-00-000Z.json",
    "skippedDuplicates": 1
  }
}
```

### **Potenciales Mejoras:**
- [ ] Exportación a múltiples formatos (JSON, CSV, SQLite)
- [ ] Versioning de chunks
- [ ] Indexación para búsqueda rápida
- [ ] Exportación incremental
- [ ] Sincronización con base de datos externa

---

## **Servicios de Apoyo**

### **API Status:**
- **Endpoint:** `GET /api/export/status`
- **Purpose:** Estado actual de la base de datos
- **Data:** Total chunks, última modificación

### **Backups:**
- **Endpoint:** `GET /api/export/backups`
- **Purpose:** Listar backups disponibles
- **Data:** Array de nombres de archivos backup

### **Error Handling:**
- **Global:** Try-catch en todos los endpoints
- **Fallback:** Procesamiento local si APIs fallan
- **Logging:** Consola con timestamps
- **Responses:** Formato consistente de error

---

## **Data Flow Architecture**

```
Frontend State Management:
  - Local state en JavaScript
  - No persistencia entre sesiones
  - Reset después de exportación

Backend Storage:
  - chunks.json: Base de datos principal
  - backups/: Historial de backups
  - Temporal: Solo durante procesamiento

API Communication:
  - RESTful endpoints
  - JSON request/response
  - CORS habilitado
  - Error handling consistente
```

---

## **Current Performance Metrics**

### **Test Results:**
- **Screenshot:** 1.1MB capture in ~3s
- **Extraction:** 519 chars, 1595 tokens
- **Chunking:** 2-3 chunks, 60-70% quality
- **Export:** 39 total chunks in database
- **Backups:** 6 historical backups

### **Bottlenecks Identificados:**
1. **Puppeteer startup:** ~2s initialization
2. **API calls:** Latencia de OpenRouter/Groq
3. **Large images:** Base64 encoding overhead
4. **File I/O:** Synchronous JSON operations

---

## **Next Steps for Robustness**

### **Priority 1: Error Resilience**
- Retry mechanisms for API calls
- Circuit breakers for external services
- Graceful degradation modes
- Comprehensive error logging

### **Priority 2: Performance**
- Async file operations
- Image compression
- Response caching
- Parallel processing

### **Priority 3: Scalability**
- Database migration (JSON -> SQLite/PostgreSQL)
- Queue system for batch processing
- Worker threads for heavy operations
- API rate limiting

### **Priority 4: Features**
- Multi-language support
- Advanced chunking algorithms
- Real-time collaboration
- Analytics and monitoring

---

**Este análisis muestra que el pipeline actual es sólido pero tiene oportunidades significativas de mejora en robustez, performance y escalabilidad.**
