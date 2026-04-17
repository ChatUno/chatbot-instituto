/**
 * Modern JavaScript for IES Juan de Lanuza Chatbot Frontend
 * Features: Chat, FAQ, Info, Dark Mode, Notifications, etc.
 */

class ChatbotApp {
    constructor() {
        this.apiBaseUrl = 'https://chatbot-instituto-production.up.railway.app';
        this.currentSection = 'chat';
        this.authToken = null;
        this.messages = [];
        this.faqData = [];
        this.isTyping = false;
        this.theme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTheme();
        this.loadFAQData();
        await this.authenticate();
        this.showSection('chat');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Chat functionality
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');

        messageInput.addEventListener('input', () => {
            this.updateSendButton();
            this.autoResizeTextarea(messageInput);
        });

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Quick actions
        document.querySelectorAll('.quick-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const query = e.currentTarget.dataset.query;
                messageInput.value = query;
                this.updateSendButton();
                this.sendMessage();
            });
        });

        // Chat actions
        document.getElementById('clearChat').addEventListener('click', () => {
            this.clearChat();
        });

        document.getElementById('exportChat').addEventListener('click', () => {
            this.exportChat();
        });

        // FAQ functionality
        const faqSearch = document.getElementById('faqSearch');
        faqSearch.addEventListener('input', (e) => {
            this.filterFAQ(e.target.value);
        });

        document.querySelectorAll('.category-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.filterFAQByCategory(e.currentTarget.dataset.category);
            });
        });

        // Toast close
        document.getElementById('toastClose').addEventListener('click', () => {
            this.hideNotification();
        });

        // Voice and emoji buttons (placeholder functionality)
        document.getElementById('voiceButton').addEventListener('click', () => {
            this.showNotification('Entrada de voz próximamente disponible', 'info');
        });

        document.getElementById('emojiButton').addEventListener('click', () => {
            this.showNotification('Emojis próximamente disponibles', 'info');
        });
    }

    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeIcon();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateThemeIcon();
        this.showNotification(`Tema ${this.theme === 'light' ? 'claro' : 'oscuro'} activado`, 'success');
    }

    updateThemeIcon() {
        const themeToggle = document.getElementById('themeToggle');
        const isDark = this.theme === 'dark';
        
        themeToggle.innerHTML = isDark ? 
            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>` :
            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>`;
    }

    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}Section`).classList.add('active');

        this.currentSection = sectionName;
    }

    async authenticate() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@test.com',
                    password: 'test123'
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.authToken = data.token;
                this.updateConnectionStatus(true);
                return true;
            } else {
                throw new Error('Authentication failed');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            this.updateConnectionStatus(false);
            this.showNotification('Error de conexión con el servidor', 'error');
            return false;
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('span');

        if (connected) {
            statusDot.classList.add('online');
            statusDot.classList.remove('offline');
            statusText.textContent = 'Conectado';
            statusElement.style.backgroundColor = 'var(--success-50)';
            statusElement.style.borderColor = 'var(--success-200)';
            statusElement.style.color = 'var(--success-700)';
        } else {
            statusDot.classList.remove('online');
            statusDot.classList.add('offline');
            statusText.textContent = 'Desconectado';
            statusElement.style.backgroundColor = 'var(--error-50)';
            statusElement.style.borderColor = 'var(--error-200)';
            statusElement.style.color = 'var(--error-700)';
        }
    }

    updateSendButton() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        sendButton.disabled = !messageInput.value.trim() || this.isTyping;
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || this.isTyping) return;

        // Add user message
        this.addMessage(message, 'user');
        
        // Clear input
        messageInput.value = '';
        this.autoResizeTextarea(messageInput);
        this.updateSendButton();

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ message })
            });

            if (response.ok) {
                const data = await response.json();
                this.addMessage(data.response, 'bot');
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            console.error('Send message error:', error);
            this.addMessage('Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.', 'bot', 'error');
            this.updateConnectionStatus(false);
        } finally {
            this.hideTypingIndicator();
        }
    }

    addMessage(text, sender, type = 'normal') {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        
        if (sender === 'user') {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">Tú</span>
                        <span class="message-time">${this.formatTime(new Date())}</span>
                    </div>
                    <div class="message-text">${this.escapeHtml(text)}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">Asistente IES Juan de Lanuza</span>
                        <span class="message-time">${this.formatTime(new Date())}</span>
                    </div>
                    <div class="message-text">${text}</div>
                </div>
            `;
        }

        if (type === 'error') {
            messageElement.classList.add('error-message');
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Store message
        this.messages.push({
            text,
            sender,
            timestamp: new Date(),
            type
        });
    }

    showTypingIndicator() {
        this.isTyping = true;
        document.getElementById('typingIndicator').style.display = 'flex';
        this.updateSendButton();
    }

    hideTypingIndicator() {
        this.isTyping = false;
        document.getElementById('typingIndicator').style.display = 'none';
        this.updateSendButton();
    }

    clearChat() {
        if (confirm('¿Estás seguro de que quieres limpiar el chat?')) {
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.innerHTML = '';
            this.messages = [];
            this.showWelcomeMessage();
            this.showNotification('Chat limpiado', 'success');
        }
    }

    exportChat() {
        if (this.messages.length === 0) {
            this.showNotification('No hay mensajes para exportar', 'info');
            return;
        }

        const chatContent = this.messages.map(msg => {
            const time = this.formatTime(msg.timestamp);
            const sender = msg.sender === 'user' ? 'Tú' : 'Asistente';
            return `[${time}] ${sender}: ${msg.text}`;
        }).join('\n\n');

        const blob = new Blob([chatContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-ies-juan-de-lanuza-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('Chat exportado correctamente', 'success');
    }

    showWelcomeMessage() {
        const messagesContainer = document.getElementById('chatMessages');
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'welcome-message';
        welcomeMessage.innerHTML = `
            <div class="message-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">Asistente IES Juan de Lanuza</span>
                    <span class="message-time">Ahora</span>
                </div>
                <div class="message-text">
                    <p>¡Hola! Soy tu asistente virtual del IES Juan de Lanuza. Estoy aquí para ayudarte con cualquier duda sobre nuestro centro educativo.</p>
                    <div class="quick-actions">
                        <h4>Puedes preguntarme sobre:</h4>
                        <div class="action-grid">
                            <button class="quick-action" data-query="¿Qué estudios ofrecen?">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                                </svg>
                                Oferta Educativa
                            </button>
                            <button class="quick-action" data-query="¿Cuál es el horario del centro?">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                Horarios
                            </button>
                            <button class="quick-action" data-query="¿Cómo puedo contactar con el centro?">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                                Contacto
                            </button>
                            <button class="quick-action" data-query="¿Hay plazas disponibles?">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 11H3v2h6v-2zm0-4H3v2h6V7zm0 8H3v2h6v-2zm12-8h-6v2h6V7zm0 4h-6v2h6v-2zm0 4h-6v2h6v-2z"/>
                                </svg>
                                Plazas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(welcomeMessage);
        
        // Re-attach quick action listeners
        welcomeMessage.querySelectorAll('.quick-action').forEach(button => {
            button.addEventListener('click', (e) => {
                const query = e.currentTarget.dataset.query;
                const messageInput = document.getElementById('messageInput');
                messageInput.value = query;
                this.updateSendButton();
                this.sendMessage();
            });
        });
    }

    loadFAQData() {
        // FAQ data based on the chunks.json content
        this.faqData = [
            {
                id: 1,
                category: 'academica',
                question: '¿Qué estudios ofrece el IES Juan de Lanuza?',
                answer: 'El IES Juan de Lanuza ofrece ESO (1º a 4º curso), Bachillerato en dos modalidades (Ciencias y Tecnología, y Humanidades y Ciencias Sociales), y Formación Profesional en Grado Básico de Cocina y Restauración, Grado Medio de Cocina y Gastronomía, y Grado Medio de Atención a Personas en Situación de Dependencia.'
            },
            {
                id: 2,
                category: 'academica',
                question: '¿Cuáles son las asignaturas destacadas del centro?',
                answer: 'Entre las asignaturas destacadas se encuentran: Programación y robótica, Cultura clásica, Economía, Filosofía, Física y Química, y Biología y Geología.'
            },
            {
                id: 3,
                category: 'administrativa',
                question: '¿Cuál es el horario general del centro?',
                answer: 'El horario general del centro es de lunes a viernes de 08:00 a 14:30. La secretaría atiende de lunes a viernes de 09:00 a 13:00.'
            },
            {
                id: 4,
                category: 'administrativa',
                question: '¿Cuáles son los horarios específicos por nivel educativo?',
                answer: 'ESO: 08:00 - 14:30, con recreo de 11:00 a 11:30. Bachillerato: 08:00 - 14:30, con recreo de 11:15 a 11:45. Formación Profesional: 08:30 - 15:00, con pausa de 13:00 a 13:30.'
            },
            {
                id: 5,
                category: 'servicios',
                question: '¿Cómo puedo contactar con el centro?',
                answer: 'Puedes contactar con el centro a través de la secretaría, que está abierta de lunes a viernes de 09:00 a 13:00. También puedes llamar o enviar un correo electrónico al centro.'
            },
            {
                id: 6,
                category: 'instalaciones',
                question: '¿Qué instalaciones tiene el centro?',
                answer: 'El centro cuenta con laboratorios de ciencias, aulas de informática, taller de cocina, biblioteca, y patio deportivo.'
            },
            {
                id: 7,
                category: 'academica',
                question: '¿Qué Formación Profesional está disponible?',
                answer: 'Se ofrece Formación Profesional de Grado Básico de Cocina y Restauración, Grado Medio de Cocina y Gastronomía, y Grado Medio de Atención a Personas en Situación de Dependencia.'
            },
            {
                id: 8,
                category: 'administrativa',
                question: '¿Qué es el IES Juan de Lanuza?',
                answer: 'Es un centro educativo que imparte enseñanza secundaria y formación profesional en distintas áreas, incluyendo hostelería y servicios socioculturales.'
            }
        ];

        this.renderFAQ(this.faqData);
    }

    renderFAQ(faqItems) {
        const faqContainer = document.getElementById('faqItems');
        faqContainer.innerHTML = '';

        faqItems.forEach(item => {
            const faqElement = document.createElement('div');
            faqElement.className = 'faq-item';
            faqElement.innerHTML = `
                <button class="faq-question">
                    ${item.question}
                </button>
                <div class="faq-answer">
                    ${item.answer}
                </div>
            `;

            const question = faqElement.querySelector('.faq-question');
            question.addEventListener('click', () => {
                faqElement.classList.toggle('active');
            });

            faqContainer.appendChild(faqElement);
        });
    }

    filterFAQ(searchTerm) {
        const filtered = this.faqData.filter(item => 
            item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.answer.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderFAQ(filtered);
    }

    filterFAQByCategory(category) {
        // Update active button
        document.querySelectorAll('.category-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');

        // Filter FAQ items
        const filtered = category === 'all' 
            ? this.faqData 
            : this.faqData.filter(item => item.category === category);
        this.renderFAQ(filtered);
    }

    showNotification(message, type = 'success') {
        const toast = document.getElementById('notificationToast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = toast.querySelector('.toast-icon');

        toastMessage.textContent = message;

        // Update icon based on type
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toastIcon.innerHTML = icons[type] || icons.success;

        // Update colors based on type
        const colors = {
            success: 'var(--success-100) var(--success-600)',
            error: 'var(--error-100) var(--error-600)',
            info: 'var(--primary-100) var(--primary-600)'
        };

        const [bgColor, iconColor] = colors[type] || colors.success;
        toastIcon.style.backgroundColor = bgColor;
        toastIcon.style.color = iconColor;

        toast.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        const toast = document.getElementById('notificationToast');
        toast.style.display = 'none';
    }

    formatTime(date) {
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Helper function for navigation
function navigateToSection(sectionName) {
    if (window.chatbotApp) {
        window.chatbotApp.showSection(sectionName);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatbotApp = new ChatbotApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.chatbotApp) {
        window.chatbotApp.authenticate();
    }
});

// Handle connection errors
window.addEventListener('online', () => {
    if (window.chatbotApp) {
        window.chatbotApp.showNotification('Conexión restablecida', 'success');
        window.chatbotApp.authenticate();
    }
});

window.addEventListener('offline', () => {
    if (window.chatbotApp) {
        window.chatbotApp.showNotification('Conexión perdida', 'error');
        window.chatbotApp.updateConnectionStatus(false);
    }
});
