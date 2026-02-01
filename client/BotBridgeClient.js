const DefaultWebSocketClient = require('../adapters/DefaultWebSocketClient');
const DefaultHttpClient = require('../adapters/DefaultHttpClient');

/**
 * Bot Bridge Client (Refactored with dependency injection)
 * Supports WebSocket real-time communication and HTTP fallback
 */
class BotBridgeClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.BRIDGE_API_URL || 'http://localhost:3000';
    this.botId = config.botId || process.env.BOT_ID || 'unknown';
    this.httpOnly = config.httpOnly || false;

    // Dependency injection - use provided implementations or defaults
    this.wsClient = config.wsClient || new DefaultWebSocketClient();
    this.httpClient = config.httpClient || new DefaultHttpClient();

    this.connected = false;
    this.messageQueue = [];
    this.onMessage = config.onMessage || (() => {});
    this.onConnectionChange = config.onConnectionChange || (() => {});
    this.onError = config.onError || ((err) => console.error(err));
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;

    if (!this.httpOnly) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    const wsUrl = this.apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    this.wsClient.connect(`${wsUrl}/?bot_id=${this.botId}`);

    this.wsClient.on('open', () => {
      console.log(`[BotBridge] Connected: ${this.botId}`);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChange(true);
      this.flushMessageQueue();
    });

    this.wsClient.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (err) {
        this.onError(`Failed to parse message: ${err.message}`);
      }
    });

    this.wsClient.on('close', () => {
      console.log(`[BotBridge] Disconnected: ${this.botId}`);
      this.connected = false;
      this.onConnectionChange(false);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[BotBridge] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      }
    });

    this.wsClient.on('error', (err) => {
      this.onError(`WebSocket error: ${err.message}`);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log(`[BotBridge] Server acknowledged connection`);
        break;

      case 'message':
        this.onMessage({
          source: 'bridge',
          sender: message.sender,
          content: message.content,
          timestamp: message.timestamp,
          metadata: message.metadata
        });
        this.sendAck(message);
        break;

      case 'unread_messages':
        console.log(`[BotBridge] Received ${message.count} unread message(s)`);
        message.messages.forEach(msg => {
          this.onMessage({
            source: 'bridge',
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.created_at,
            metadata: msg.metadata
          });
          this.sendAck(msg);
        });
        break;

      case 'pong':
        // Heartbeat response - no action needed
        break;

      default:
        console.log(`[BotBridge] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Send message via WebSocket (connected) or HTTP (fallback)
   */
  async sendMessage(recipient, content, metadata = {}) {
    if (this.connected) {
      const message = {
        type: 'send',
        sender: this.botId,
        recipient,
        content,
        timestamp: new Date().toISOString(),
        metadata
      };
      this.wsClient.send(JSON.stringify(message));
      return { success: true, sent: true };
    } else {
      // Fallback to HTTP
      try {
        const response = await this.httpClient.post(
          `${this.apiUrl}/api/messages`,
          {
            sender: this.botId,
            recipient,
            content,
            metadata
          }
        );
        return { success: true, messageId: response.data.messageId };
      } catch (err) {
        this.onError(`Failed to send message via HTTP: ${err.message}`);
        return { success: false, error: err.message };
      }
    }
  }

  /**
   * Broadcast message to all connected bots
   */
  broadcast(content, metadata = {}) {
    if (!this.connected) {
      return { success: false, error: 'Not connected' };
    }

    const message = {
      type: 'broadcast',
      sender: this.botId,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.wsClient.send(JSON.stringify(message));
    return { success: true };
  }

  /**
   * Check if bridge server is healthy
   */
  async healthCheck() {
    try {
      const response = await this.httpClient.get(
        `${this.apiUrl}/health`,
        { timeout: 3000 }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get bridge server status
   */
  async getStatus() {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/api/status`);
      return response.data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get list of connected bots
   */
  async getConnectedBots() {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/api/connections`);
      return response.data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get unread messages for this bot
   */
  async getUnreadMessages() {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/api/messages`, {
        params: {
          recipient: this.botId,
          status: 'unread',
          limit: 50
        }
      });
      return {
        success: true,
        messages: response.data.messages || []
      };
    } catch (err) {
      this.onError(`Failed to fetch unread messages: ${err.message}`);
      return {
        success: false,
        error: err.message,
        messages: []
      };
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId) {
    try {
      await this.httpClient.post(`${this.apiUrl}/api/messages/${messageId}/read`);
      return { success: true };
    } catch (err) {
      this.onError(`Failed to mark message as read: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send acknowledgment for message
   */
  sendAck(message) {
    if (!message.id) return;

    if (this.connected) {
      this.wsClient.send(JSON.stringify({
        type: 'ack',
        messageId: message.id
      }));
    }
  }

  /**
   * Flush queued messages when connection established
   */
  flushMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`[BotBridge] Flushing ${this.messageQueue.length} queued message(s)`);
    this.messageQueue.forEach(msg => {
      this.wsClient.send(JSON.stringify(msg));
    });
    this.messageQueue = [];
  }

  /**
   * Reply to an original message
   */
  replyTo(originalMessage, content, extraMetadata = {}) {
    return this.sendMessage(
      originalMessage.sender,
      content,
      {
        reply_to: originalMessage.id,
        ...extraMetadata
      }
    );
  }

  /**
   * Disconnect from bridge server
   */
  disconnect() {
    this.wsClient.close();
    this.connected = false;
  }
}

module.exports = BotBridgeClient;
