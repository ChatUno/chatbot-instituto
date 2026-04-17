/**
 * Script para arreglar paths de imports incorrectos
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Arregla paths de imports incorrectos en un archivo
 */
async function fixImportPaths(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        let updated = content;
        
        // Arreglar paths con "././"
        updated = updated.replace(/require\(['"]\.\/\.\/([^'"]+)['"]\)/g, (match, importPath) => {
            // Convertir "././file" a "../file" o "./file" según corresponda
            if (importPath.includes('/')) {
                return `require("../${importPath}")`;
            } else {
                return `require("./${importPath}")`;
            }
        });
        
        // Arreglar paths con "./../" que podrían ser incorrectos
        updated = updated.replace(/require\(['"]\.\/\.\.\/([^'"]+)['"]\)/g, (match, importPath) => {
            // Mantener "../" para ir al directorio padre
            return `require("../${importPath}")`;
        });
        
        // Arreglar imports from con "././"
        updated = updated.replace(/from ['"]\.\/\.\/([^'"]+)['"]/g, (match, importPath) => {
            if (importPath.includes('/')) {
                return `from "../${importPath}"`;
            } else {
                return `from "./${importPath}"`;
            }
        });
        
        // Guardar archivo actualizado
        if (updated !== content) {
            await fs.writeFile(filePath, updated, 'utf8');
            console.log(`Fixed import paths in: ${filePath}`);
        }
        
    } catch (error) {
        console.error(`Error fixing ${filePath}:`, error.message);
    }
}

/**
 * Encuentra todos los archivos JS para arreglar
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
    console.log('=== FIXING IMPORT PATHS ===\n');
    
    try {
        // Encontrar todos los archivos JS
        const jsFiles = await findAllJsFiles(process.cwd());
        
        console.log(`Found ${jsFiles.length} JavaScript files`);
        
        // Arreglar paths en cada archivo
        for (const file of jsFiles) {
            await fixImportPaths(file);
        }
        
        console.log('\n=== IMPORT PATHS FIXED ===');
        
    } catch (error) {
        console.error('Error fixing import paths:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixImportPaths, findAllJsFiles };
