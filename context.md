# Chatbot IES Juan de Lanuza - Documentación Técnica

## 1. Visión general del proyecto

Este sistema es un chatbot de asistencia para el IES Juan de Lanuza, un instituto de educación secundaria público ubicado en Borja (Zaragoza), España.

**Objetivo funcional:** Proporcionar respuestas precisas sobre la oferta educativa, servicios, contacto e información general del centro utilizando únicamente la información disponible en los documentos del instituto.

**Tipo de arquitectura:** Chatbot RAG (Retrieval-Augmented Generation) local-first que procesa preguntas del usuario, busca información relevante en chunks pre-procesados y genera respuestas contextualizadas con reglas estrictas anti-alucinación.

## 2. Estructura del proyecto

```
chatbot-ies-juan-de-lanuza/
.
admin/                           # Panel de administración
  admin.css
  admin.js
  index.html
data/                           # Base de conocimiento
  dinamico/                     # Datos dinámicos
    avisos.txt
    calendario.txt
    faq.txt
    noticias.txt
  estatico/                     # Datos estáticos
    centro.txt
    oferta_educativa.txt
    programas.txt
    servicios.txt
  chunks.json                   # Chunks procesados para RAG
frontend/                       # Interfaz de usuario
  app.js                        # Lógica del chat
  index.html                    # Página principal
  style.css                     # Estilos
qa-evaluator/                   # Sistema de evaluación de calidad
  qa_evaluator.js
  qa_report.js
  qa_runner.js
  test_cases.js
tests/                          # Tests unitarios
  eval_chatbot.js
logs/                           # Logs de observabilidad
  chatbot-observability.json
  qa-report-2026-04-16.txt
[archivos principales]
chatbot-backend.js              # Lógica principal del chatbot
server.js                       # Servidor Express
prompt-system.js                # Sistema de prompts anti-alucinación
memory-system.js                # Memoria conversacional
search.js                       # Sistema de búsqueda RAG
embedding.js                    # Procesamiento de texto
ai-client.js                    # Cliente para API de IA
response-polishing.js           # Sistema de pulido de respuestas
observability.js                # Sistema de logging
package.json                    # Dependencias
```

## 3. Backend

### Arquitectura del endpoint `/chat`

El servidor Express (`server.js`) implementa el endpoint principal:

```javascript
POST /chat
Body: { "message": "pregunta del usuario" }
Response: { "response": "respuesta del chatbot" }
```

### Pipeline completo de procesamiento

1. **Input** - Recepción de pregunta del usuario
2. **Preprocessing** - Clasificación de intención y detección de saludos
3. **Ranking** - Búsqueda semántica en chunks (RAG) o fallback a archivos
4. **Chunks** - Selección de los 3 chunks más relevantes
5. **Prompt** - Construcción con sistema anti-alucinación y memoria
6. **LLM** - Generación de respuesta vía API externa
7. **Response** - Validación, pulido y entrega al usuario

### Flujo detallado

```javascript
handleUserQuery(question) {
  1. handleSimpleGreetings() -> respuesta directa si es saludo
  2. semanticSearch(question, 3) -> búsqueda en chunks
  3. Si hay resultados:
     - buildContextFromResults()
     - createDefinitivePromptSystem()
     - getAIResponse()
     - validateAntiHallucination()
     - ResponsePolishingSystem.polish()
  4. Si no hay resultados (fallback):
     - classifyQuestion() -> categorías por palabras clave
     - getRelevantFiles() -> archivos según categoría
     - readFiles() -> concatenación con límite 3000 chars
     - mismo flujo de validación y pulido
  5. MemoryManager.addExchange() -> guardar en memoria
  6. ObservabilityManager.logRequest() -> logging
}
```

## 4. Sistema de chunks (RAG)

### Estructura de chunks.json

```json
[
  {
    "id": 1,
    "text": "IES Juan de Lanuza es un Instituto de Educación Secundaria público",
    "source": "centro"
  },
  {
    "id": 2,
    "text": "Ubicación: C/ Capuchinos, 1, Borja (Zaragoza), España",
    "source": "centro"
  }
]
```

### Características del sistema

- **Fuente de conocimiento:** `chunks.json` como base de datos principal
- **Estructura de chunk:** `id` (numérico), `text` (contenido), `source` (origen)
- **Carga:** `loadChunks()` lee el archivo JSON al inicio
- **Ranking:** Sistema BM25-lite implementado en `embedding.js`
- **Selección:** Top 3 chunks más relevantes por score de similitud

### Sistema de búsqueda

```javascript
semanticSearch(question, topK = 3) {
  1. loadChunks() -> cargar todos los chunks
  2. simpleSearch(question, chunks) -> BM25-lite scoring
  3. slice(0, topK) -> retornar top resultados
}
```

## 5. Sistema de prompt

### Sistema definitivo anti-alucinación

El sistema (`prompt-system.js`) implementa reglas estrictas:

```javascript
buildDefinitivePrompt(context, userQuery, memory) {
  REGLAS CRÍTICAS:
  - Solo puedes usar la información del CONTEXTO
  - Si la respuesta no está en el contexto, di: "No dispongo de esa información"
  - No inventes datos bajo ninguna circunstancia
  - No uses conocimiento externo
  - No hagas suposiciones
}
```

### Comportamiento sin contexto relevante

```javascript
if (!hasRelevantContext(context, query)) {
  // Prompt forzado a respuesta negativa controlada
  "Solo puedes responder: 'No dispongo de esa información.'"
}
```

### Validación de respuestas

```javascript
validateAntiHallucination(response, context) {
  // Detecta entidades sospechosas (números, nombres propios)
  // Verifica contra lista de palabras legítimas
  // Retorna isValid + correctedResponse si es necesario
}
```

## 6. Memoria conversacional

### Implementación

```javascript
class ConversationMemory(maxExchanges = 5) {
  exchanges[] // Array de {user, bot, timestamp}
}
```

### Características

- **Límite de memoria:** 5 intercambios recientes
- **Almacenamiento:** En memoria volátil (no persistente entre sesiones)
- **Formateo:** `[MEMORIA DE CONVERSACIÓN]\nU: pregunta\nB: respuesta`
- **Inyección:** Se añade al prompt entre contexto y pregunta actual

### Gestión de memoria

```javascript
MemoryManager.addExchange(question, response) // Guardar
MemoryManager.getMemory() // Obtener formateada
MemoryManager.clearMemory() // Limpiar todo
MemoryManager.getStats() // Estadísticas de uso
```

## 7. Frontend

### Comunicación con backend

**Endpoint principal:** `POST https://chatbot-instituto-production.up.railway.app/chat`

```javascript
fetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userMessage })
})
```

### Flujo de usuario

1. **Input:** Usuario escribe pregunta en textarea
2. **Validación:** Botón enviar habilitado solo con texto
3. **Envío:** POST a backend con timeout de 30s
4. **Indicador:** Muestra "Escribiendo..." durante procesamiento
5. **Respuesta:** Añade mensaje del bot con avatar
6. **Scroll:** Auto-scroll al final de la conversación

### Características UX

- Enter para enviar, Shift+Enter para nueva línea
- Auto-resize del textarea (máx 120px)
- Indicador de typing animado
- Manejo de errores con mensajes específicos
- Prevención de navegación accidental

## 8. Testing

### Scripts de test existentes

- **test-search.js** - Valida sistema de búsqueda RAG
- **test-memory.js** - Prueba memoria conversacional
- **test-responses.js** - Validación de respuestas
- **test-normalize.js** - Normalización de texto
- **eval_chatbot.js** - Evaluación integral del chatbot

### Sistema QA

- **qa-evaluator/** - Sistema completo de evaluación de calidad
- **qa-runner.js** - Ejecutor de tests automatizados
- **qa_report.js** - Generación de informes de calidad

### Validaciones

- **Context testing:** Verifica relevancia de chunks recuperados
- **Memory testing:** Prueba continuidad conversacional
- **Prompt testing:** Valida reglas anti-alucinación
- **Response testing:** Comprueba calidad y precisión de respuestas

## 9. Limitaciones actuales

### Restricciones de arquitectura

- **Base de datos local:** No hay base de datos externa, todo opera sobre archivos JSON
- **Persistencia:** Memoria conversacional no persistente entre sesiones
- **Escalabilidad:** Sistema local-first sin capacidades SaaS
- **Ranking simple:** BM25-lite básico sin embeddings vectoriales complejos

### Limitaciones técnicas

- **Tamaño de contexto:** Límite de 3000 caracteres en fallback
- **Chunks fijos:** Sistema depende de chunks.json pre-procesados
- **API externa:** Dependencia de servicio de IA externo (GROQ)
- **Sin actualización automática:** Los datos dinámicos requieren actualización manual

### Posibles mejoras

- Sistema de embeddings vectoriales para mejor ranking
- Base de datos persistente para memoria y chunks
- Sistema de actualización automática de datos dinámicos
- Cacheado inteligente de respuestas frecuentes

## 10. Estado del proyecto

### Nivel actual del sistema

**Versión:** V3 estable con sistema definitivo de prompts

**Componentes implementados:**
- Backend Express con endpoints completos
- Sistema RAG funcional con chunks
- Frontend moderno y responsivo
- Sistema de memoria conversacional
- Validación anti-alucinación robusta
- Sistema de observabilidad completo
- Suite de tests automatizados

### Estado de producción

**Listo para producción:** Sí, con las siguientes consideraciones:

**Fortalezas:**
- Sistema anti-alucinación probado
- Arquitectura modular y mantenible
- Logging completo para debugging
- Tests automatizados de calidad
- Frontend optimizado para UX

**Riesgos actuales:**
- Dependencia de API externa (GROQ)
- Sistema local-first requiere mantenimiento manual
- Sin persistencia de datos entre reinicios
- Ranking simple puede limitar precisión en queries complejas

### Recomendaciones

1. **Monitoreo:** Implementar alertas para errores de API
2. **Backup:** Sistema de backup automático para chunks.json
3. **Escalado:** Considerar migración a base de datos si crece el dataset
4. **Mejora continua:** Sistema de feedback para mejorar chunks y prompts

---

**Conclusión técnica:** El chatbot del IES Juan de Lanuza es un sistema RAG local-first robusto con arquitectura modular, sistema anti-alucinación probado y frontend moderno. Está listo para producción con riesgos manejables y oportunidades claras de mejora futura.
