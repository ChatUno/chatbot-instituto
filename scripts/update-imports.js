/**
 * Script para actualizar imports después de la reorganización
 */

const fs = require('fs').promises;
const path = require('path');

// Mapeo de archivos antiguos a nuevos
const fileMapping = {
    'ai-client.js': './core/ai-client',
    'auth.js': './security/auth',
    'circuit-breaker.js': './security/circuit-breaker',
    'chunk-quality-manager.js': './quality/chunk-quality-manager',
    'config.js': './utils/config',
    'container.js': './utils/container',
    'embedding.js': './services/embedding-service',
    'error-handler.js': './security/error-handler',
    'fallback-logic-manager.js': './core/fallback-logic-manager',
    'filesystem.js': './utils/file-utils',
    'input-sanitizer.js': './security/input-sanitizer',
    'memory-system.js': './services/memory-service',
    'observability.js': './services/observability-service',
    'prompt-system.js': './services/prompt-service',
    'response-polishing.js': './services/response-polishing-service',
    'search.js': './services/search-service',
    'validation.js': './security/validation'
};

/**
 * Actualiza imports en un archivo
 */
async function updateImportsInFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        let updated = content;
        
        // Actualizar cada import
        for (const [oldFile, newImport] of Object.entries(fileMapping)) {
            // Patrones de import
            const patterns = [
                new RegExp(`require\\(['"]\\./${oldFile.replace('.js', '')}['"]\\)`, 'g'),
                new RegExp(`require\\(['"]\\.${oldFile.replace('.js', '')}['"]\\)`, 'g'),
                new RegExp(`from ['"]\\./${oldFile.replace('.js', '')}['"]`, 'g'),
                new RegExp(`from ['"]\\.${oldFile.replace('.js', '')}['"]`, 'g')
            ];
            
            patterns.forEach(pattern => {
                updated = updated.replace(pattern, match => {
                    if (match.includes('require')) {
                        return match.replace(oldFile.replace('.js', ''), newImport);
                    } else {
                        return match.replace(oldFile.replace('.js', ''), newImport);
                    }
                });
            });
        }
        
        // Guardar archivo actualizado
        if (updated !== content) {
            await fs.writeFile(filePath, updated, 'utf8');
            console.log(`Updated imports in: ${filePath}`);
        }
        
    } catch (error) {
        console.error(`Error updating ${filePath}:`, error.message);
    }
}

/**
 * Encuentra todos los archivos JS para actualizar
 */
async function findAllJsFiles(dir) {
    const files = [];
    
    async function scan(currentDir) {
        const items = await fs.readdir(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                await scan(fullPath);
            } else if (item.endsWith('.js')) {
                files.push(fullPath);
            }
        }
    }
    
    await scan(dir);
    return files;
}

/**
 * Función principal
 */
async function main() {
    console.log('=== UPDATING IMPORTS AFTER REORGANIZATION ===\n');
    
    try {
        // Encontrar todos los archivos JS
        const jsFiles = await findAllJsFiles(process.cwd());
        
        console.log(`Found ${jsFiles.length} JavaScript files`);
        
        // Actualizar imports en cada archivo
        for (const file of jsFiles) {
            await updateImportsInFile(file);
        }
        
        console.log('\n=== IMPORTS UPDATE COMPLETED ===');
        
    } catch (error) {
        console.error('Error updating imports:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { updateImportsInFile, findAllJsFiles };
