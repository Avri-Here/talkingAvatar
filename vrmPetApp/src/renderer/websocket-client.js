class WebSocketClient {
  constructor(host, port) {
    this.url = `ws://${host}:${port}/client-ws`;
    this.ws = null;
    this.reconnectInterval = 3000;
    this.reconnectTimer = null;
    this.connect();
  }
  
  connect() {
    console.log('[WS] Connecting to:', this.url);
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[WS] ✓ Connected to server');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('[WS] ✗ Disconnected, reconnecting in', this.reconnectInterval / 1000, 'seconds...');
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }
  
  handleMessage(message) {
    console.log('[WS] Message type:', message.type);
    
    switch (message.type) {
      case 'audio':
        if (message.audio && message.volumes) {
          console.log('[WS] Received audio data');
          window.audioHandler?.playAudio({
            audioBase64: message.audio,
            volumes: message.volumes,
            sliceLength: message.slice_length,
            expressions: message.actions?.expressions
          });
        }
        break;
        
      case 'text':
        console.log('[WS] Text:', message.text);
        break;
        
      case 'status':
        console.log('[WS] Status:', message);
        break;
        
      case 'error':
        console.error('[WS] Server error:', message.message);
        break;
        
      default:
        console.log('[WS] Unhandled message type:', message.type, message);
    }
  }
  
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[WS] Sent:', message.type);
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }
  
  sendAudio(audioBlob) {
    console.log('[WS] Sending audio blob, size:', audioBlob.size);
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64Audio = reader.result.split(',')[1];
      this.send({
        type: 'audio-input',
        audio: base64Audio
      });
    };
    reader.onerror = (error) => {
      console.error('[WS] FileReader error:', error);
    };
    reader.readAsDataURL(audioBlob);
  }
  
  sendText(text) {
    this.send({
      type: 'text-input',
      text: text
    });
  }
}

// Initialize
console.log('[WS] Initializing WebSocket client');

// Use async to get config
(async () => {
  try {
    const config = await window.electronAPI.getConfig();
    console.log('[WS] Config received:', config.server);
    
    const wsClient = new WebSocketClient(config.server.host, config.server.port);
    
    // Expose globally for other modules
    window.wsClient = wsClient;
    
    console.log('[WS] Client exposed to window');
  } catch (error) {
    console.error('[WS] Failed to initialize:', error);
  }
})();

