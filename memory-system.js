/**
 * Sistema de Memoria Ligera para Chatbot IES Juan de Lanuza
 * Mantiene contexto conversacional reciente sin persistencia
 */

class ConversationMemory {
    constructor(maxExchanges = 5) {
        this.exchanges = []; // Array de intercambios {user: string, bot: string}
        this.maxExchanges = maxExchanges;
    }

    /**
     * Añade un nuevo intercambio a la memoria
     * @param {string} userMessage - Mensaje del usuario
     * @param {string} botResponse - Respuesta del bot
     */
    addExchange(userMessage, botResponse) {
        this.exchanges.push({
            user: userMessage,
            bot: botResponse,
            timestamp: new Date().toISOString()
        });

        // Mantener solo los últimos intercambios
        if (this.exchanges.length > this.maxExchanges) {
            this.exchanges = this.exchanges.slice(-this.maxExchanges);
        }
    }

    /**
     * Obtiene la memoria formateada para el prompt
     * @returns {string} - Memoria formateada o string vacío si no hay memoria
     */
    getFormattedMemory() {
        if (this.exchanges.length === 0) {
            return '';
        }

        let memoryText = '[MEMORIA DE CONVERSACIÓN]\n';
        
        this.exchanges.forEach((exchange, index) => {
            memoryText += `U: ${exchange.user}\n`;
            memoryText += `B: ${exchange.bot}\n`;
        });

        memoryText += '[/MEMORIA]\n\n';

        return memoryText;
    }

    /**
     * Limpia toda la memoria
     */
    clearMemory() {
        this.exchanges = [];
    }

    /**
     * Obtiene el último mensaje del usuario
     * @returns {string|null} - Último mensaje del usuario o null
     */
    getLastUserMessage() {
        if (this.exchanges.length === 0) return null;
        return this.exchanges[this.exchanges.length - 1].user;
    }

    /**
     * Obtiene la última respuesta del bot
     * @returns {string|null} - Última respuesta del bot o null
     */
    getLastBotResponse() {
        if (this.exchanges.length === 0) return null;
        return this.exchanges[this.exchanges.length - 1].bot;
    }

    /**
     * Verifica si hay referencias a mensajes anteriores
     * @param {string} currentMessage - Mensaje actual del usuario
     * @returns {boolean} - true si hay referencias a conversación anterior
     */
    hasConversationalReferences(currentMessage) {
        const referenceWords = ['ese', 'esa', 'aquello', 'lo anterior', 'lo que dijiste', 'anterior', 'mencionaste'];
        const lowerMessage = currentMessage.toLowerCase();
        
        return referenceWords.some(word => lowerMessage.includes(word)) && this.exchanges.length > 0;
    }

    /**
     * Obtiene contexto relevante para referencias conversacionales
     * @returns {string} - Contexto de la última respuesta relevante
     */
    getContextForReferences() {
        if (this.exchanges.length === 0) return '';
        
        // Devolver la última respuesta del bot como contexto para referencias
        const lastExchange = this.exchanges[this.exchanges.length - 1];
        return lastExchange.bot;
    }

    /**
     * Obtiene estadísticas de la memoria
     * @returns {Object} - Estadísticas actuales
     */
    getStats() {
        return {
            totalExchanges: this.exchanges.length,
            maxExchanges: this.maxExchanges,
            memoryUsage: `${this.exchanges.length}/${this.maxExchanges}`,
            lastExchange: this.exchanges.length > 0 ? this.exchanges[this.exchanges.length - 1].timestamp : null
        };
    }
}

/**
 * Factory function para crear instancias de memoria aisladas por request
 * @param {number} maxExchanges - Máximo de intercambios a mantener
 * @returns {Object} - MemoryManager instance con estado aislado
 */
function createMemoryManager(maxExchanges = 5) {
    const memory = new ConversationMemory(maxExchanges);
    
    return {
        /**
         * Añade intercambio a la memoria de esta instancia
         */
        addExchange: (userMessage, botResponse) => {
            memory.addExchange(userMessage, botResponse);
        },

        /**
         * Obtiene memoria formateada para el prompt
         */
        getMemory: () => {
            return memory.getFormattedMemory();
        },

        /**
         * Limpia la memoria de esta instancia
         */
        clearMemory: () => {
            memory.clearMemory();
        },

        /**
         * Verifica si hay referencias conversacionales
         */
        hasReferences: (currentMessage) => {
            return memory.hasConversationalReferences(currentMessage);
        },

        /**
         * Obtiene contexto para referencias
         */
        getReferenceContext: () => {
            return memory.getContextForReferences();
        },

        /**
         * Obtiene estadísticas
         */
        getStats: () => {
            return memory.getStats();
        }
    };
}

/**
 * Legacy MemoryManager para compatibilidad temporal (DEPRECATED)
 * @deprecated Usar createMemoryManager() en su lugar
 */
const MemoryManager = createMemoryManager();

module.exports = {
    ConversationMemory,
    MemoryManager,
    createMemoryManager
};
