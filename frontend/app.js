class ChatApp {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        
        this.isSending = false;
        
        this.initEventListeners();
        this.autoResizeTextarea();
        this.autoFocus();
    }
    
    initEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Input validation and auto-resize
        this.messageInput.addEventListener('input', () => {
            this.validateInput();
            this.autoResizeTextarea();
        });
        
        // Focus on window click
        document.addEventListener('click', () => {
            if (!this.isSending) {
                this.autoFocus();
            }
        });
        
        // Prevent accidental navigation
        window.addEventListener('beforeunload', (e) => {
            if (this.messageInput.value.trim()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }
    
    autoFocus() {
        if (!this.isSending) {
            this.messageInput.focus();
        }
    }
    
    validateInput() {
        const hasText = this.messageInput.value.trim().length > 0;
        this.sendButton.disabled = !hasText || this.isSending;
    }
    
    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        // Prevent double send
        if (!message || this.isSending) return;
        
        this.isSending = true;
        this.validateInput();
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Clear input and disable controls
        this.messageInput.value = '';
        this.autoResizeTextarea();
        this.messageInput.disabled = true;
        this.sendButton.disabled = true;
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send to backend with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch('https://chatbot-instituto-production.up.railway.app/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add bot response
            this.addMessage(data.response, 'bot');
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Show appropriate error message
            let errorMessage = 'Lo siento, ha ocurrido un error al procesar tu mensaje.';
            
            if (error.name === 'AbortError') {
                errorMessage = 'La solicitud ha tardado demasiado tiempo. Por favor, inténtalo de nuevo.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'No se puede conectar con el servidor. Verifica que el backend esté activo.';
            }
            
            this.addMessage(errorMessage + ' Por favor, inténtalo de nuevo.', 'bot');
        } finally {
            // Re-enable input and reset state
            this.isSending = false;
            this.messageInput.disabled = false;
            this.validateInput();
            this.autoFocus();
        }
    }
    
    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // Add avatar for bot messages
        if (type === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'bot-avatar';
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            `;
            messageDiv.appendChild(avatar);
        } else {
            // User avatar
            const avatar = document.createElement('div');
            avatar.className = 'bot-avatar';
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            `;
            messageDiv.appendChild(avatar);
        }
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Handle multi-line content
        if (content.includes('\n')) {
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.trim()) {
                    const p = document.createElement('p');
                    p.textContent = line;
                    messageContent.appendChild(p);
                } else if (index < lines.length - 1) {
                    const br = document.createElement('br');
                    messageContent.appendChild(br);
                }
            });
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom with smooth animation
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }
    
    scrollToBottom() {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }
}

// Initialize chat app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});