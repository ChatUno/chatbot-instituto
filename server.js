console.log("=== INICIANDO SERVIDOR ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);

const express = require("express");
const cors = require("cors");

console.log("Módulos Express y CORS cargados");

try {
    const { handleUserQuery } = require("./chatbot-backend");
    console.log("handleUserQuery importado correctamente");
} catch (error) {
    console.error("ERROR CRÍTICO importando handleUserQuery:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
}

const app = express();

// Middleware
app.use(cors());
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
            health: "GET /health"
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

// Manejo de rutas no existentes (404)
app.use((req, res) => {
    res.status(404).json({
        error: "Ruta no encontrada",
        message: `La ruta ${req.method} ${req.path} no existe`,
        availableEndpoints: {
            "GET /": "Test endpoint",
            "GET /health": "Health check",
            "POST /chat": "Chatbot endpoint"
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
    });
} catch (error) {
    console.error("ERROR CRÍTICO al iniciar servidor:", error);
    console.error("Stack trace:", error.stack);
}