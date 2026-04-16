// SERVIDOR MÍNIMO PARA RAILWAY - SIN DEPENDENCIAS EXTERNAS
console.log("=== INICIANDO SERVIDOR MÍNIMO ===");

const express = require("express");

const app = express();

// Middleware básico
app.use(express.json());

// Root endpoint
app.get("/", (req, res) => {
    console.log("GET / llamado");
    res.send("Chatbot activo - MÍNIMO");
});

// Health check
app.get("/health", (req, res) => {
    console.log("GET /health llamado");
    res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        message: "Servidor mínimo funcionando"
    });
});

// Chat endpoint (respuesta fija)
app.post("/chat", (req, res) => {
    console.log("POST /chat llamado");
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ 
            error: "No message provided"
        });
    }

    res.json({
        response: "Respuesta mínima: " + message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: "Ruta no encontrada"
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

console.log("Iniciando servidor en puerto:", PORT);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`=== SERVIDOR MÍNIMO ACTIVO ===`);
    console.log(`Puerto: ${PORT}`);
    console.log(`Host: 0.0.0.0`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});

// Mantener proceso vivo
setInterval(() => {
    console.log("Servidor vivo - " + new Date().toISOString());
}, 30000); // Log cada 30 segundos
