console.log("=== INICIANDO SERVIDOR ===");

console.log("NODE_ENV:", process.env.NODE_ENV);

console.log("PORT:", process.env.PORT);

console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);



const { getAIResponse } = require("./core/ai-client");

const express = require("express");

const cors = require("cors");

const rateLimit = require("express-rate-limit");

const { ResponsePolishingSystem } = require("./services/response-polishing-service");

const { 

    validateChatRequest, 

    validateChunksRequest, 

    validateChunksQuery,

    configurationSanityCheck 

} = require("./security/validation");

const { semanticSearch, buildContextFromResults } = require("./services/search-service");

const { createAuthService, createAuthMiddleware } = require("./security/auth");

const { createErrorHandler, createValidationError, createAuthenticationError, createNotFoundError } = require("./security/error-handler");

const { createFallbackLogicManager } = require("./core/fallback-logic-manager");

const { createInputSanitizer, createSanitizationMiddleware } = require("./security/input-sanitizer");



console.log("Módulos Express y CORS cargados");



let handleUserQuery;



try {

    console.log("Intentando importar chatbot-backend...");

    const backend = require("./core/chatbot-backend");

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

    'https://chatbot-instituto-8qes.vercel.app',

    'https://chatbot-instituto-57zd.vercel.app',

    'https://chatbot-instituto.vercel.app',

    'https://chatbot-instituto-production.up.railway.app',

    'http://localhost:3000',

    'http://localhost:5500'

  ],

  methods: ['GET', 'POST'],

  allowedHeaders: ['Content-Type', 'Authorization'],

  credentials: true

}));



// Rate limiting middleware to prevent DoS attacks

const limiter = rateLimit({

  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 100, // Limit each IP to 100 requests per windowMs

  message: {

    error: "Too many requests from this IP, please try again later.",

    retryAfter: "15 minutes"

  },

  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers

  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  handler: (req, res) => {

    console.log(`Rate limit exceeded for IP: ${req.ip}`);

    res.status(429).json({

      error: "Too many requests from this IP, please try again later.",

      retryAfter: "15 minutes"

    });

  }

});



app.use(limiter);

app.use(express.json());



// Initialize authentication

const authService = createAuthService();

const authMiddleware = createAuthMiddleware(authService);



// Initialize error handler

const errorHandler = createErrorHandler();



// Initialize input sanitizer

const inputSanitizer = createInputSanitizer({

    maxLength: 1000,

    maxTokens: 200,

    strictMode: false, // Enable in production for stricter security

    logAttacks: true

});



app.use(createSanitizationMiddleware(inputSanitizer));



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

            postChunks: "POST /chunks",

            login: "POST /auth/login"

        }

    });

});



// Temporary login endpoint for testing

app.post("/auth/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        

        // Simple validation for testing

        if (email === 'test@test.com' && password === 'test123') {

            const token = authService.generateToken({

                email: email,

                userId: 'test-user',

                permissions: ['read']

            });

            

            res.json({

                success: true,

                token: token,

                user: {

                    email: email,

                    userId: 'test-user'

                }

            });

        } else {

            res.status(401).json({

                success: false,

                error: "Invalid credentials"

            });

        }

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({

            success: false,

            error: "Login failed"

        });

    }

});



// Endpoint principal del chatbot (protegido)

app.post("/chat", authMiddleware.authenticate({ required: true, permissions: ['read'] }), validateChatRequest, async (req, res) => {

    console.log("=== POST /chat llamado ===");

    console.log("Headers:", req.headers);

    console.log("Body:", req.body);

    

    try {

        const { message } = req.body;

        console.log("Message validado:", message);



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

        const chunksPath = path.join(__dirname, '..', 'data', 'chunks.json');

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



// Endpoint para diagnóstico de chunks

app.get("/debug-chunks", async (req, res) => {

    console.log("=== GET /debug-chunks llamado ===");

    

    try {

        const fs = require('fs');

        const path = require('path');

        

        const chunksPath = path.join(__dirname, '..', 'data', 'chunks.json');

        console.log("DEBUG - Chunks path:", chunksPath);

        console.log("DEBUG - File exists:", fs.existsSync(chunksPath));

        

        if (fs.existsSync(chunksPath)) {

            const fileData = fs.readFileSync(chunksPath, 'utf8');

            const chunks = JSON.parse(fileData);

            

            res.json({

                "status": "ok",

                "debug": {

                    "path": chunksPath,

                    "cwd": process.cwd(),

                    "dirname": __dirname,

                    "fileExists": true,

                    "fileSize": fileData.length,

                    "chunksCount": chunks.length,

                    "firstChunk": chunks[0],

                    "lastChunk": chunks[chunks.length - 1]

                }

            });

        } else {

            res.json({

                "status": "error",

                "debug": {

                    "path": chunksPath,

                    "cwd": process.cwd(),

                    "dirname": __dirname,

                    "fileExists": false

                }

            });

        }

        

    } catch (error) {

        console.error("ERROR en /debug-chunks:", error);

        res.status(500).json({

            "status": "error",

            "message": "Error en diagnóstico",

            "error": error.message

        });

    }

});



// Endpoint para guardar chunks (protegido)

app.post("/chunks", authMiddleware.authenticate({ required: true, permissions: ['write'] }), validateChunksRequest, async (req, res) => {

    console.log("=== POST /chunks llamado ===");

    console.log("Request headers:", req.headers);

    console.log("Request body:", req.body);

    console.log("CHUNKS PATH:", require('path').resolve(__dirname, 'chunks.json'));

    console.log("CWD:", process.cwd());

    console.log("__DIRNAME:", __dirname);

    

    try {

        const { chunks } = req.body;

        console.log("Chunks validados:", chunks);

        console.log("Número de chunks:", chunks ? chunks.length : 0);



        const fs = require('fs');

        const path = require('path');

        

        // RUTA ABSOLUTA CRÍTICA

        const chunksPath = path.join(__dirname, '..', 'data', 'chunks.json');

        const lockPath = path.join(__dirname, '..', 'data', 'chunks.json.lock');

        console.log("RUTA ABSOLUTA chunks.json:", chunksPath);

        

        // IMPLEMENTAR FILE LOCKING

        const lockTimeout = 10000; // 10 segundos timeout

        const lockRetryInterval = 100; // 100ms entre reintentos

        const maxRetries = lockTimeout / lockRetryInterval;

        

        let retries = 0;

        while (retries < maxRetries) {

            try {

                // Intentar crear lock file (operación atómica)

                fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });

                console.log("Lock adquirido para chunks.json");

                break; // Lock adquirido exitosamente

            } catch (error) {

                if (error.code === 'EEXIST') {

                    // Lock ya existe, esperar y reintentar

                    retries++;

                    if (retries >= maxRetries) {

                        throw new Error("No se pudo adquirir lock para chunks.json después de 10 segundos");

                    }

                    await new Promise(resolve => setTimeout(resolve, lockRetryInterval));

                    continue;

                } else {

                    throw error; // Otro error

                }

            }

        }

        

        try {

            // ESCRITURA ROBUSTA CON LOCK

            const jsonData = JSON.stringify(chunks, null, 2);

            console.log("JSON data length:", jsonData.length);

            

            fs.writeFileSync(chunksPath, jsonData, 'utf8');

            console.log("Chunks escritos con writeFileSync en:", chunksPath);

            

            // VERIFICACIÓN POST-GUARDADO

            try {

                const verificationData = fs.readFileSync(chunksPath, 'utf8');

                console.log("VERIFICACIÓN - Archivo leído, length:", verificationData.length);

                console.log("VERIFICACIÓN - Primer 100 chars:", verificationData.substring(0, 100));

                

                const verificationChunks = JSON.parse(verificationData);

                console.log("VERIFICACIÓN - Chunks verificados:", verificationChunks.length);

                console.log("VERIFICACIÓN - Chunk 1:", verificationChunks[0]);

            } catch (verificationError) {

                console.error("ERROR EN VERIFICACIÓN:", verificationError);

            }

            

        } finally {

            // LIBERAR LOCK SIEMPRE

            try {

                fs.unlinkSync(lockPath);

                console.log("Lock liberado para chunks.json");

            } catch (unlockError) {

                console.error("Error liberando lock:", unlockError.message);

            }

        }

        

        console.log(`Chunks actualizados correctamente: ${chunks.length} chunks guardados`);



        res.json({

            "status": "ok",

            "message": "Chunks actualizados"

        });



    } catch (error) {

        console.error("ERROR CRÍTICO en /chunks:", error);

        console.error("ERROR CODE:", error.code);

        console.error("ERROR MESSAGE:", error.message);

        console.error("ERROR STACK:", error.stack);

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



// Comprehensive error handling middleware

app.use((err, req, res, next) => {

    errorHandler.handleError(err, req, res, next);

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