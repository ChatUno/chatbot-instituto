# V5 ROADMAP - HERRAMIENTA DE INGESTIÓN Y GESTIÓN DE CONTENIDO RAG

---

## 1. RESUMEN EJECUTIVO

**Propósito del Sistema**: Pipeline de ingesta de contenido basado en web que extrae, estructura y valida automáticamente conocimiento institucional de páginas web para mejorar la base de conocimiento del chatbot existente.

**Por Qué Existe**: El chatbot actual depende de chunks JSON mantenidos manualmente, creando lagunas de conocimiento y alto sobrecoste de mantenimiento. El contenido institucional cambia frecuentemente (calendarios, anuncios, programas) pero las actualizaciones requieren intervención técnica.

**Problema Resuelto**: 
- Elimina el mantenimiento manual de chunks JSON
- Reduce la tasa de fallback del chatbot por información desactualizada
- Permite que administradores no técnicos actualicen la base de conocimiento
- Proporciona flujo de trabajo sistemático de validación de contenido
- Mejora la precisión y cobertura del chatbot

---

## 2. EPICS (MÁXIMO 5)

### Epic 1: Sistema de Ingestión de URLs
**Alcance**: Pipeline de web scraping para páginas institucionales con extracción automática de contenido y descubrimiento de enlaces.

### Epic 2: Motor de Procesamiento de Contenido  
**Alcance**: Limpieza de texto, detección de estructura y generación inteligente de chunks optimizados para recuperación BM25-lite.

### Epic 3: Interfaz de Validación Humana
**Alcance**: UI de administración para revisar, editar y aprobar contenido extraído antes del despliegue en producción.

### Epic 4: Pipeline de Exportación de Dataset
**Alcance**: Exportar chunks validados al chatbot de producción con capacidades de rollback y seguimiento de cambios.

### Epic 5: Dashboard de Monitoreo de Calidad
**Alcance**: Analíticas para calidad de ingesta, cobertura de contenido e impacto en rendimiento del chatbot.

---

## 3. HISTORIAS DE USUARIO

### V5-01: Fundación de Ingestión de URLs
**Rol de Usuario**: Administrador  
**Problema**: Necesita agregar nuevas páginas web institucionales a la base de conocimiento sin habilidades técnicas.  
**Criterios de Aceptación**:
- El administrador puede ingresar una URL única mediante formulario web
- El sistema valida accesibilidad de URL y tipo de contenido
- Extracción básica de contenido (título, texto principal, enlaces)
- Manejo de errores para páginas bloqueadas/inaccesibles
- Retroalimentación de éxito/fracaso con mensajes claros  
**Prioridad**: P0

### V5-02: Procesamiento por Lotes de URLs
**Rol de Usuario**: Administrador  
**Problema**: El ingreso manual de URLs es consumidor de tiempo para múltiples páginas.  
**Criterios de Aceptación**:
- Subir CSV/JSON con múltiples URLs
- Procesamiento en cola con seguimiento de progreso
- Éxito/fracaso individual por URL
- Exportar resultados de procesamiento
- Limitación de velocidad para evitar sobrecargar sitios objetivo  
**Prioridad**: P1

### V5-03: Detección de Estructura de Contenido
**Rol de Usuario**: Sistema  
**Problema**: HTML crudo contiene navegación, footers, anuncios que contaminan la base de conocimiento.  
**Criterios de Aceptación**:
- Detección automática de áreas de contenido principal
- Eliminación de navegación, headers, footers
- Identificación de datos estructurados (tablas, listas)
- Preservación de formato importante (títulos, negritas)
- Puntuación de calidad para contenido extraído  
**Prioridad**: P0

### V5-04: Descubrimiento de Enlaces y Crawling
**Rol de Usuario**: Sistema  
**Problema**: Contenido importante está enlazado desde páginas principales pero no es directamente accesible.  
**Criterios de Aceptación**:
- Extraer todos los enlaces internos de páginas procesadas
- Filtrar enlaces institucionales relevantes (mismo dominio)
- Crawling recursivo opcional (1-2 niveles de profundidad)
- Detección y deduplicación de enlaces duplicados
- Control de profundidad de crawling y límites  
**Prioridad**: P1

### V5-05: Generación Inteligente de Chunks
**Rol de Usuario**: Sistema  
**Problema**: El contenido necesita dividirse en chunks óptimos para recuperación BM25-lite.  
**Criterios de Aceptación**:
- Dividir contenido por límites semánticos (párrafos, secciones)
- Tamaño de chunk objetivo: 50-300 palabras
- Preservar contexto y coherencia
- Generación automática de metadatos (fuente, categoría, calidad)
- Prevención de superposición para contenido redundante  
**Prioridad**: P0

### V5-06: Interfaz de Validación de Contenido
**Rol de Usuario**: Administrador  
**Problema**: Necesita revisar y editar contenido extraído antes del despliegue en producción.  
**Criterios de Aceptación**:
- Interfaz web mostrando chunks extraídos con metadatos
- Capacidades de edición inline para texto y metadatos
- Operaciones masivas (aprobar todo, rechazar todo)
- Búsqueda y filtrado por contenido, fuente, calidad
- Vista previa del formato final de salida de chunks  
**Prioridad**: P0

### V5-07: Sistema de Puntuación de Calidad
**Rol de Usuario**: Administrador  
**Problema**: Necesita priorizar qué contenido necesita revisión manual.  
**Criterios de Aceptación**:
- Puntuación automática de calidad (0-100) basada en múltiples factores
- Factores de puntuación: longitud, estructura, relevancia, duplicados
- Indicadores visuales para niveles de calidad
- Filtrado por rangos de puntuación de calidad
- Sugerencias de mejora de calidad  
**Prioridad**: P1

### V5-08: Pipeline de Exportación de Dataset
**Rol de Usuario**: Administrador  
**Problema**: Necesita desplegar contenido validado de forma segura en el chatbot de producción.  
**Criterios de Aceptación**:
- Exportar chunks validados a formato de producción
- Respaldar chunks existentes antes del despliegue
- Capacidad de rollback a versión anterior
- Historial de despliegue y seguimiento de cambios
- Validación de compatibilidad de formato de exportación  
**Prioridad**: P0

### V5-09: Gestión de Cambios
**Rol de Usuario**: Administrador  
**Problema**: Necesita rastrear qué contenido cambió y cuándo.  
**Criterios de Aceptación**:
- Historial de versiones para cada chunk
- Detección de cambios entre versiones
- Auditoría de quién aprobó qué
- Vista de comparación para cambios
- Exportar reportes de cambios  
**Prioridad**: P1

### V5-10: Analíticas de Cobertura de Contenido
**Rol de Usuario**: Administrador  
**Problema**: Necesita entender la completitud y lagunas de la base de conocimiento.  
**Criterios de Aceptación**:
- Dashboard mostrando cobertura de contenido por categoría
- Identificación de lagunas de contenido vs consultas del chatbot
- Detección y reporte de contenido duplicado
- Indicadores de frescura de contenido (última actualización)
- Exportar reportes de cobertura  
**Prioridad**: P2

### V5-11: Monitoreo de Integración
**Rol de Usuario**: Sistema  
**Problema**: Necesita asegurar que la ingesta no rompa el chatbot de producción.  
**Criterios de Aceptación**:
- Verificaciones de salud para chatbot de producción después del despliegue
- Rollback automático en errores críticos
- Monitoreo de rendimiento (tiempo de respuesta, tasa de error)
- Sistema de alertas para problemas de integración
- Suite de pruebas de integración  
**Prioridad**: P1

### V5-12: Gestión de Usuarios
**Rol de Usuario**: Desarrollador  
**Problema**: Necesita controlar quién puede modificar la base de conocimiento.  
**Criterios de Aceptación**:
- Sistema de autenticación simple
- Permisos basados en roles (visor, editor, administrador)
- Registro de actividad y auditoría
- Gestión de sesiones
- Protección por contraseña para operaciones sensibles  
**Prioridad**: P2

---

## 4. DESGLOSE DE TAREAS

### V5-01: Fundación de Ingestión de URLs
**Tareas Backend**:
- Crear servicio de validación de URL
- Implementar cliente HTTP con timeout y retry
- Construir parser HTML básico
- Agregar manejo de errores y logging
- Crear endpoints API para envío de URL

**Tareas Frontend**:
- Diseñar formulario de ingreso de URL
- Agregar retroalimentación de validación
- Crear estados de carga e indicadores de progreso
- Construir visualización de mensajes de éxito/error
- Implementar diseño responsivo

**Tareas de Datos**:
- Definir esquema de trabajo de ingesta
- Crear seguimiento de estado de trabajo
- Configurar almacenamiento de registro de errores
- Diseñar estructura de metadatos de URL

**Tareas de Pruebas**:
- Pruebas unitarias para validación de URL
- Pruebas de integración para cliente HTTP
- Pruebas E2E para envío de formulario
- Pruebas de escenario de error

### V5-02: Procesamiento por Lotes de URLs
**Tareas Backend**:
- Implementar carga de archivos CSV/JSON
- Crear sistema de cola de trabajos
- Agregar middleware de limitación de velocidad
- Construir worker de procesamiento por lotes
- Crear API de seguimiento de progreso

**Tareas Frontend**:
- Componente de carga de archivos
- Barra de progreso para trabajos por lotes
- Dashboard de estado de trabajos
- Funcionalidad de exportación de resultados
- Controles de acciones masivas

**Tareas de Datos**:
- Diseñar esquema de trabajo por lotes
- Crear almacenamiento de resultados de trabajo
- Implementar persistencia de trabajo
- Configurar limpieza de trabajo

**Tareas de Pruebas**:
- Pruebas de validación de carga de archivos
- Pruebas de procesamiento de cola
- Pruebas de limitación de velocidad
- Pruebas de rendimiento de lotes grandes

### V5-03: Detección de Estructura de Contenido
**Tareas Backend**:
- Implementar extracción de contenido HTML
- Construir algoritmos de eliminación de ruido
- Crear detección de estructura (títulos, listas, tablas)
- Agregar puntuación de calidad de contenido
- Implementar normalización de texto

**Tareas Frontend**:
- Componente de vista previa de contenido
- Visualización de estructura
- Visualización de puntuación de calidad
- Vista de comparación antes/después

**Tareas de Datos**:
- Definir esquema de contenido extraído
- Crear almacenamiento de métricas de calidad
- Diseñar estructura de metadatos de contenido

**Tareas de Pruebas**:
- Pruebas de precisión de extracción de contenido
- Pruebas de efectividad de eliminación de ruido
- Pruebas de validación de puntuación de calidad

### V5-04: Descubrimiento de Enlaces y Crawling
**Tareas Backend**:
- Construir algoritmo de extracción de enlaces
- Implementar lógica de filtrado de URLs
- Crear control de profundidad de crawling
- Agregar detección de duplicados
- Implementar programación de crawling

**Tareas Frontend**:
- Interfaz de configuración de crawling
- Visualización de resultados de descubrimiento de enlaces
- Seguimiento de progreso de crawling
- Panel de control de crawling

**Tareas de Datos**:
- Diseñar esquema de trabajo de crawling
- Crear almacenamiento de grafo de enlaces
- Implementar persistencia de resultados de crawling

**Tareas de Pruebas**:
- Pruebas de precisión de extracción de enlaces
- Pruebas de control de profundidad de crawling
- Pruebas de detección de duplicados

### V5-05: Generación Inteligente de Chunks
**Tareas Backend**:
- Implementar algoritmos de división de texto
- Construir detección de límites semánticos
- Crear optimización de tamaño de chunks
- Agregar generación de metadatos
- Implementar detección de duplicados

**Tareas Frontend**:
- Interfaz de vista previa de chunks
- Capacidades de edición de chunks
- Formularios de edición de metadatos
- Operaciones masivas de chunks

**Tareas de Datos**:
- Definir esquema de chunks
- Crear estructura de metadatos de chunks
- Implementar versionado de chunks

**Tareas de Pruebas**:
- Pruebas de calidad de chunks
- Pruebas de distribución de tamaño
- Pruebas de detección de duplicados

### V5-06: Interfaz de Validación de Contenido
**Tareas Backend**:
- Crear endpoints API de validación
- Implementar operaciones CRUD para chunks
- Agregar búsqueda y filtrado
- Construir APIs de operaciones masivas
- Crear flujo de trabajo de aprobación

**Tareas Frontend**:
- Diseñar dashboard de validación
- Construir componente editor de chunks
- Implementar UI de búsqueda y filtrado
- Crear interfaz de operaciones masivas
- Agregar UI de flujo de trabajo de aprobación

**Tareas de Datos**:
- Diseñar esquema de estado de aprobación
- Crear almacenamiento de historial de validación
- Implementar auditoría

**Tareas de Pruebas**:
- Pruebas de usabilidad de UI
- Pruebas de operaciones CRUD
- Pruebas de operaciones masivas
- Pruebas de flujo de trabajo

### V5-07: Sistema de Puntuación de Calidad
**Tareas Backend**:
- Implementar algoritmo de puntuación de calidad
- Crear cálculo de métricas de calidad
- Agregar análisis de tendencias de calidad
- Construir sugerencias de mejora de calidad
- Crear API de reporte de calidad

**Tareas Frontend**:
- Visualización de puntuación de calidad
- Interfaz de filtrado de calidad
- Gráficos de tendencias de calidad
- Visualización de sugerencias de mejora

**Tareas de Datos**:
- Definir esquema de métricas de calidad
- Crear almacenamiento de historial de calidad
- Implementar agregación de calidad

**Tareas de Pruebas**:
- Pruebas de precisión de puntuación
- Pruebas de tendencias de calidad
- Pruebas de rendimiento

### V5-08: Pipeline de Exportación de Dataset
**Tareas Backend**:
- Crear validación de formato de exportación
- Implementar sistema de respaldo
- Construir pipeline de despliegue
- Agregar funcionalidad de rollback
- Crear seguimiento de despliegue

**Tareas Frontend**:
- Interfaz de configuración de exportación
- Seguimiento de progreso de despliegue
- Controles de rollback
- Visualización de historial de despliegue

**Tareas de Datos**:
- Diseñar esquema de despliegue
- Crear almacenamiento de respaldos
- Implementar seguimiento de versiones

**Tareas de Pruebas**:
- Pruebas de validación de formato de exportación
- Pruebas de respaldo/restauración
- Pruebas de rollback
- Pruebas de despliegue

### V5-09: Gestión de Cambios
**Tareas Backend**:
- Implementar sistema de control de versiones
- Crear algoritmos de detección de cambios
- Construir sistema de auditoría
- Agregar funcionalidad de comparación
- Crear reporte de cambios

**Tareas Frontend**:
- Interfaz de historial de versiones
- Vista de comparación de cambios
- Visualización de auditoría
- Exportación de reporte de cambios

**Tareas de Datos**:
- Diseñar esquema de versiones
- Crear almacenamiento de seguimiento de cambios
- Implementar registro de auditoría

**Tareas de Pruebas**:
- Pruebas de control de versiones
- Pruebas de detección de cambios
- Pruebas de auditoría

### V5-10: Analíticas de Cobertura de Contenido
**Tareas Backend**:
- Implementar algoritmos de análisis de cobertura
- Crear sistema de detección de lagunas
- Construir motor de cálculo de analíticas
- Agregar funcionalidad de reporte
- Crear análisis de tendencias

**Tareas Frontend**:
- Dashboard de analíticas
- Visualización de cobertura
- Visualización de análisis de lagunas
- Gráficos de tendencias
- Interfaz de exportación de reportes

**Tareas de Datos**:
- Diseñar esquema de analíticas
- Crear almacenamiento de métricas de cobertura
- Implementar agregación de datos de tendencias

**Tareas de Pruebas**:
- Pruebas de precisión de analíticas
- Pruebas de rendimiento
- Pruebas de visualización

### V5-11: Monitoreo de Integración
**Tareas Backend**:
- Implementar sistema de verificación de salud
- Crear endpoints de monitoreo
- Construir sistema de alertas
- Agregar disparadores de rollback automático
- Crear seguimiento de rendimiento

**Tareas Frontend**:
- Dashboard de monitoreo
- Visualización de alertas
- Indicadores de estado de salud
- Gráficos de rendimiento

**Tareas de Datos**:
- Diseñar esquema de monitoreo
- Crear almacenamiento de métricas
- Implementar persistencia de alertas

**Tareas de Pruebas**:
- Pruebas de verificación de salud
- Pruebas de precisión de monitoreo
- Pruebas de sistema de alertas

### V5-12: Gestión de Usuarios
**Tareas Backend**:
- Implementar sistema de autenticación
- Crear control de acceso basado en roles
- Construir gestión de sesiones
- Agregar registro de actividad
- Crear APIs de gestión de usuarios

**Tareas Frontend**:
- Interfaz de inicio de sesión
- Dashboard de gestión de usuarios
- Interfaz de asignación de roles
- Visualización de registro de actividad

**Tareas de Datos**:
- Diseñar esquema de usuarios
- Crear almacenamiento de roles
- Implementar almacenamiento de sesiones

**Tareas de Pruebas**:
- Pruebas de autenticación
- Pruebas de autorización
- Pruebas de gestión de sesiones

---

## 5. DISEÑO DE ARQUITECTURA

### Módulos del Sistema

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend Web │    │   API Gateway   │    │  Procesamiento │
│   (React/Vue)  │◄──►│   (Express)     │◄──►│     Workers     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
│   Almacenamiento │    │   Base de     │
│   (Archivos JSON)│    │   Datos (SQLite)│
└──────────────────┘    └─────────────────┘
```

### Flujo de Datos (URL → Chunks → Validación → Exportación)

1. **Fase de Ingestión**:
   ```
   Entrada URL → Validación → Cola → Cliente HTTP → Parser HTML → Extractor de Contenido
   ```

2. **Fase de Procesamiento**:
   ```
   Contenido Crudo → Detección de Estructura → Limpieza → Generación de Chunks → Puntuación de Calidad
   ```

3. **Fase de Validación**:
   ```
   Chunks → Revisión Humana → Edición → Aprobación → Control de Versiones
   ```

4. **Fase de Exportación**:
   ```
   Chunks Aprobados → Validación de Formato → Respaldo → Despliegue → Monitoreo
   ```

### Formato de Almacenamiento (Estructura JSON)

```json
{
  "version": "5.0",
  "created": "2026-04-17T20:00:00Z",
  "metadata": {
    "source_urls": ["https://iesborja.educa.aragon.es/..."],
    "total_chunks": 45,
    "quality_score": 87.5
  },
  "chunks": [
    {
      "id": "chunk_001",
      "source_url": "https://iesborja.educa.aragon.es/oferta",
      "source_title": "Oferta Educativa",
      "text": "El IES Juan de Lanuza ofrece...",
      "category": "oferta",
      "quality_score": 92,
      "metadata": {
        "word_count": 156,
        "extraction_date": "2026-04-17T20:00:00Z",
        "last_modified": "2026-04-17T20:00:00Z",
        "approved_by": "admin@iesborja.edu",
        "version": 1
      }
    }
  ]
}
```

### Estructura UI (Panel de Administración)

```
┌─────────────────────────────────────────────────────────────┐
│                    Cabecera y Navegación                │
├─────────────────────────────────────────────────────────────┤
│  Barra Lateral    │           Área de Contenido        │
│  - Dashboard     │  ┌─────────────────────────────────┐  │
│  - Ingestión     │  │         Contenido Dinámico      │  │
│  - Validación    │  │    (Tablas, Formularios,       │  │
│  - Exportación   │  │     Gráficos)                 │  │
│  - Analíticas    │  └─────────────────────────────────┘  │
│  - Configuración │                                     │
└─────────────────────────────────────────────────────────────┘
```

### Etapas del Pipeline

1. **Etapa 1: Procesamiento de URL**
   - Validación y verificación de accesibilidad de URL
   - Solicitud HTTP con lógica de retry
   - Recuperación de contenido HTML
   - Extracción inicial de contenido

2. **Etapa 2: Análisis de Contenido**
   - Detección de estructura y limpieza
   - Extracción y filtrado de enlaces
   - Evaluación de calidad del contenido
   - Generación de metadatos

3. **Etapa 3: Generación de Chunks**
   - División inteligente de texto
   - Detección de límites semánticos
   - Eliminación de contenido duplicado
   - Puntuación de calidad y categorización

4. **Etapa 4: Validación Humana**
   - Interfaz de revisión de contenido
   - Capacidades de edición inline
   - Flujo de trabajo de aprobación
   - Control de versiones

5. **Etapa 5: Despliegue en Producción**
   - Validación de formato
   - Creación de respaldos
   - Despliegue seguro
   - Monitoreo y rollback

---

## 6. MAPA DE PRIORIDADES

### P0 (Imprescindible para MVP)
- V5-01: Fundación de Ingestión de URLs
- V5-03: Detección de Estructura de Contenido  
- V5-05: Generación Inteligente de Chunks
- V5-06: Interfaz de Validación de Contenido
- V5-08: Pipeline de Exportación de Dataset

### P1 (Mejoras Importantes)
- V5-02: Procesamiento por Lotes de URLs
- V5-04: Descubrimiento de Enlaces y Crawling
- V5-07: Sistema de Puntuación de Calidad
- V5-09: Gestión de Cambios
- V5-11: Monitoreo de Integración

### P2 (Deseable Tener)
- V5-10: Analíticas de Cobertura de Contenido
- V5-12: Gestión de Usuarios

---

## 7. DEPENDENCIAS

### Ruta Crítica para Entrega MVP

```
V5-01 (Ingestión de URLs) 
    ↓
V5-03 (Detección de Contenido)
    ↓  
V5-05 (Generación de Chunks)
    ↓
V5-06 (Interfaz de Validación)
    ↓
V5-08 (Pipeline de Exportación)
```

### Dependencias de Módulos

- **Frontend** depende de: Todas las APIs backend
- **Workers de Procesamiento** dependen de: Validación de URL, extracción de contenido
- **Pipeline de Exportación** depende de: Sistema de validación, generación de chunks
- **Puntuación de Calidad** depende de: Detección de contenido, generación de chunks
- **Monitoreo** depende de: Pipeline de exportación, integración de producción

### Oportunidades de Desarrollo Paralelo

- **Frontend** puede desarrollarse junto con las APIs backend
- **Puntuación de Calidad** puede desarrollarse en paralelo con la generación de chunks
- **Monitoreo** puede desarrollarse después que el núcleo MVP sea estable
- **Procesamiento por Lotes** puede construirse sobre el procesamiento individual de URLs

---

## 8. ESTRATEGIA DE VALIDACIÓN

### Pruebas de Calidad de Ingestión

**Validación Automatizada**:
- Verificaciones de consistencia de estructura HTML
- Precisión de extracción de contenido (>90% esperado)
- Validación de extracción de enlaces
- Análisis de distribución de tamaño de chunks
- Detección de contenido duplicado

**Validación Manual**:
- Revisión administrativa de contenido extraído
- Comparación con páginas web originales
- Calibración de puntuación de calidad
- Pruebas de casos límite (diseños complejos, contenido dinámico)

### Validación de Utilidad de Chunks

**Métricas de Calidad**:
- Longitud de texto (50-300 palabras óptimo)
- Puntuación de coherencia semántica
- Densidad de información
- Relevancia de categoría
- Autoridad de fuente

**Proceso de Pruebas**:
- Validación de muestra por expertos del dominio
- Pruebas A/B con rendimiento del chatbot
- Recolección de retroalimentación de usuarios
- Monitoreo de tasa de fallback

### Detección de Mal Scraping

**Detección Automatizada**:
- Detección de contenido vacío
- Contenido de navegación/boilerplate
- Identificación de páginas de error
- Contenido duplicado entre URLs
- Manejo de HTML malformado

**Revisión Manual**:
- Inspección visual de contenido extraído
- Validación cruzada con páginas originales
- Ajuste de umbrales de puntuación de calidad
- Documentación de casos límite

### Flujo de Trabajo de Revisión Humana

**Proceso de Revisión**:
1. **Pre-filtrado Automático**: Filtrado por puntuación de calidad
2. **Operaciones Masivas**: Aprobación/rechazo rápido para alta/baja calidad
3. **Revisión Detallada**: Edición manual de contenido de calidad media
4. **Aprobación Final**: Firma del administrador antes de producción
5. **Auditoría**: Registro completo de todos los cambios

**Interfaz de Revisión**:
- Vista de comparación dividida (original vs extraído)
- Edición inline con resaltado de sintaxis
- Indicadores de puntuación de calidad y sugerencias
- Controles de acciones masivas
- Capacidades de búsqueda y filtrado

---

## 9. MÉTRICAS DE ÉXITO

### Tasa de Utilidad de Chunks
- **Objetivo**: >85% de chunks aceptados sin ediciones mayores
- **Medición**: (Chunks aprobados como están) / (Total de chunks generados)
- **Seguimiento**: Por administrador, por fuente, por categoría
- **Meta**: Reducir tiempo de edición manual en 70%

### Reducción de Tasa de Fallback del Chatbot
- **Objetivo**: Reducir tasa de fallback del actual 15% a <5%
- **Medición**: (Respuestas de fallback) / (Total de respuestas)
- **Seguimiento**: Comparación antes/después del despliegue
- **Meta**: Mejorar calidad y cobertura de respuestas

### Mejora de Cobertura
- **Objetivo**: Incrementar cobertura de base de conocimiento en 40%
- **Medición**: Número de temas/conceptos únicos cubiertos
- **Seguimiento**: Análisis de lagunas de contenido vs consultas de usuarios
- **Meta**: Responder 90% de preguntas institucionales comunes

### Tiempo de Administrador por Dataset
- **Objetivo**: <30 minutos para actualización completa de dataset
- **Medición**: Tiempo total desde entrada de URL hasta despliegue en producción
- **Seguimiento**: Tiempo por fase (ingesta, validación, exportación)
- **Meta**: Hacer actualizaciones semanales factibles

### Confiabilidad del Sistema
- **Objetivo**: >99% uptime para sistema de ingesta
- **Medición**: Disponibilidad del sistema y tasas de error
- **Seguimiento**: Alertas de dashboard de monitoreo
- **Meta**: Cero despliegues fallidos

### Frescura de Contenido
- **Objetivo**: Contenido no más antiguo de 7 días en producción
- **Medición**: Edad del contenido en base de conocimiento del chatbot
- **Seguimiento**: Monitoreo automatizado de frescura
- **Meta**: Mantener información actual y relevante

### Satisfacción del Usuario
- **Objetivo**: >90% satisfacción con respuestas del chatbot
- **Medición**: Retroalimentación y calificaciones de usuarios
- **Seguimiento**: Encuestas post-interacción
- **Meta**: Mejorar experiencia del usuario con mejores respuestas

---

## 10. CUMPLIMIENTO DE REGLAS IMPORTANTES

### ✅ SIN Embeddings
- El sistema usa chunking compatible con BM25-lite
- Sin procesamiento vectorial o búsqueda de similitud
- Enfoque en extracción y estructura de texto

### ✅ SIN Bases de Datos Vectoriales  
- Almacenamiento simple de archivos JSON para chunks
- SQLite para metadatos y seguimiento de trabajos
- Sin indexación vectorial compleja requerida

### ✅ Arquitectura Simple
- Modular pero no sobre-ingenierizada
- Separación clara de responsabilidades
- Fácil de desplegar y mantener

### ✅ Caso de Uso Institucional Pequeño
- Diseñado para <1000 páginas totales
- Uso de administrador único o equipo pequeño
- Enfoque solo en contenido institucional

### ✅ Semanas, No Meses
- MVP entregable en 6-8 semanas
- Entrega incremental posible
- Ciclos de retroalimentación rápidos

### ✅ Diseño Humano-en-el-Bucle
- Paso de validación obligatorio
- Aprobación de administrador requerida
- Auditoría completa
- Capacidades fáciles de rollback

---

# RESUMEN

Este roadmap V5 proporciona un plan realista y listo para producción para construir una herramienta de ingesta y gestión de contenido RAG que aborda directamente los puntos de dolor actuales del mantenimiento manual de la base de conocimiento. El enfoque se mantiene en la simplicidad, usabilidad para administradores no técnicos y mejora de la calidad del conocimiento del chatbot sin introducir complejidad innecesaria.

**Factores Clave de Éxito**:
- Flujo de trabajo de ingesta basado en URL simple
- Extracción de contenido automatizada de alta calidad
- Paso de validación humana obligatorio
- Despliegue seguro en producción
- Mejoras medibles en rendimiento del chatbot

**Línea de Tiempo Estimada**: 6-8 semanas para MVP, 10-12 semanas para conjunto completo de características.
