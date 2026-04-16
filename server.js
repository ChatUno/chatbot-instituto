console.log("=== INICIANDO SERVIDOR ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);

const express = require("express");
const cors = require("cors");

console.log("Módulos Express y CORS cargados");

let handleUserQuery;

try {
    console.log("Intentando importar chatbot-backend...");
    const backend = require("./chatbot-backend");
    console.log("Backend importado:", Object.keys(backend));
    
    handleUserQuery = backend.handleUserQuery;
    
    if (!handleUserQuery) {
        throw new Error("handleUserQuery no encontrado en el módulo chatbot-backend");
    }
    
    console.log("handleUserQuery importado correctamente");
    console.log("Tipo de handleUserQuery:", typeof handleUserQuery);
} catch (error) {
    console.error("ERROR CRÍTICO importando handleUserQuery:", error);
    console.error("Stack trace:", error.stack);
    console.error("Continuando sin handleUserQuery - usando fallback");
    
    // Fallback simple para testing
    handleUserQuery = async (message) => {
        return `Respuesta de fallback (handleUserQuery no disponible): ${message}`;
    };
}

const app = express();

// Middleware
app.use((req, res, next) => {
  console.log("Request origin:", req.headers.origin);
  console.log("Request method:", req.method);
  console.log("Request path:", req.path);
  next();
});

app.use(cors({
  origin: [
    'https://chatbot-instituto-57zd.vercel.app',
    'https://chatbot-instituto.vercel.app',
    'https://chatbot-instituto-production.up.railway.app',
    'http://localhost:3000',
    'http://localhost:5500'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());

// Root endpoint for testing
app.get("/", (req, res) => {
    res.send("Chatbot activo");
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        endpoints: {
            chat: "POST /chat",
            health: "GET /health",
            getChunks: "GET /chunks",
            postChunks: "POST /chunks"
        }
    });
});

// Endpoint principal del chatbot
app.post("/chat", async (req, res) => {
    console.log("=== POST /chat llamado ===");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);
    
    try {
        const { message } = req.body;
        console.log("Message extraído:", message);

        if (!message) {
            console.log("ERROR: No message provided");
            return res.status(400).json({ 
                error: "No message provided",
                message: "Se requiere el campo 'message' en el cuerpo de la petición"
            });
        }

        console.log("Llamando a handleUserQuery...");
        const response = await handleUserQuery(message);
        console.log("handleUserQuery respondió:", response);

        res.json({
            response: response
        });

    } catch (error) {
        console.error("ERROR en /chat:", error);
        console.error("Stack trace:", error.stack);
        res.status(500).json({
            error: "Error procesando la petición",
            message: error.message,
            stack: error.stack
        });
    }
});

// Endpoint para obtener chunks
app.get("/chunks", async (req, res) => {
    console.log("=== GET /chunks llamado ===");
    
    try {
        const fs = require('fs').promises;
        const path = require('path');
        
        // Leer chunks del archivo
        const chunksPath = path.join(__dirname, 'data', 'chunks.json');
        const chunksData = await fs.readFile(chunksPath, 'utf8');
        const chunks = JSON.parse(chunksData);
        
        console.log(`Chunks leídos correctamente: ${chunks.length} chunks encontrados`);
        
        res.json({
            "status": "ok",
            "data": chunks
        });
        
    } catch (error) {
        console.error("ERROR en /chunks:", error);
        console.error("Stack trace:", error.stack);
        
        if (error.code === 'ENOENT') {
            res.status(404).json({
                "status": "error",
                "message": "El archivo chunks.json no existe"
            });
        } else if (error instanceof SyntaxError) {
            res.status(400).json({
                "status": "error",
                "message": "El archivo chunks.json tiene un formato JSON inválido"
            });
        } else {
            res.status(500).json({
                "status": "error",
                "message": "Error leyendo chunks"
            });
        }
    }
});

// Endpoint para guardar chunks
app.post("/chunks", async (req, res) => {
    console.log("=== POST /chunks llamado ===");
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    
    try {
        const { chunks } = req.body;
        console.log("Chunks recibidos:", chunks);
        console.log("Número de chunks:", chunks ? chunks.length : 0);

        // Validaciones
        if (!chunks || !Array.isArray(chunks)) {
            console.log("ERROR: No chunks array provided");
            return res.status(400).json({ 
                "status": "error",
                "message": "Se requiere el campo 'chunks' como array en el cuerpo de la petición"
            });
        }

        // Validar cada chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            if (!chunk.id || typeof chunk.id !== 'number') {
                console.log(`ERROR: Chunk ${i} - ID inválido`);
                return res.status(400).json({
                    "status": "error",
                    "message": `Cada chunk debe tener un 'id' numérico. Error en chunk ${i}`
                });
            }
            
            if (!chunk.text || typeof chunk.text !== 'string' || chunk.text.trim() === '') {
                console.log(`ERROR: Chunk ${i} - Texto inválido`);
                return res.status(400).json({
                    "status": "error",
                    "message": `Cada chunk debe tener un 'text' no vacío. Error en chunk ${i}`
                });
            }
            
            if (!chunk.source || typeof chunk.source !== 'string' || chunk.source.trim() === '') {
                console.log(`ERROR: Chunk ${i} - Source inválido`);
                return res.status(400).json({
                    "status": "error",
                    "message": `Cada chunk debe tener un 'source' no vacío. Error en chunk ${i}`
                });
            }
        }

        const fs = require('fs');
        const path = require('path');
        
        // Guardar chunks en el archivo con ruta absoluta
        const chunksPath = path.join(__dirname, 'data', 'chunks.json');
        console.log("Ruta exacta donde se guardará:", chunksPath);
        
        // Usar writeFileSync para asegurar escritura síncrona
        fs.writeFileSync(chunksPath, JSON.stringify(chunks, null, 2), 'utf8');
        console.log(`Chunks escritos con writeFileSync: ${chunks.length} chunks`);
        
        // Verificación: leer el archivo después de guardar
        try {
            const verificationData = fs.readFileSync(chunksPath, 'utf8');
            const verificationChunks = JSON.parse(verificationData);
            console.log("VERIFICACIÓN - Chunks leídos después de guardar:", verificationChunks.length);
            console.log("VERIFICACIÓN - Primer chunk:", verificationChunks[0]);
        } catch (verificationError) {
            console.error("ERROR en verificación post-escritura:", verificationError);
        }
        
        console.log(`Chunks actualizados correctamente: ${chunks.length} chunks guardados en ${chunksPath}`);

        res.json({
            "status": "ok",
            "message": "Chunks actualizados"
        });

    } catch (error) {
        console.error("ERROR en /chunks:", error);
        console.error("Stack trace:", error.stack);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        res.status(500).json({
            "status": "error",
            "message": "Error guardando chunks"
        });
    }
});

// Manejo de rutas no existentes (404)
app.use((req, res) => {
    res.status(404).json({
        error: "Ruta no encontrada",
        message: `La ruta ${req.method} ${req.path} no existe`,
        availableEndpoints: {
            "GET /": "Test endpoint",
            "GET /health": "Health check",
            "POST /chat": "Chatbot endpoint",
            "GET /chunks": "Get chunks",
            "POST /chunks": "Save chunks"
        }
    });
});

// Manejo de errores generales
app.use((err, req, res, next) => {
    console.error("Error general:", err);
    res.status(500).json({
        error: "Error interno del servidor",
        message: "Ha ocurrido un error inesperado"
    });
});

// Configuración del puerto para Railway
const PORT = process.env.PORT;

console.log("Verificando PORT:", PORT);
console.log("Tipo de PORT:", typeof PORT);

if (!PORT) {
    console.error("ADVERTENCIA: process.env.PORT está undefined, usando fallback");
}

try {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`=== SERVIDOR INICIADO CORRECTAMENTE ===`);
        console.log(`Puerto: ${PORT}`);
        console.log(`Host: 0.0.0.0`);
        console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`Endpoints disponibles:`);
        console.log(`  GET  / - Test endpoint`);
        console.log(`  GET  /health - Health check`);
        console.log(`  POST /chat - Chatbot endpoint`);
        console.log(`  GET  /chunks - Get chunks`);
        console.log(`  POST /chunks - Save chunks`);
    });
} catch (error) {
    console.error("ERROR CRÍTICO al iniciar servidor:", error);
    console.error("Stack trace:", error.stack);
}