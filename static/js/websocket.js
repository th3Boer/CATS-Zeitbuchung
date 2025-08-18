class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.listeners = new Map();
        
        this.connect();
    }
    
    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket verbunden');
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Fehler beim Parsen der WebSocket-Nachricht:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('WebSocket getrennt');
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket Fehler:', error);
            };
            
        } catch (error) {
            console.error('Fehler beim Verbinden mit WebSocket:', error);
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                console.log(`Versuche WebSocket-Wiederverbindung (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
                this.reconnectAttempts++;
                this.connect();
            }, this.reconnectDelay);
            
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        } else {
            console.log('Max. Wiederverbindungsversuche erreicht');
        }
    }
    
    handleMessage(message) {
        const { type, data } = message;
        
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Fehler beim Ausführen des ${type} Listeners:`, error);
                }
            });
        }
        
        // Globale Handler für alle Nachrichten
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                try {
                    callback(message);
                } catch (error) {
                    console.error('Fehler beim Ausführen des globalen Listeners:', error);
                }
            });
        }
    }
    
    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }
    
    off(type, callback) {
        if (this.listeners.has(type)) {
            const listeners = this.listeners.get(type);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket nicht verbunden, Nachricht kann nicht gesendet werden');
        }
    }
}

// Globale WebSocket-Instanz
window.wsManager = new WebSocketManager();