// V5.1 Visual RAG - Professional Frontend Application
// Complete implementation with state management, error handling, and modern UI

class VisualRAGApp {
  constructor() {
    // Application State
    this.state = {
      currentStep: 1,
      loading: false,
      screenshotData: null,
      extractedData: null,
      chunks: [],
      selectedChunks: new Set(),
      dbStatus: null,
      backups: [],
      
      // UI State
      activeTab: 'text',
      activeFilter: 'all',
      
      // Settings
      settings: {
        chunkSize: 'medium',
        chunkOverlap: 'small'
      }
    };
    
    // API Configuration
    this.apiBase = 'http://localhost:3002';
    
    // Initialize application
    this.init();
  }

  async init() {
    try {
      // Hide loading screen
      await this.hideLoadingScreen();
      
      // Initialize event listeners
      this.initializeEventListeners();
      
      // Load initial data
      await this.loadInitialData();
      
      // Show first step
      this.showStep(1);
      
      console.log('[V5.1] Application initialized successfully');
    } catch (error) {
      console.error('[V5.1] Initialization failed:', error);
      this.showToast('Error al inicializar la aplicación', 'error');
    }
  }

  async hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const progressFill = loadingScreen.querySelector('.progress-fill');
    const progressText = loadingScreen.querySelector('.progress-text');
    
    // Simulate loading progress
    const steps = ['Verificando sistema...', 'Cargando componentes...', 'Listo!'];
    for (let i = 0; i < steps.length; i++) {
      progressText.textContent = steps[i];
      progressFill.style.width = `${(i + 1) * 33}%`;
      await this.delay(500);
    }
    
    loadingScreen.classList.add('fade-out');
    await this.delay(500);
    loadingScreen.style.display = 'none';
  }

  initializeEventListeners() {
    // Navigation
    document.getElementById('capture-btn')?.addEventListener('click', () => this.capturePage());
    document.getElementById('extract-btn')?.addEventListener('click', () => this.extractText());
    document.getElementById('generate-chunks-btn')?.addEventListener('click', () => this.generateChunks());
    document.getElementById('export-btn')?.addEventListener('click', () => this.showExportModal());
    
    // Settings
    document.getElementById('status-btn')?.addEventListener('click', () => this.showDBStatus());
    document.getElementById('settings-btn')?.addEventListener('click', () => this.showSettings());
    
    // Form inputs
    document.getElementById('url-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.capturePage();
    });
    
    // Chunking controls
    document.getElementById('chunk-size')?.addEventListener('change', (e) => {
      this.state.settings.chunkSize = e.target.value;
    });
    
    document.getElementById('chunk-overlap')?.addEventListener('change', (e) => {
      this.state.settings.chunkOverlap = e.target.value;
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
    
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.filterChunks(e.target.dataset.filter));
    });
    
    // Bulk actions
    document.getElementById('select-all-btn')?.addEventListener('click', () => this.selectAllChunks());
    document.getElementById('approve-selected-btn')?.addEventListener('click', () => this.approveSelectedChunks());
    document.getElementById('reject-selected-btn')?.addEventListener('click', () => this.rejectSelectedChunks());
    
    // Modal
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('view-backups-btn')?.addEventListener('click', () => this.viewBackups());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  async loadInitialData() {
    try {
      // Load database status
      await this.loadDBStatus();
      
      // Load backups
      await this.loadBackups();
    } catch (error) {
      console.warn('[V5.1] Could not load initial data:', error);
    }
  }

  // Navigation Methods
  showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.step-section').forEach(section => {
      section.classList.remove('active');
    });
    
    // Show current step
    const currentSection = document.getElementById(`step-${stepNumber}`);
    if (currentSection) {
      currentSection.classList.add('active');
    }
    
    // Update progress indicator
    this.updateProgressIndicator(stepNumber);
    
    // Update state
    this.state.currentStep = stepNumber;
    
    // Load step-specific data
    this.loadStepData(stepNumber);
  }

  updateProgressIndicator(currentStep) {
    document.querySelectorAll('.step').forEach((step, index) => {
      const stepNumber = index + 1;
      
      step.classList.remove('active', 'completed');
      
      if (stepNumber === currentStep) {
        step.classList.add('active');
      } else if (stepNumber < currentStep) {
        step.classList.add('completed');
      }
    });
  }

  async loadStepData(stepNumber) {
    switch (stepNumber) {
      case 5:
        await this.loadDBStatus();
        this.updateExportSummary();
        break;
    }
  }

  // API Methods
  async capturePage() {
    const urlInput = document.getElementById('url-input');
    const url = urlInput.value.trim();
    
    if (!this.validateURL(url)) {
      this.showToast('Por favor, ingresa una URL válida', 'error');
      return;
    }
    
    this.setLoading(true, 'Capturando página...');
    
    try {
      const response = await fetch(`${this.apiBase}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.state.screenshotData = {
          screenshot: result.imageBase64,
          url: result.metadata.url,
          title: 'Captura de página',
          dimensions: { width: 1920, height: 1080 },
          timestamp: result.metadata.capturedAt,
          sizeBytes: result.metadata.sizeBytes
        };
        
        this.displayScreenshot();
        this.showToast('Página capturada exitosamente', 'success');
        this.showStep(2);
      } else {
        this.showToast(result.error || 'Error al capturar la página', 'error');
      }
    } catch (error) {
      console.error('[V5.1] Capture error:', error);
      this.showToast('Error de conexión al servidor', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async extractText() {
    if (!this.state.screenshotData) {
      this.showToast('Primero captura una página', 'error');
      return;
    }
    
    this.setLoading(true, 'Extrayendo texto con IA...');
    
    try {
      const response = await fetch(`${this.apiBase}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: this.state.screenshotData.screenshot
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.state.extractedData = result.data;
        this.displayExtractedContent();
        this.showToast('Texto extraído exitosamente', 'success');
        this.showStep(3);
      } else {
        this.showToast(result.error || 'Error al extraer texto', 'error');
      }
    } catch (error) {
      console.error('[V5.1] Extract error:', error);
      this.showToast('Error de conexión al servidor', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async generateChunks() {
    if (!this.state.extractedData) {
      this.showToast('Primero extrae el texto', 'error');
      return;
    }
    
    this.setLoading(true, 'Generando chunks semánticos...');
    
    try {
      const response = await fetch(`${this.apiBase}/api/chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: this.state.extractedData.text,
          sourceUrl: this.state.screenshotData.url
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.state.chunks = result.data.chunks.map(chunk => ({
          ...chunk,
          status: 'pending',
          selected: false,
          editedText: null
        }));
        
        this.displayChunks();
        this.displayReviewChunks();
        this.showToast(`Se generaron ${result.data.chunks.length} chunks`, 'success');
        this.showStep(4);
      } else {
        this.showToast(result.error || 'Error al generar chunks', 'error');
      }
    } catch (error) {
      console.error('[V5.1] Chunk generation error:', error);
      this.showToast('Error de conexión al servidor', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async exportChunks() {
    const approvedChunks = this.state.chunks.filter(chunk => chunk.status === 'approved');
    
    if (approvedChunks.length === 0) {
      this.showToast('No hay chunks aprobados para exportar', 'error');
      return;
    }
    
    this.setLoading(true, 'Exportando chunks a la base de datos...');
    
    try {
      const response = await fetch(`${this.apiBase}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunks: approvedChunks
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.displayExportResults(result.data);
        this.showToast('Chunks exportados exitosamente', 'success');
        
        // Reset for new session
        this.resetSession();
      } else {
        this.showToast(result.error || 'Error al exportar', 'error');
      }
    } catch (error) {
      console.error('[V5.1] Export error:', error);
      this.showToast('Error de conexión al servidor', 'error');
    } finally {
      this.setLoading(false);
      this.closeModal();
    }
  }

  async loadDBStatus() {
    try {
      const response = await fetch(`${this.apiBase}/api/export/status`);
      const result = await response.json();
      
      if (result.success) {
        this.state.dbStatus = result.data;
      }
    } catch (error) {
      console.warn('[V5.1] Could not load DB status:', error);
    }
  }

  async loadBackups() {
    try {
      const response = await fetch(`${this.apiBase}/api/export/backups`);
      const result = await response.json();
      
      if (result.success) {
        this.state.backups = result.data.backups;
      }
    } catch (error) {
      console.warn('[V5.1] Could not load backups:', error);
    }
  }

  // Display Methods
  displayScreenshot() {
    const preview = document.getElementById('screenshot-preview');
    if (!preview || !this.state.screenshotData) return;
    
    preview.innerHTML = `
      <img src="${this.state.screenshotData.screenshot}" alt="Screenshot capturado" />
      <div class="screenshot-info">
        <p><strong>URL:</strong> ${this.state.screenshotData.url}</p>
        <p><strong>Tamaño:</strong> ${this.formatBytes(this.state.screenshotData.sizeBytes)}</p>
        <p><strong>Fecha:</strong> ${new Date(this.state.screenshotData.timestamp).toLocaleString()}</p>
      </div>
    `;
  }

  displayExtractedContent() {
    if (!this.state.extractedData) return;
    
    // Update text content
    const extractedText = document.getElementById('extracted-text');
    if (extractedText) {
      extractedText.textContent = this.state.extractedData.text;
    }
    
    // Update links
    const extractedLinks = document.getElementById('extracted-links');
    if (extractedLinks) {
      if (this.state.extractedData.links.length > 0) {
        extractedLinks.innerHTML = this.state.extractedData.links
          .map(link => `<a href="${link}" target="_blank" class="link-badge">${link}</a>`)
          .join('');
      } else {
        extractedLinks.innerHTML = '<p>No se encontraron enlaces</p>';
      }
    }
    
    // Update metadata
    document.getElementById('word-count').textContent = this.countWords(this.state.extractedData.text);
    document.getElementById('char-count').textContent = this.state.extractedData.text.length;
    document.getElementById('ai-model').textContent = this.state.extractedData.model;
    document.getElementById('tokens-used').textContent = this.state.extractedData.tokensUsed;
    document.getElementById('original-url').textContent = this.state.screenshotData?.url || '-';
    document.getElementById('capture-date').textContent = new Date(this.state.screenshotData?.timestamp || Date.now()).toLocaleString();
    
    // Show extracted content
    document.getElementById('extracted-content').style.display = 'block';
  }

  displayChunks() {
    const container = document.getElementById('chunks-container');
    if (!container) return;
    
    const filteredChunks = this.getFilteredChunks();
    
    container.innerHTML = filteredChunks.map((chunk, index) => `
      <div class="chunk ${this.getChunkQualityClass(chunk.quality_score)}" data-index="${index}">
        <div class="chunk-header">
          <div class="chunk-info">
            <span class="chunk-category">${chunk.category}</span>
            <span class="chunk-score">${Math.round(chunk.quality_score)}%</span>
            <span class="chunk-words">${chunk.word_count} palabras</span>
          </div>
          <div class="chunk-actions">
            <button class="chunk-btn approve" onclick="app.approveChunk(${index})" title="Aprobar">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 13l4 4L19 7"/>
              </svg>
            </button>
            <button class="chunk-btn reject" onclick="app.rejectChunk(${index})" title="Rechazar">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <button class="chunk-btn edit" onclick="app.editChunk(${index})" title="Editar">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="chunk-content">
          <div class="chunk-text" id="chunk-text-${index}">${chunk.text}</div>
          <div class="chunk-edit" id="chunk-edit-${index}" style="display:none">
            <textarea class="chunk-textarea" id="chunk-textarea-${index}">${chunk.text}</textarea>
            <div class="chunk-edit-actions">
              <button class="btn btn-success btn-sm" onclick="app.saveChunk(${index})">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"/>
                </svg>
                Guardar
              </button>
              <button class="btn btn-secondary btn-sm" onclick="app.cancelEdit(${index})">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    
    // Update chunks preview
    document.getElementById('chunks-preview').style.display = 'block';
    this.updateChunksStats();
  }

  displayReviewChunks() {
    const reviewContainer = document.getElementById('review-chunks-container');
    if (!reviewContainer) return;
    
    reviewContainer.innerHTML = this.state.chunks.map((chunk, index) => `
      <div class="review-chunk ${chunk.status} ${chunk.selected ? 'selected' : ''}" data-index="${index}">
        <div class="review-chunk-header">
          <div class="chunk-info">
            <input type="checkbox" class="chunk-checkbox" ${chunk.selected ? 'checked' : ''} 
                   onchange="app.toggleChunkSelection(${index})">
            <span class="chunk-category">${chunk.category}</span>
            <span class="chunk-score">${Math.round(chunk.quality_score)}%</span>
            <span class="chunk-status">${this.getStatusLabel(chunk.status)}</span>
          </div>
          <div class="chunk-actions">
            <button class="chunk-btn approve" onclick="app.approveChunk(${index})" title="Aprobar">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 13l4 4L19 7"/>
              </svg>
            </button>
            <button class="chunk-btn reject" onclick="app.rejectChunk(${index})" title="Rechazar">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
            <button class="chunk-btn edit" onclick="app.editChunk(${index})" title="Editar">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="review-chunk-content">
          <div class="review-chunk-text">${chunk.editedText || chunk.text}</div>
        </div>
      </div>
    `).join('');
    
    this.updateReviewStats();
    
    // Add continue button if there are approved chunks
    const approvedChunks = this.state.chunks.filter(chunk => chunk.status === 'approved');
    
    if (approvedChunks.length > 0 && reviewContainer) {
      const continueBtn = document.createElement('div');
      continueBtn.className = 'review-continue';
      continueBtn.innerHTML = `
        <button class="btn btn-primary" onclick="app.showStep(5)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M13 7l5 5m0 0l-5 5m5-5H6"/>
          </svg>
          Continuar a Exportación (${approvedChunks.length} chunks aprobados)
        </button>
      `;
      
      // Remove existing continue button if any
      const existingBtn = reviewContainer.querySelector('.review-continue');
      if (existingBtn) existingBtn.remove();
      
      reviewContainer.appendChild(continueBtn);
    }
  }

  displayExportResults(data) {
    document.getElementById('exported-count').textContent = data.exported;
    document.getElementById('total-after-export').textContent = data.totalAfter;
    document.getElementById('skipped-duplicates').textContent = data.skippedDuplicates;
    document.getElementById('backup-created').textContent = data.backupFile;
    
    document.getElementById('export-results').style.display = 'block';
  }

  // Chunk Management
  approveChunk(index) {
    const chunk = this.state.chunks[index];
    chunk.status = 'approved';
    this.displayChunks();
    this.displayReviewChunks();
    this.showToast('Chunk aprobado', 'success');
  }

  rejectChunk(index) {
    const chunk = this.state.chunks[index];
    chunk.status = 'rejected';
    this.displayChunks();
    this.displayReviewChunks();
    this.showToast('Chunk rechazado', 'warning');
  }

  editChunk(index) {
    const textElement = document.getElementById(`chunk-text-${index}`);
    const editElement = document.getElementById(`chunk-edit-${index}`);
    
    if (textElement && editElement) {
      textElement.style.display = 'none';
      editElement.style.display = 'block';
      
      const textarea = document.getElementById(`chunk-textarea-${index}`);
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }
  }

  saveChunk(index) {
    const textarea = document.getElementById(`chunk-textarea-${index}`);
    const textElement = document.getElementById(`chunk-text-${index}`);
    const editElement = document.getElementById(`chunk-edit-${index}`);
    
    if (textarea && textElement && editElement) {
      const chunk = this.state.chunks[index];
      chunk.editedText = textarea.value;
      chunk.status = 'edited';
      
      textElement.textContent = textarea.value;
      textElement.style.display = 'block';
      editElement.style.display = 'none';
      
      this.displayChunks();
      this.displayReviewChunks();
      this.showToast('Chunk guardado', 'success');
    }
  }

  cancelEdit(index) {
    const textElement = document.getElementById(`chunk-text-${index}`);
    const editElement = document.getElementById(`chunk-edit-${index}`);
    const textarea = document.getElementById(`chunk-textarea-${index}`);
    
    if (textElement && editElement && textarea) {
      const chunk = this.state.chunks[index];
      textarea.value = chunk.editedText || chunk.text;
      
      textElement.style.display = 'block';
      editElement.style.display = 'none';
    }
  }

  toggleChunkSelection(index) {
    const chunk = this.state.chunks[index];
    chunk.selected = !chunk.selected;
    
    if (chunk.selected) {
      this.state.selectedChunks.add(index);
    } else {
      this.state.selectedChunks.delete(index);
    }
    
    this.updateReviewStats();
  }

  selectAllChunks() {
    const allSelected = this.state.chunks.every(chunk => chunk.selected);
    
    this.state.chunks.forEach((chunk, index) => {
      chunk.selected = !allSelected;
      if (!allSelected) {
        this.state.selectedChunks.add(index);
      } else {
        this.state.selectedChunks.delete(index);
      }
    });
    
    this.displayReviewChunks();
  }

  approveSelectedChunks() {
    const selectedChunks = this.state.chunks.filter(chunk => chunk.selected);
    
    selectedChunks.forEach(chunk => {
      chunk.status = 'approved';
      chunk.selected = false;
    });
    
    this.state.selectedChunks.clear();
    this.displayReviewChunks();
    this.showToast(`${selectedChunks.length} chunks aprobados`, 'success');
  }

  rejectSelectedChunks() {
    const selectedChunks = this.state.chunks.filter(chunk => chunk.selected);
    
    selectedChunks.forEach(chunk => {
      chunk.status = 'rejected';
      chunk.selected = false;
    });
    
    this.state.selectedChunks.clear();
    this.displayReviewChunks();
    this.showToast(`${selectedChunks.length} chunks rechazados`, 'warning');
  }

  // UI Helper Methods
  switchTab(tabName) {
    this.state.activeTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });
  }

  filterChunks(filter) {
    this.state.activeFilter = filter;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    this.displayChunks();
  }

  getFilteredChunks() {
    switch (this.state.activeFilter) {
      case 'approved':
        return this.state.chunks.filter(chunk => chunk.status === 'approved');
      case 'rejected':
        return this.state.chunks.filter(chunk => chunk.status === 'rejected');
      case 'pending':
        return this.state.chunks.filter(chunk => chunk.status === 'pending');
      default:
        return this.state.chunks;
    }
  }

  getChunkQualityClass(score) {
    if (score >= 80) return 'quality-excellent';
    if (score >= 60) return 'quality-good';
    return 'quality-low';
  }

  getStatusLabel(status) {
    const labels = {
      pending: 'Pendiente',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      edited: 'Editado'
    };
    return labels[status] || status;
  }

  updateChunksStats() {
    const totalChunks = this.state.chunks.length;
    const avgQuality = totalChunks > 0 
      ? Math.round(this.state.chunks.reduce((sum, chunk) => sum + chunk.quality_score, 0) / totalChunks)
      : 0;
    
    document.getElementById('total-chunks').textContent = totalChunks;
    document.getElementById('avg-quality').textContent = `${avgQuality}%`;
  }

  updateReviewStats() {
    const approved = this.state.chunks.filter(c => c.status === 'approved').length;
    const rejected = this.state.chunks.filter(c => c.status === 'rejected').length;
    const edited = this.state.chunks.filter(c => c.status === 'edited').length;
    const pending = this.state.chunks.filter(c => c.status === 'pending').length;
    
    document.getElementById('approved-count').textContent = approved;
    document.getElementById('rejected-count').textContent = rejected;
    document.getElementById('edited-count').textContent = edited;
    document.getElementById('pending-count').textContent = pending;
  }

  updateExportSummary() {
    const approvedChunks = this.state.chunks.filter(chunk => chunk.status === 'approved');
    
    document.getElementById('export-ready-count').textContent = approvedChunks.length;
    document.getElementById('current-db-count').textContent = this.state.dbStatus?.totalChunks || '-';
    document.getElementById('last-backup').textContent = this.state.backups[0] || '-';
    
    // Enable/disable export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.disabled = approvedChunks.length === 0;
    }
  }

  // Modal Methods
  showExportModal() {
    const approvedChunks = this.state.chunks.filter(chunk => chunk.status === 'approved');
    
    if (approvedChunks.length === 0) {
      this.showToast('No hay chunks aprobados para exportar', 'error');
      return;
    }
    
    const modal = document.getElementById('confirm-modal');
    const message = document.getElementById('modal-message');
    
    if (modal && message) {
      message.textContent = `¿Estás seguro de que deseas exportar ${approvedChunks.length} chunks a la base de datos? Esta acción creará un backup automáticamente.`;
      modal.style.display = 'flex';
      
      // Update confirm button
      const confirmBtn = document.getElementById('modal-confirm');
      if (confirmBtn) {
        confirmBtn.onclick = () => this.exportChunks();
      }
    }
  }

  closeModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  showDBStatus() {
    if (!this.state.dbStatus) {
      this.showToast('Estado de la base de datos no disponible', 'warning');
      return;
    }
    
    const message = `
      <strong>Estado de la Base de Datos</strong><br><br>
      <strong>Total de chunks:</strong> ${this.state.dbStatus.totalChunks}<br>
      <strong>Última modificación:</strong> ${new Date(this.state.dbStatus.lastModified).toLocaleString()}<br>
      <strong>Backups disponibles:</strong> ${this.state.backups.length}
    `;
    
    this.showInfoModal('Estado de la Base de Datos', message);
  }

  showSettings() {
    const message = `
      <strong>Configuración Actual</strong><br><br>
      <strong>Tamaño de chunk:</strong> ${this.state.settings.chunkSize}<br>
      <strong>Solapamiento:</strong> ${this.state.settings.chunkOverlap}<br>
      <strong>Servidor:</strong> ${this.apiBase}<br>
      <strong>Versión:</strong> V5.1 Visual RAG
    `;
    
    this.showInfoModal('Configuración', message);
  }

  viewBackups() {
    if (this.state.backups.length === 0) {
      this.showToast('No hay backups disponibles', 'info');
      return;
    }
    
    const message = `
      <strong>Backups Disponibles</strong><br><br>
      ${this.state.backups.map(backup => `· ${backup}`).join('<br>')}
    `;
    
    this.showInfoModal('Backups', message);
  }

  showInfoModal(title, message) {
    const modal = document.getElementById('confirm-modal');
    const modalTitle = modal.querySelector('.modal-title');
    const modalMessage = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm');
    
    if (modal && modalTitle && modalMessage && confirmBtn) {
      modalTitle.textContent = title;
      modalMessage.innerHTML = message;
      confirmBtn.textContent = 'Cerrar';
      confirmBtn.onclick = () => this.closeModal();
      modal.style.display = 'flex';
    }
  }

  // Utility Methods
  setLoading(loading, message = 'Procesando...') {
    this.state.loading = loading;
    
    const globalLoading = document.getElementById('global-loading');
    const loadingText = globalLoading?.querySelector('.loading-text');
    
    if (loading) {
      if (globalLoading) {
        globalLoading.style.display = 'flex';
        if (loadingText) loadingText.textContent = message;
      }
    } else {
      if (globalLoading) {
        globalLoading.style.display = 'none';
      }
    }
  }

  showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = this.getToastIcon(type);
    
    toast.innerHTML = `
      <div class="toast-icon">
        ${icon}
      </div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  }

  getToastIcon(type) {
    const icons = {
      success: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      error: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      warning: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
      info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    };
    return icons[type] || icons.info;
  }

  validateURL(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  countWords(text) {
    return text.trim().split(/\s+/).length;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Enter: Capture page
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (this.state.currentStep === 1) {
        e.preventDefault();
        this.capturePage();
      }
    }
    
    // Escape: Close modal
    if (e.key === 'Escape') {
      this.closeModal();
    }
    
    // Ctrl/Cmd + S: Save/Export
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (this.state.currentStep === 5) {
        e.preventDefault();
        this.showExportModal();
      }
    }
  }

  resetSession() {
    // Reset state
    this.state = {
      ...this.state,
      currentStep: 1,
      screenshotData: null,
      extractedData: null,
      chunks: [],
      selectedChunks: new Set()
    };
    
    // Reset UI
    document.getElementById('url-input').value = '';
    document.getElementById('extracted-content').style.display = 'none';
    document.getElementById('chunks-preview').style.display = 'none';
    document.getElementById('export-results').style.display = 'none';
    
    // Show first step
    this.showStep(1);
    
    this.showToast('Sesión reiniciada. Puedes comenzar un nuevo proceso.', 'info');
  }
}

// Initialize application
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new VisualRAGApp();
  console.log('[V5.1] Visual RAG Application loaded');
});

// Make app globally available for inline event handlers
window.app = app;
