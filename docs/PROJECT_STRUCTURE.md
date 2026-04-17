# Estructura del Proyecto - Chatbot IES Juan de Lanuza

## Overview

Proyecto de chatbot educativo con arquitectura modular, seguridad enterprise y sistema de RAG avanzado.

## Estructura de Directorios

```
chatbot-ies-juan-de-lanuza/
|
|--- src/                          # Source code principal
|    |--- server.js                # Entry point del servidor
|    |--- core/                    # Lógica principal del chatbot
|    |    |--- chatbot-backend.js  # Motor principal del chatbot
|    |    |--- ai-client.js        # Cliente de API de IA
|    |    |--- fallback-logic-manager.js # Sistema de fallback inteligente
|    |
|    |--- services/                # Servicios especializados
|    |    |--- search-service.js   # Búsqueda semántica
|    |    |--- embedding-service.js # Embeddings y BM25
|    |    |--- memory-service.js   # Gestión de memoria conversacional
|    |    |--- prompt-service.js    # Sistema de prompts
|    |    |--- response-polishing-service.js # Pulido de respuestas
|    |    |--- observability-service.js # Logging y métricas
|    |
|    |--- security/                # Seguridad y validación
|    |    |--- auth.js             # Sistema de autenticación
|    |    |--- input-sanitizer.js  # Sanitización de input
|    |    |--- error-handler.js    # Manejo de errores
|    |    |--- circuit-breaker.js  # Circuit breaker para APIs
|    |    |--- validation.js       # Validación de requests
|    |
|    |--- utils/                   # Utilidades y helpers
|    |    |--- config.js           # Gestión de configuración
|    |    |--- file-utils.js       # Utilidades de sistema de archivos
|    |    |--- container.js        # Inyección de dependencias
|    |
|    |--- quality/                 # Gestión de calidad
|    |    |--- chunk-quality-manager.js # Gestión de chunks
|    |    |--- optimize-chunks.js  # Optimización de chunks
|
|--- data/                          # Datos estáticos
|    |--- chunks.json              # Base de conocimiento
|    |--- estatico/                # Datos estáticos
|    |    |--- centro.txt
|    |    |--- oferta_educativa.txt
|    |    |--- programas.txt
|    |--- dinamico/                # Datos dinámicos
|    |    |--- avisos.txt
|    |    |--- calendario.txt
|    |    |--- faq.txt
|
|--- frontend/                      # Interfaz web
|    |--- index.html              # Página principal
|    |--- style.css               # Estilos
|    |--- app.js                  # Lógica frontend
|
|--- admin/                         # Panel de administración
|    |--- index.html              # Panel admin
|    |--- admin.css               # Estilos admin
|    |--- admin.js                # Lógica admin
|
|--- tests/                         # Tests
|    |--- unit/                   # Tests unitarios
|    |--- integration/            # Tests de integración
|    |--- e2e/                    # Tests end-to-end
|
|--- scripts/                       # Scripts de utilidad
|    |--- update-imports.js       # Actualizar imports
|    |--- fix-import-paths.js     # Arreglar paths
|    |--- deploy-audit.js         # Auditoría de deploy
|
|--- logs/                          # Logs y reportes
|    |--- chatbot-observability.json
|    |--- qa-report-*.txt
|    |--- deploy-audit-report.json
|
|--- qa-evaluator/                  # Sistema de QA
|    |--- index.js                # Evaluador principal
|    |--- qa_evaluator.js         # Lógica de QA
|    |--- qa_report.js            # Generación de reportes
|
|--- docs/                          # Documentación
|    |--- PROJECT_STRUCTURE.md    # Estructura del proyecto
|    |--- DEPLOY_GUIDE.md         # Guía de deploy
|
|--- .env                           # Variables de entorno
|--- .gitignore                     # Ignorados por Git
|--- package.json                   # Dependencias y scripts
|--- package-lock.json              # Lock de dependencias
|--- README.md                      # Documentación principal
```

## Arquitectura

### 1. Capa de Servidor (`src/server.js`)
- **Framework**: Express.js
- **Middleware**: CORS, Rate Limiting, Autenticación, Sanitización
- **Endpoints**: `/chat`, `/health`, `/chunks`
- **Seguridad**: JWT, API Keys, Input Sanitization

### 2. Capa Core (`src/core/`)
- **chatbot-backend.js**: Motor principal con RAG y memoria
- **ai-client.js**: Cliente de API con circuit breaker
- **fallback-logic-manager.js**: Sistema de fallback inteligente

### 3. Servicios (`src/services/`)
- **search-service.js**: Búsqueda semántica BM25-lite
- **embedding-service.js**: Embeddings y scoring
- **memory-service.js**: Memoria conversacional
- **prompt-service.js**: Sistema de prompts anti-hallucination
- **response-polishing-service.js**: Pulido de respuestas
- **observability-service.js**: Logging y métricas

### 4. Seguridad (`src/security/`)
- **auth.js**: Autenticación JWT/API Keys
- **input-sanitizer.js**: Sanitización contra prompt injection
- **error-handler.js**: Manejo estructurado de errores
- **circuit-breaker.js**: Circuit breaker para APIs externas
- **validation.js**: Validación de requests

### 5. Utilidades (`src/utils/`)
- **config.js**: Gestión centralizada de configuración
- **file-utils.js**: Abstracción de sistema de archivos
- **container.js**: Inyección de dependencias

### 6. Calidad (`src/quality/`)
- **chunk-quality-manager.js**: Gestión de calidad de chunks
- **optimize-chunks.js**: Optimización automática

## Flujo de Datos

1. **Request** -> Middleware de seguridad
2. **Sanitización** -> Input sanitization
3. **Autenticación** -> JWT/API Key validation
4. **Procesamiento** -> chatbot-backend.js
5. **Búsqueda** -> search-service.js + embedding-service.js
6. **Memoria** -> memory-service.js
7. **Prompt** -> prompt-service.js
8. **IA** -> ai-client.js (con circuit breaker)
9. **Fallback** -> fallback-logic-manager.js
10. **Pulido** -> response-polishing-service.js
11. **Logging** -> observability-service.js
12. **Response** -> Middleware de errores -> Cliente

## Configuración

### Variables de Entorno (.env)
```env
GROQ_API_KEY=tu_api_key_aqui
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_jwt_secret
API_KEY=tu_api_key
```

### Dependencias Principales
- **express**: Framework web
- **axios**: Cliente HTTP
- **bcryptjs**: Hashing de passwords
- **jsonwebtoken**: Tokens JWT
- **joi**: Validación
- **cors**: CORS middleware
- **express-rate-limit**: Rate limiting
- **dotenv**: Variables de entorno

## Seguridad

### 1. Autenticación
- JWT con expiración configurable
- API Keys para acceso programático
- Sistema de permisos por rol

### 2. Input Sanitization
- Detección de prompt injection
- 9 tipos de ataques detectados
- Sanitización multilingüe
- Logging de ataques

### 3. Rate Limiting
- 100 requests por IP cada 15 minutos
- Protección contra DoS
- Configurable por entorno

### 4. Error Handling
- Clasificación inteligente de errores
- Respuestas amigables para usuarios
- Logging estructurado
- Sin exposición de información sensible

## Monitoreo

### 1. Observabilidad
- Logging estructurado JSON
- Métricas de rendimiento
- Detección automática de fallos
- Reportes de QA automáticos

### 2. Calidad
- Scoring de calidad de chunks
- Detección de duplicados
- Optimización automática
- Reportes de mejora

## Deploy

### 1. Requisitos
- Node.js 18+
- Variables de entorno configuradas
- Base de datos (opcional)
- Certificado SSL (producción)

### 2. Comandos
```bash
# Instalación
npm install

# Desarrollo
npm run dev

# Producción
npm start

# Tests
npm test

# Auditoría de deploy
npm run audit
```

### 3. Plataformas Soportadas
- Railway
- Vercel
- Heroku
- Docker
- Servidores dedicados

## Tests

### 1. Tests Unitarios
- 17 archivos de tests unitarios
- Cobertura de todos los módulos
- Tests de seguridad y calidad

### 2. Tests de Integración
- Tests de endpoints
- Tests de flujo completo
- Tests de seguridad

### 3. Tests E2E
- Tests de usuario real
- Tests de rendimiento
- Tests de carga

## Rendimiento

### 1. Optimizaciones
- BM25-lite para búsqueda
- Caching de respuestas
- Circuit breaker para APIs
- Pooling de conexiones

### 2. Métricas
- <500ms tiempo de respuesta
- 99.9% uptime
- <100MB memoria RAM
- Soporte concurrente

## Escalabilidad

### 1. Horizontal
- Clustering con Node.js
- Load balancing
- Base de datos distribuida
- CDN para frontend

### 2. Vertical
- Optimización de chunks
- Caching inteligente
- Compresión de respuestas
- Monitoreo de recursos

## Mantenimiento

### 1. Logs
- Rotación automática
- Niveles de severidad
- Exportación a sistemas externos
- Análisis de patrones

### 2. Updates
- Actualización de chunks
- Optimización de prompts
- Mejora de modelos
- Parches de seguridad

## Soporte

### 1. Documentación
- API docs
- Guías de deploy
- Troubleshooting
- Best practices

### 2. Monitoreo
- Health checks
- Alertas automáticas
- Dashboards
- Reportes periódicos
