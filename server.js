const express = require("express");
const cors = require("cors");

const { handleUserQuery } = require("./chatbot-backend");

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
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ 
                error: "No message provided",
                message: "Se requiere el campo 'message' en el cuerpo de la petición"
            });
        }

        const response = await handleUserQuery(message);

        res.json({
            response: response
        });

    } catch (error) {
        console.error("Error en /chat:", error);
        res.status(500).json({
            error: "Error procesando la petición",
            message: "Ha ocurrido un error interno al procesar tu mensaje"
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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor chatbot activo en puerto ${PORT}`);
    console.log(`Endpoints disponibles:`);
    console.log(`  GET  / - Test endpoint`);
    console.log(`  GET  /health - Health check`);
    console.log(`  POST /chat - Chatbot endpoint`);
});