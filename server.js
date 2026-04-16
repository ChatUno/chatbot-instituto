const express = require("express");
const cors = require("cors");

const { handleUserQuery } = require("./chatbot-backend");

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint principal del chatbot
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "No message provided" });
        }

        const response = await handleUserQuery(message);

        res.json({
            response: response
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error procesando la petición"
        });
    }
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor chatbot activo en http://localhost:${PORT}`);
});