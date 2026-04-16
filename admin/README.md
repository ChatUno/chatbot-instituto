# Panel de Administración - Chatbot IES Juan de Lanuza

Panel de administración SaaS para gestionar el chatbot del instituto.

## Características

### 🎯 Dashboard
- Estadísticas en tiempo real
- Número total de chunks
- Estado del chatbot
- Fuentes de conocimiento
- Última actualización

### 🧠 Gestión de Conocimiento
- Visualización de chunks actuales
- Editar chunks existentes
- Añadir nuevos chunks
- Eliminar chunks
- Guardar cambios en tiempo real

### 💬 Preview del Chatbot
- Interfaz funcional del chatbot
- Envío de mensajes en tiempo real
- Respuestas del backend
- Limpiar conversación

### ⚙️ Ajustes
- Información del centro
- Estado del sistema
- Configuración básica

## Arquitectura

### Frontend
- **HTML5**: Estructura semántica
- **CSS3**: Diseño moderno con gradientes y animaciones
- **JavaScript ES6+**: Lógica de interactividad
- **Font Awesome**: Iconos

### Backend
- **Node.js + Express**: Servidor API
- **CORS**: Comunicación entre dominios
- **File System**: Persistencia de datos en JSON

## Instalación y Uso

### Prerrequisitos
- Node.js instalado
- Servidor del chatbot funcionando

### Pasos

1. **Iniciar el servidor del chatbot**
   ```bash
   node server.js
   ```

2. **Abrir el panel de administración**
   - Navegar a `admin/index.html` en tu navegador
   - O servir los archivos estáticos con un servidor web

### Endpoints API

- `GET /health` - Verificar estado del servidor
- `POST /chat` - Enviar mensaje al chatbot
- `POST /save-chunks` - Guardar cambios en chunks

## Estructura de Archivos

```
admin/
├── index.html          # Página principal del panel
├── admin.css           # Estilos CSS
├── admin.js            # Lógica JavaScript
└── README.md           # Documentación
```

## Funcionalidades Técnicas

### Gestión de Chunks
- CRUD completo sobre chunks.json
- Validación de datos
- Sincronización con backend
- IDs automáticos

### Comunicación con Backend
- Fetch API para llamadas asíncronas
- Manejo de errores
- Estados de carga
- Notificaciones al usuario

### UI/UX
- Diseño responsive
- Animaciones suaves
- Notificaciones toast
- Estados interactivos

## Seguridad

- Sin autenticación (como requerido)
- Validación básica de entrada
- Manejo seguro de errores

## Futuras Mejoras

- Sistema de autenticación
- Base de datos persistente
- Sistema de backups
- Analytics y métricas avanzadas
- Multi-idioma

## Soporte

El panel está diseñado para ser simple pero funcional, manteniendo la integridad del sistema de chatbot existente.
