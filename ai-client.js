// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const axios = require("axios");

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function getAIResponse(prompt) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: "Eres un asistente útil y preciso."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3
            },
            {
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data.choices[0].message.content;

    } catch (error) {
        console.error("Error llamando a la IA:", error.message);
        return "Lo siento, ha ocurrido un error al generar la respuesta.";
    }
}

module.exports = { getAIResponse };