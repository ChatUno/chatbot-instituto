const fs = require('fs')
const path = require('path')

const CHUNKS_PATH = path.join(__dirname, '../../../data/chunks.json')
const BACKUPS_DIR = path.join(__dirname, '../../../data/backups')

function readChunks() {
  try {
    if (!fs.existsSync(CHUNKS_PATH)) {
      return []
    }
    const data = fs.readFileSync(CHUNKS_PATH, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.warn('Warning: Failed to read chunks.json:', error.message)
    return []
  }
}

function saveChunks(chunks) {
  try {
    const tempPath = CHUNKS_PATH + '.tmp'
    fs.writeFileSync(tempPath, JSON.stringify(chunks, null, 2))
    fs.renameSync(tempPath, CHUNKS_PATH)
  } catch (error) {
    throw new Error(`Failed to save chunks: ${error.message}`)
  }
}

function createBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true })
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = path.join(BACKUPS_DIR, `chunks-${timestamp}.json`)
    
    if (fs.existsSync(CHUNKS_PATH)) {
      const chunksData = fs.readFileSync(CHUNKS_PATH, 'utf8')
      fs.writeFileSync(backupFile, chunksData)
    } else {
      fs.writeFileSync(backupFile, JSON.stringify([], null, 2))
    }
    
    return path.basename(backupFile)
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`)
  }
}

function mergeAndDeduplicate(existingChunks, newChunks) {
  const combined = [...existingChunks, ...newChunks]
  const seen = new Set()
  const deduplicated = []
  let maxId = 0
  
  // Find max existing ID
  existingChunks.forEach(chunk => {
    if (chunk.id && chunk.id > maxId) {
      maxId = chunk.id
    }
  })
  
  combined.forEach(chunk => {
    const key = chunk.text.trim().substring(0, 120)
    if (!seen.has(key)) {
      seen.add(key)
      // Assign new ID if needed
      if (!chunk.id) {
        chunk.id = ++maxId
      }
      deduplicated.push(chunk)
    }
  })
  
  return deduplicated
}

function exportChunks(approvedChunks) {
  if (approvedChunks.length === 0) {
    throw new Error('No hay chunks aprobados para exportar')
  }
  
  // Create backup first
  const backupFile = createBackup()
  
  // Read existing chunks
  const existingChunks = readChunks()
  
  // Transform approved chunks to chatbot format
  const transformedChunks = approvedChunks.map(chunk => ({
    id: null, // Will be assigned during merge
    text: chunk.editedText || chunk.text,
    source: 'ingestion-v51',
    quality: chunk.quality_score >= 80 ? 'excellent' 
             : chunk.quality_score >= 60 ? 'good' : 'low',
    score: parseFloat((chunk.quality_score / 100).toFixed(2)),
    category: chunk.category,
    lastOptimized: new Date().toISOString()
  }))
  
  // Merge and deduplicate
  const mergedChunks = mergeAndDeduplicate(existingChunks, transformedChunks)
  
  // Sort by ID
  mergedChunks.sort((a, b) => a.id - b.id)
  
  // Save
  saveChunks(mergedChunks)
  
  const skippedDuplicates = approvedChunks.length + existingChunks.length - mergedChunks.length
  
  return {
    exported: approvedChunks.length,
    totalAfter: mergedChunks.length,
    backupFile,
    skippedDuplicates
  }
}

function listBackups() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return []
    }
    
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith('chunks-') && file.endsWith('.json'))
      .sort((a, b) => {
        // Sort by timestamp descending
        const aTime = a.match(/chunks-(.+)\.json/)[1]
        const bTime = b.match(/chunks-(.+)\.json/)[1]
        return bTime.localeCompare(aTime)
      })
    
    return files
  } catch (error) {
    console.warn('Warning: Failed to list backups:', error.message)
    return []
  }
}

module.exports = {
  exportChunks,
  readChunks,
  createBackup,
  listBackups
}
