// DEBUG SERVER - Minimal version for Railway testing
console.log("=== INICIANDO SERVIDOR DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT);
console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);

const express = require("express");
const cors = require("cors");

console.log("Módulos cargados correctamente");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

console.log("Middleware configurado");

// Root endpoint for testing
app.get("/", (req, res) => {
    console.log("GET / llamado");
    res.send("Chatbot activo - DEBUG");
});

// Health check endpoint
app.get("/health", (req, res) => {
    console.log("GET /health llamado");
    res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        debug: {
            port: process.env.PORT,
            node_env: process.env.NODE_ENV,
            groq_key_exists: !!process.env.GROQ_API_KEY
        }
    });
});

// Minimal chat endpoint (sin IA)
app.post("/chat", async (req, res) => {
    console.log("POST /chat llamado - DEBUG VERSION");
    console.log("Body:", req.body);
    
    try {
        const { message } = req.body;
        console.log("Message recibido:", message);

        if (!message) {
            console.log("Error: No message provided");
            return res.status(400).json({ 
                error: "No message provided",
                message: "Se requiere el campo 'message' en el cuerpo de la petición"
            });
        }

        // Respuesta fija para testing
        const response = "Respuesta de prueba - DEBUG: " + message;
        console.log("Enviando respuesta:", response);

        res.json({
            response: response
        });

    } catch (error) {
        console.error("Error en /chat DEBUG:", error);
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
    console.log(`404: ${req.method} ${req.path}`);
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
    console.error("Error general DEBUG:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
        error: "Error interno del servidor",
        message: err.message,
        stack: err.stack
    });
});

// Configuración del puerto para Railway
const PORT = process.env.PORT;
console.log("PORT final:", PORT);

if (!PORT) {
    console.error("ERROR CRÍTICO: process.env.PORT está undefined");
    process.exit(1);
}

try {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`=== SERVIDOR DEBUG ACTIVO ===`);
        console.log(`Puerto: ${PORT}`);
        console.log(`Host: 0.0.0.0`);
        console.log(`Endpoints disponibles:`);
        console.log(`  GET  / - Test endpoint`);
        console.log(`  GET  /health - Health check`);
        console.log(`  POST /chat - Chatbot endpoint`);
    });
} catch (error) {
    console.error("ERROR CRÍTICO al iniciar servidor:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
}
