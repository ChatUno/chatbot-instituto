/**
 * File System Abstraction Layer - Chatbot IES Juan de Lanuza V4
 * Permite testing con mocks y flexibilidad para diferentes storage backends
 */

const fs = require('fs');
const path = require('path');

/**
 * Interfaz del servicio de archivos
 */
class IFileSystemService {
    /**
     * Lee un archivo de forma síncrona
     * @param {string} filePath - Ruta del archivo
     * @param {string} encoding - Codificación
     * @returns {string} Contenido del archivo
     */
    readFileSync(filePath, encoding = 'utf8') {
        throw new Error('Method not implemented');
    }

    /**
     * Lee un archivo de forma asíncrona
     * @param {string} filePath - Ruta del archivo
     * @param {string} encoding - Codificación
     * @returns {Promise<string>} Contenido del archivo
     */
    async readFile(filePath, encoding = 'utf8') {
        throw new Error('Method not implemented');
    }

    /**
     * Escribe un archivo de forma síncrona
     * @param {string} filePath - Ruta del archivo
     * @param {string} data - Datos a escribir
     * @param {string} encoding - Codificación
     */
    writeFileSync(filePath, data, encoding = 'utf8') {
        throw new Error('Method not implemented');
    }

    /**
     * Escribe un archivo de forma asíncrona
     * @param {string} filePath - Ruta del archivo
     * @param {string} data - Datos a escribir
     * @param {string} encoding - Codificación
     * @returns {Promise<void>}
     */
    async writeFile(filePath, data, encoding = 'utf8') {
        throw new Error('Method not implemented');
    }

    /**
     * Verifica si un archivo existe
     * @param {string} filePath - Ruta del archivo
     * @returns {boolean}
     */
    existsSync(filePath) {
        throw new Error('Method not implemented');
    }

    /**
     * Elimina un archivo de forma síncrona
     * @param {string} filePath - Ruta del archivo
     */
    unlinkSync(filePath) {
        throw new Error('Method not implemented');
    }

    /**
     * Crea un directorio de forma síncrona
     * @param {string} dirPath - Ruta del directorio
     * @param {Object} options - Opciones
     */
    mkdirSync(dirPath, options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Escribe un archivo con atomic write (para locking)
     * @param {string} filePath - Ruta del archivo
     * @param {string} data - Datos a escribir
     * @param {Object} options - Opciones
     */
    writeAtomicSync(filePath, data, options = {}) {
        throw new Error('Method not implemented');
    }
}

/**
 * Implementación real del sistema de archivos (Node.js fs)
 */
class NodeFileSystemService extends IFileSystemService {
    readFileSync(filePath, encoding = 'utf8') {
        return fs.readFileSync(filePath, encoding);
    }

    async readFile(filePath, encoding = 'utf8') {
        return fs.promises.readFile(filePath, encoding);
    }

    writeFileSync(filePath, data, encoding = 'utf8') {
        return fs.writeFileSync(filePath, data, encoding);
    }

    async writeFile(filePath, data, encoding = 'utf8') {
        return fs.promises.writeFile(filePath, data, encoding);
    }

    existsSync(filePath) {
        return fs.existsSync(filePath);
    }

    unlinkSync(filePath) {
        return fs.unlinkSync(filePath);
    }

    mkdirSync(dirPath, options = {}) {
        return fs.mkdirSync(dirPath, options);
    }

    writeAtomicSync(filePath, data, options = {}) {
        // Implementación de escritura atómica usando flag 'wx'
        return fs.writeFileSync(filePath, data, { flag: 'wx', ...options });
    }
}

/**
 * Implementación mock para testing
 */
class MockFileSystemService extends IFileSystemService {
    constructor() {
        super();
        this.files = new Map();
        this.directories = new Set();
    }

    readFileSync(filePath, encoding = 'utf8') {
        if (!this.files.has(filePath)) {
            const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
            error.code = 'ENOENT';
            throw error;
        }
        return this.files.get(filePath);
    }

    async readFile(filePath, encoding = 'utf8') {
        return this.readFileSync(filePath, encoding);
    }

    writeFileSync(filePath, data, encoding = 'utf8') {
        this.files.set(filePath, data);
        
        // Asegurar que el directorio padre existe
        const dirPath = path.dirname(filePath);
        if (dirPath !== '.' && !this.directories.has(dirPath)) {
            this.directories.add(dirPath);
        }
    }

    async writeFile(filePath, data, encoding = 'utf8') {
        this.writeFileSync(filePath, data, encoding);
    }

    existsSync(filePath) {
        return this.files.has(filePath) || this.directories.has(filePath);
    }

    unlinkSync(filePath) {
        if (!this.files.has(filePath)) {
            const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`);
            error.code = 'ENOENT';
            throw error;
        }
        this.files.delete(filePath);
    }

    mkdirSync(dirPath, options = {}) {
        this.directories.add(dirPath);
    }

    writeAtomicSync(filePath, data, options = {}) {
        // Para el mock, writeAtomic es igual a writeFileSync
        this.writeFileSync(filePath, data);
    }

    /**
     * Métodos de utilidad para testing
     */
    getFile(filePath) {
        return this.files.get(filePath);
    }

    getAllFiles() {
        return new Map(this.files);
    }

    clear() {
        this.files.clear();
        this.directories.clear();
    }

    setFile(filePath, content) {
        this.files.set(filePath, content);
    }
}

/**
 * File System Manager con locking integrado
 */
class FileSystemManager {
    constructor(fileSystemService) {
        this.fs = fileSystemService;
    }

    /**
     * Lee chunks JSON con manejo de errores
     * @param {string} chunksPath - Ruta al archivo chunks
     * @returns {Array} Array de chunks
     */
    async readChunks(chunksPath) {
        try {
            const chunksData = await this.fs.readFile(chunksPath, 'utf8');
            return JSON.parse(chunksData);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Chunks file not found: ${chunksPath}`);
            } else if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON in chunks file: ${chunksPath}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Escribe chunks con locking atómico
     * @param {string} chunksPath - Ruta al archivo chunks
     * @param {Array} chunks - Datos de chunks
     * @param {string} lockPath - Ruta al archivo de lock
     * @param {Object} options - Opciones de locking
     */
    async writeChunksWithLock(chunksPath, chunks, lockPath, options = {}) {
        const {
            lockTimeout = 10000,
            lockRetryInterval = 100,
            maxRetries = lockTimeout / lockRetryInterval
        } = options;

        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                // Intentar crear lock file (operación atómica)
                this.fs.writeAtomicSync(lockPath, process.pid.toString());
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
            
            this.fs.writeFileSync(chunksPath, jsonData, 'utf8');
            console.log("Chunks escritos en:", chunksPath);
            
            // VERIFICACIÓN POST-GUARDADO
            try {
                const verificationData = this.fs.readFileSync(chunksPath, 'utf8');
                console.log("VERIFICACIÓN - Archivo leído, length:", verificationData.length);
                
                const verificationChunks = JSON.parse(verificationData);
                console.log("VERIFICACIÓN - Chunks verificados:", verificationChunks.length);
                return verificationChunks;
            } catch (verificationError) {
                console.error("ERROR EN VERIFICACIÓN:", verificationError);
                throw verificationError;
            }
            
        } finally {
            // LIBERAR LOCK SIEMPRE
            try {
                this.fs.unlinkSync(lockPath);
                console.log("Lock liberado para chunks.json");
            } catch (unlockError) {
                console.error("Error liberando lock:", unlockError.message);
            }
        }
    }

    /**
     * Asegura que un directorio exista
     * @param {string} dirPath - Ruta del directorio
     */
    ensureDirectory(dirPath) {
        if (!this.fs.existsSync(dirPath)) {
            this.fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Lee archivo con fallback a valor por defecto
     * @param {string} filePath - Ruta del archivo
     * @param {*} defaultValue - Valor por defecto si no existe
     * @returns {*} Contenido del archivo o valor por defecto
     */
    readWithDefault(filePath, defaultValue = null) {
        try {
            return this.fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                return defaultValue;
            }
            throw error;
        }
    }
}

/**
 * Factory para crear el servicio de archivos apropiado
 */
function createFileSystemService(env = process.env.NODE_ENV) {
    if (env === 'test') {
        return new MockFileSystemService();
    } else {
        return new NodeFileSystemService();
    }
}

/**
 * Factory para crear el manager de archivos
 */
function createFileSystemManager(fileSystemService = null) {
    const fsService = fileSystemService || createFileSystemService();
    return new FileSystemManager(fsService);
}

module.exports = {
    IFileSystemService,
    NodeFileSystemService,
    MockFileSystemService,
    FileSystemManager,
    createFileSystemService,
    createFileSystemManager
};
