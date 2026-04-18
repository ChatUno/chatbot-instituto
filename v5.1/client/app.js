// V5.1 Visual RAG - Professional Client Application

class VisualRAGApp {
  constructor() {
    this.currentChunks = [];
    this.screenshotData = null;
    this.extractedData = null;
    this.apiBase = 'http://localhost:3002';
    
    this.initializeEventListeners();
    this.updateUI();
  }

  initializeEventListeners() {
    // Capture button
    document.getElementById('capture-btn').addEventListener('click', () => this.capturePage());
    
    // Extract button
    document.getElementById('extract-btn').addEventListener('click', () => this.extractText());
    
    // Generate chunks button
    document.getElementById('generate-btn').addEventListener('click', () => this.generateChunks());
    
    // Export button
    document.getElementById('export-btn').addEventListener('click', () => this.showExportModal());
    
    // Enter key on URL input
    document.getElementById('url-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.capturePage();
    });
  }

  async capturePage() {
    const urlInput = document.getElementById('url-input');
    const url = urlInput.value.trim();
    
    if (!url) {
      this.showStatus('Por favor, ingresa una URL válida', 'error');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showStatus('Por favor, ingresa una URL válida (http:// o https://)', 'error');
      return;
    }

    this.showLoading(true);
    this.showStatus('Capturando página...', 'warning');

    try {
      const response = await fetch(`${this.apiBase}/api/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      });

      const result = await response.json();

      if (result.success) {
        this.screenshotData = {
          screenshot: result.imageBase64,
          url: result.metadata.url,
          title: 'Captura de página',
          dimensions: { width: 1920, height: 1080 },
          timestamp: result.metadata.capturedAt
        };
        this.displayScreenshot(this.screenshotData);
        this.showStatus('Página capturada exitosamente', 'success');
        this.showSection('preview-section');
      } else {
        this.showStatus(result.error || 'Error al capturar la página', 'error');
      }
    } catch (error) {
      console.error('Capture error:', error);
      this.showStatus('Error de conexión al servidor', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async extractText() {
    console.log('[Frontend] Iniciando extracción de texto');
    if (!this.screenshotData) {
      console.log('[Frontend] Error: No hay screenshot data');
      this.showStatus('Primero captura una página', 'error');
      return;
    }

    console.log('[Frontend] Screenshot data disponible, iniciando loading');
    this.showLoading(true);
    this.showStatus('Extrayendo texto con IA...', 'warning');

    try {
      const response = await fetch(`${this.apiBase}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: this.screenshotData.screenshot
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('[Frontend] Extracción exitosa, guardando datos');
        this.extractedData = result.data;
        this.displayExtractedContent(result.data);
        this.showStatus('Texto extraído exitosamente', 'success');
        console.log('[Frontend] Mostrando sección extract-section');
        this.showSection('extract-section');
      } else {
        console.log('[Frontend] Error en extracción:', result.error);
        this.showStatus(result.error || 'Error al extraer texto', 'error');
      }
    } catch (error) {
      console.error('Extract error:', error);
      this.showStatus('Error de conexión al servidor', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async generateChunks() {
    if (!this.extractedData) {
      this.showStatus('Primero extrae el texto', 'error');
      return;
    }

    this.showLoading(true);
    this.showStatus('Generando chunks...', 'warning');

    try {
      const response = await fetch(`${this.apiBase}/api/chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: this.extractedData.text,
          sourceUrl: this.screenshotData.url
        })
      });

      const result = await response.json();

      if (result.success) {
        this.currentChunks = result.data.chunks;
        this.displayChunks(this.currentChunks);
        this.updateCounters();
        this.showStatus(`Se generaron ${result.data.chunks.length} chunks`, 'success');
        this.showSection('chunk-section');
        this.showSection('export-section');
      } else {
        this.showStatus(result.error || 'Error al generar chunks', 'error');
      }
    } catch (error) {
      console.error('Chunk generation error:', error);
      this.showStatus('Error de conexión al servidor', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  displayScreenshot(data) {
    const preview = document.getElementById('screenshot-preview');
    const metadata = document.getElementById('metadata');
    
    preview.src = data.screenshot;
    
    metadata.innerHTML = `
      <strong>URL:</strong> ${data.url}<br>
      <strong>Título:</strong> ${data.title}<br>
      <strong>Tamaño:</strong> ${data.dimensions.width}x${data.dimensions.height}<br>
      <strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}
    `;
  }

  displayExtractedContent(data) {
    const textContainer = document.getElementById('extracted-text');
    const linksContainer = document.getElementById('extracted-links');
    
    textContainer.textContent = data.text;
    
    if (data.links && data.links.length > 0) {
      linksContainer.innerHTML = '<strong>Enlaces encontrados:</strong><br>' +
        data.links.map(link => 
          `<a href="${link}" target="_blank" class="link-badge">${link}</a>`
        ).join('');
    } else {
      linksContainer.innerHTML = '<strong>No se encontraron enlaces</strong>';
    }
  }

  displayChunks(chunks) {
    const container = document.getElementById('chunks-container');
    
    container.innerHTML = chunks.map((chunk, index) => `
      <div class="chunk fade-in" data-index="${index}">
        <div class="chunk-header">
          <div class="chunk-info">
            <span class="chunk-category">${chunk.category}</span>
            <span class="chunk-score">${Math.round(chunk.quality_score)}%</span>
          </div>
          <div class="chunk-actions">
            <button class="chunk-btn approve" onclick="app.approveChunk(${index})" title="Aprobar">
              <i class="icon-check"></i>
            </button>
            <button class="chunk-btn reject" onclick="app.rejectChunk(${index})" title="Rechazar">
              <i class="icon-times"></i>
            </button>
            <button class="chunk-btn edit" onclick="app.editChunk(${index})" title="Editar">
              <i class="icon-edit"></i>
            </button>
          </div>
        </div>
        <div class="chunk-content">
          <div class="chunk-text" id="chunk-text-${index}">${chunk.text}</div>
          <div class="chunk-edit" id="chunk-edit-${index}" style="display:none">
            <textarea class="chunk-textarea" id="chunk-textarea-${index}">${chunk.text}</textarea>
            <div class="chunk-edit-actions">
              <button class="btn btn-success" onclick="app.saveChunk(${index})">
                <i class="icon-save"></i> Guardar
              </button>
              <button class="btn btn-secondary" onclick="app.cancelEdit(${index})">
                <i class="icon-times"></i> Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  approveChunk(index) {
    const chunk = this.currentChunks[index];
    chunk.status = 'approved';
    this.updateChunkUI(index);
    this.updateCounters();
  }

  rejectChunk(index) {
    const chunk = this.currentChunks[index];
    chunk.status = 'rejected';
    this.updateChunkUI(index);
    this.updateCounters();
  }

  editChunk(index) {
    const textElement = document.getElementById(`chunk-text-${index}`);
    const editElement = document.getElementById(`chunk-edit-${index}`);
    
    textElement.style.display = 'none';
    editElement.style.display = 'block';
    
    const textarea = document.getElementById(`chunk-textarea-${index}`);
    textarea.focus();
    textarea.select();
  }

  saveChunk(index) {
    const textarea = document.getElementById(`chunk-textarea-${index}`);
    const textElement = document.getElementById(`chunk-text-${index}`);
    const editElement = document.getElementById(`chunk-edit-${index}`);
    
    const chunk = this.currentChunks[index];
    chunk.editedText = textarea.value;
    chunk.status = 'edited';
    
    textElement.textContent = textarea.value;
    textElement.style.display = 'block';
    editElement.style.display = 'none';
    
    this.updateChunkUI(index);
    this.updateCounters();
  }

  cancelEdit(index) {
    const textElement = document.getElementById(`chunk-text-${index}`);
    const editElement = document.getElementById(`chunk-edit-${index}`);
    const textarea = document.getElementById(`chunk-textarea-${index}`);
    
    const chunk = this.currentChunks[index];
    textarea.value = chunk.editedText || chunk.text;
    
    textElement.style.display = 'block';
    editElement.style.display = 'none';
  }

  updateChunkUI(index) {
    const chunkElement = document.querySelector(`[data-index="${index}"]`);
    const chunk = this.currentChunks[index];
    
    // Remove all status classes
    chunkElement.classList.remove('status-approved', 'status-rejected', 'status-pending');
    
    // Add appropriate status class
    if (chunk.status === 'approved') {
      chunkElement.classList.add('status-approved');
    } else if (chunk.status === 'rejected') {
      chunkElement.classList.add('status-rejected');
    } else {
      chunkElement.classList.add('status-pending');
    }
    
    // Add quality class
    chunkElement.classList.remove('quality-excellent', 'quality-good', 'quality-low');
    if (chunk.quality_score >= 80) {
      chunkElement.classList.add('quality-excellent');
    } else if (chunk.quality_score >= 60) {
      chunkElement.classList.add('quality-good');
    } else {
      chunkElement.classList.add('quality-low');
    }
  }

  updateCounters() {
    const approved = this.currentChunks.filter(c => c.status === 'approved').length;
    const rejected = this.currentChunks.filter(c => c.status === 'rejected').length;
    const edited = this.currentChunks.filter(c => c.status === 'edited').length;
    
    document.getElementById('chunks-count').textContent = this.currentChunks.length;
    document.getElementById('approved-count').textContent = approved;
    document.getElementById('rejected-count').textContent = rejected;
    document.getElementById('edited-count').textContent = edited;
  }

  showExportModal() {
    const approved = this.currentChunks.filter(c => c.status === 'approved');
    
    if (approved.length === 0) {
      this.showStatus('No hay chunks aprobados para exportar', 'error');
      return;
    }
    
    document.getElementById('export-count').textContent = approved.length;
    document.getElementById('confirm-modal').style.display = 'flex';
  }

  async confirmExport() {
    const approved = this.currentChunks.filter(c => c.status === 'approved');
    
    this.closeModal();
    this.showLoading(true);
    this.showStatus('Exportando chunks...', 'warning');

    try {
      const response = await fetch(`${this.apiBase}/api/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chunks: approved
        })
      });

      const result = await response.json();

      if (result.success) {
        const data = result.data;
        this.showStatus(
          `Exportación exitosa: ${data.exported} chunks exportados, ${data.totalAfter} totales en DB`, 
          'success'
        );
        this.displayDBStatus(data);
        this.resetUI();
      } else {
        this.showStatus(result.error || 'Error al exportar', 'error');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showStatus('Error de conexión al servidor', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  displayDBStatus(data) {
    const statusElement = document.getElementById('db-status');
    statusElement.innerHTML = `
      <h4><i class="icon-database"></i> Estado de la Base de Datos</h4>
      <p><strong>Chunks exportados:</strong> ${data.exported}</p>
      <p><strong>Total chunks en DB:</strong> ${data.totalAfter}</p>
      <p><strong>Duplicados omitidos:</strong> ${data.skippedDuplicates}</p>
      <p><strong>Backup creado:</strong> ${data.backupFile}</p>
    `;
  }

  resetUI() {
    // Clear current data
    this.currentChunks = [];
    this.screenshotData = null;
    this.extractedData = null;
    
    // Reset form
    document.getElementById('url-input').value = '';
    
    // Hide sections except input
    this.hideSection('preview-section');
    this.hideSection('extract-section');
    this.hideSection('chunk-section');
    this.hideSection('export-section');
    
    // Clear displays
    document.getElementById('screenshot-preview').src = '';
    document.getElementById('metadata').innerHTML = '';
    document.getElementById('extracted-text').textContent = '';
    document.getElementById('extracted-links').innerHTML = '';
    document.getElementById('chunks-container').innerHTML = '';
    document.getElementById('db-status').innerHTML = '';
    
    // Reset counters
    this.updateCounters();
  }

  closeModal() {
    document.getElementById('confirm-modal').style.display = 'none';
  }

  showSection(sectionId) {
    console.log(`[Frontend] Mostrando sección: ${sectionId}`);
    const section = document.getElementById(sectionId);
    if (section) {
      console.log(`[Frontend] Sección encontrada, cambiando display a block`);
      section.style.display = 'block';
      section.classList.add('fade-in');
      console.log(`[Frontend] Sección ${sectionId} visible`);
    } else {
      console.error(`[Frontend] No se encontró la sección: ${sectionId}`);
    }
  }

  hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
    }
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        if (statusElement.textContent === message) {
          statusElement.className = 'status-message';
        }
      }, 5000);
    }
  }

  showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  updateUI() {
    this.updateCounters();
  }

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }
}

// Global functions for onclick handlers
window.app = new VisualRAGApp();
window.closeModal = () => window.app.closeModal();
window.confirmExport = () => window.app.confirmExport();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('V5.1 Visual RAG App initialized');
});
