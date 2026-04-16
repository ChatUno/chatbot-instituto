// Load environment variables from .env file in development only
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

const axios = require("axios");
const { getValidatedConfig } = require("./config");

const config = getValidatedConfig();
const GROQ_API_KEY = config.ai.apiKey;

async function getAIResponse(prompt) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: config.ai.model,
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
                temperature: config.ai.temperature
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