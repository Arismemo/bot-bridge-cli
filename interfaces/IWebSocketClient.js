/**
 * WebSocket Client Interface
 * Defines the contract for WebSocket communication implementations
 */
class IWebSocketClient {
  /**
   * Connect to a WebSocket URL
   * @param {string} url - WebSocket URL (ws:// or wss://)
   * @returns {IWebSocketClient} - Returns this for chaining
   */
  connect(url) {
    throw new Error('Not implemented');
  }

  /**
   * Send data through WebSocket
   * @param {string|Buffer} data - Data to send
   */
  send(data) {
    throw new Error('Not implemented');
  }

  /**
   * Close WebSocket connection
   */
  close() {
    throw new Error('Not implemented');
  }

  /**
   * Register event handler
   * @param {string} event - Event name (open, message, close, error)
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    throw new Error('Not implemented');
  }

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler to remove
   */
  removeListener(event, handler) {
    throw new Error('Not implemented');
  }

  /**
   * Get WebSocket ready state
   * @returns {number} - WebSocket ready state constant
   */
  get readyState() {
    throw new Error('Not implemented');
  }
}

module.exports = IWebSocketClient;
