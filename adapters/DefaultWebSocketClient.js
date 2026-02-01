const WebSocket = require('ws');
const IWebSocketClient = require('../interfaces/IWebSocketClient');

/**
 * Default WebSocket client implementation using ws library
 */
class DefaultWebSocketClient extends IWebSocketClient {
  constructor() {
    super();
    this.ws = null;
  }

  /**
   * Connect to WebSocket URL
   */
  connect(url) {
    this.ws = new WebSocket(url);
    return this;
  }

  /**
   * Send data through WebSocket
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Close WebSocket connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (this.ws) {
      this.ws.on(event, handler);
    }
  }

  /**
   * Remove event handler
   */
  removeListener(event, handler) {
    if (this.ws) {
      this.ws.removeListener(event, handler);
    }
  }

  /**
   * Get WebSocket ready state
   */
  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}

module.exports = DefaultWebSocketClient;
