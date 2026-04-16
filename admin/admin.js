class AdminPanel {
    constructor() {
        this.chunks = [];
        this.originalChunks = [];
        this.currentEditingId = null;
        this.serverUrl = "https://chatbot-instituto-production.up.railway.app";
        this.isSaving = false;
        this.init();
    }

    async init() {
        await this.loadChunks();
        this.setupEventListeners();
        this.updateDashboard();
        this.renderChunks();
    }

    async loadChunks() {
        try {
            const response = await fetch(`${this.serverUrl}/chunks`);
            if (!response.ok) {
                throw new Error('Error loading chunks from server');
            }
            const data = await response.json();
            if (data.status === 'ok') {
                this.chunks = data.data;
                this.originalChunks = JSON.parse(JSON.stringify(this.chunks));
            } else {
                throw new Error(data.message || 'Error loading chunks');
            }
        } catch (error) {
            console.error('Error loading chunks:', error);
            this.showNotification('Error cargando chunks', 'error');
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(link.dataset.section);
            });
        });

        // Knowledge section
        document.getElementById('add-chunk-btn').addEventListener('click', () => this.openChunkModal());
        document.getElementById('save-changes-btn').addEventListener('click', () => this.saveChunks());
        document.getElementById('save-chunk-btn').addEventListener('click', () => this.saveChunk());
        document.getElementById('cancel-chunk-btn').addEventListener('click', () => this.closeChunkModal());
        document.querySelector('.modal-close').addEventListener('click', () => this.closeChunkModal());

        // Chatbot section
        document.getElementById('send-message-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        document.getElementById('clear-chat-btn').addEventListener('click', () => this.clearChat());

        // Modal backdrop click
        document.getElementById('chunk-modal').addEventListener('click', (e) => {
            if (e.target.id === 'chunk-modal') this.closeChunkModal();
        });
    }

    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionName).classList.add('active');

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            conocimiento: 'Gestión de Conocimiento',
            chatbot: 'Preview del Chatbot',
            ajustes: 'Ajustes del Sistema'
        };
        document.getElementById('page-title').textContent = titles[sectionName];
    }

    updateDashboard() {
        // Update total chunks
        document.getElementById('total-chunks').textContent = this.chunks.length;

        // Update chatbot status
        this.checkChatbotStatus();

        // Update total sources
        const sources = new Set(this.chunks.map(chunk => chunk.source));
        document.getElementById('total-sources').textContent = sources.size;

        // Update last update
        const now = new Date();
        document.getElementById('last-update').textContent = now.toLocaleTimeString('es-ES');
    }

    async checkChatbotStatus() {
        try {
            const response = await fetch(`${this.serverUrl}/health`);
            if (response.ok) {
                document.getElementById('chatbot-status').textContent = 'Activo';
                document.getElementById('connection-status').innerHTML = '<i class="fas fa-circle"></i> Conectado';
                document.getElementById('connection-status').style.backgroundColor = '#10b981';
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            document.getElementById('chatbot-status').textContent = 'Error';
            document.getElementById('connection-status').innerHTML = '<i class="fas fa-circle"></i> Desconectado';
            document.getElementById('connection-status').style.backgroundColor = '#ef4444';
        }
    }

    renderChunks() {
        const container = document.getElementById('chunks-list');
        container.innerHTML = '';

        this.chunks.forEach(chunk => {
            const chunkElement = document.createElement('div');
            chunkElement.className = 'chunk-item';
            chunkElement.innerHTML = `
                <div class="chunk-header">
                    <span class="chunk-id">Chunk #${chunk.id}</span>
                    <span class="chunk-source">${chunk.source}</span>
                </div>
                <div class="chunk-text">${chunk.text}</div>
                <div class="chunk-actions">
                    <button class="btn btn-sm btn-secondary" onclick="adminPanel.editChunk(${chunk.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.deleteChunk(${chunk.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            `;
            container.appendChild(chunkElement);
        });
    }

    openChunkModal(chunkId = null) {
        const modal = document.getElementById('chunk-modal');
        const modalTitle = document.getElementById('modal-title');
        const textInput = document.getElementById('chunk-text');
        const sourceSelect = document.getElementById('chunk-source');

        if (chunkId) {
            const chunk = this.chunks.find(c => c.id === chunkId);
            modalTitle.textContent = 'Editar Chunk';
            textInput.value = chunk.text;
            sourceSelect.value = chunk.source;
            this.currentEditingId = chunkId;
        } else {
            modalTitle.textContent = 'Añadir Chunk';
            textInput.value = '';
            sourceSelect.value = 'centro';
            this.currentEditingId = null;
        }

        modal.classList.add('active');
    }

    closeChunkModal() {
        const modal = document.getElementById('chunk-modal');
        modal.classList.remove('active');
        this.currentEditingId = null;
    }

    saveChunk() {
        const text = document.getElementById('chunk-text').value.trim();
        const source = document.getElementById('chunk-source').value;

        if (!text) {
            this.showNotification('El texto del chunk no puede estar vacío', 'error');
            return;
        }

        if (this.currentEditingId) {
            // Edit existing chunk
            const chunkIndex = this.chunks.findIndex(c => c.id === this.currentEditingId);
            this.chunks[chunkIndex].text = text;
            this.chunks[chunkIndex].source = source;
        } else {
            // Add new chunk
            const newId = Math.max(...this.chunks.map(c => c.id), 0) + 1;
            this.chunks.push({
                id: newId,
                text: text,
                source: source
            });
        }

        this.renderChunks();
        this.updateDashboard();
        this.closeChunkModal();
        this.showNotification('Chunk guardado correctamente', 'success');
    }

    editChunk(chunkId) {
        this.openChunkModal(chunkId);
    }

    deleteChunk(chunkId) {
        if (confirm('¿Estás seguro de que quieres eliminar este chunk?')) {
            this.chunks = this.chunks.filter(c => c.id !== chunkId);
            this.renderChunks();
            this.updateDashboard();
            this.showNotification('Chunk eliminado correctamente', 'success');
        }
    }

    validateChunks(chunks) {
        // Validar que el array no esté vacío
        if (!chunks || chunks.length === 0) {
            this.showNotification('No puedes dejar el sistema sin información', 'error');
            return false;
        }

        // Validar cada chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            if (!chunk.id || typeof chunk.id !== 'number') {
                this.showNotification(`Chunk ${i + 1}: El ID debe ser un número`, 'error');
                return false;
            }
            
            if (!chunk.text || typeof chunk.text !== 'string' || chunk.text.trim() === '') {
                this.showNotification(`Chunk ${i + 1}: El texto no puede estar vacío`, 'error');
                return false;
            }
            
            if (!chunk.source || typeof chunk.source !== 'string' || chunk.source.trim() === '') {
                this.showNotification(`Chunk ${i + 1}: La fuente no puede estar vacía`, 'error');
                return false;
            }
        }
        
        return true;
    }

    sanitizeChunks(chunks) {
        return chunks.map(chunk => ({
            id: chunk.id,
            text: typeof chunk.text === 'string' ? chunk.text.trim() : '',
            source: typeof chunk.source === 'string' ? chunk.source.trim() : ''
        }));
    }

    async saveChunks() {
        // Proteger contra doble click
        if (this.isSaving) {
            console.log('Save already in progress');
            return;
        }

        // Validar chunks antes de guardar
        if (!this.validateChunks(this.chunks)) {
            return;
        }

        // Confirmación de guardado
        if (!confirm('¿Seguro que quieres guardar los cambios?')) {
            return;
        }

        try {
            this.isSaving = true;
            this.setSaveButtonState(true);
            
            // Sanitizar datos
            const sanitizedChunks = this.sanitizeChunks(this.chunks);
            
            const response = await fetch(`${this.serverUrl}/chunks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ chunks: sanitizedChunks })
            });

            if (!response.ok) {
                throw new Error('Error guardando chunks');
            }

            const data = await response.json();
            if (data.status === 'ok') {
                console.log('Chunks saved:', data.message);
                this.showNotification('Cambios guardados correctamente', 'success');
                // Actualizar chunks originales después de guardar exitosamente
                this.originalChunks = JSON.parse(JSON.stringify(sanitizedChunks));
            } else {
                throw new Error(data.message || 'Error guardando chunks');
            }
        } catch (error) {
            console.error('Error saving chunks:', error);
            this.showNotification('Error al guardar. Inténtalo de nuevo', 'error');
        } finally {
            this.isSaving = false;
            this.setSaveButtonState(false);
        }
    }

    setSaveButtonState(isLoading) {
        const saveButton = document.getElementById('save-changes-btn');
        if (saveButton) {
            saveButton.disabled = isLoading;
            saveButton.innerHTML = isLoading 
                ? '<i class="fas fa-spinner fa-spin"></i> Guardando...'
                : '<i class="fas fa-save"></i> Guardar cambios';
        }
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        // Add user message
        this.addMessage(message, 'user');
        input.value = '';

        // Add loading message
        const loadingId = this.addMessage('Escribiendo...', 'bot', true);

        try {
            const response = await fetch(`${this.serverUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }

            const data = await response.json();
            
            // Remove loading message
            this.removeMessage(loadingId);
            
            // Add bot response
            this.addMessage(data.response, 'bot');
        } catch (error) {
            console.error('Error sending message:', error);
            this.removeMessage(loadingId);
            this.addMessage('Lo siento, ha ocurrido un error al procesar tu mensaje.', 'bot');
        }
    }

    addMessage(text, sender, isLoading = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender}`;
        
        if (isLoading) {
            messageElement.id = `loading-${Date.now()}`;
        }
        
        messageElement.innerHTML = `
            <div class="message-content">${text}</div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return isLoading ? messageElement.id : null;
    }

    removeMessage(messageId) {
        if (messageId) {
            const message = document.getElementById(messageId);
            if (message) {
                message.remove();
            }
        }
    }

    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-robot"></i>
                <p>¡Hola! Soy el chatbot del IES Juan de Lanuza. ¿En qué puedo ayudarte?</p>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the admin panel
const adminPanel = new AdminPanel();
