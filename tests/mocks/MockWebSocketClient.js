/**
 * Mock WebSocket Client for testing
 * Simulates WebSocket behavior without real connections
 */
class MockWebSocketClient {
  constructor() {
    this.connected = false;
    this.handlers = {};
    this.sentMessages = [];
    this.readyState = 0; // WebSocket.CONNECTING
    this.url = null;
  }

  /**
   * Simulate connecting to WebSocket
   */
  connect(url) {
    this.url = url;
    this.readyState = 1; // WebSocket.OPEN
    setTimeout(() => {
      this.connected = true;
      this.trigger('open');
    }, 0);
    return this;
  }

  /**
   * Record sent messages
   */
  send(data) {
    this.sentMessages.push(data);
  }

  /**
   * Simulate closing connection
   */
  close() {
    this.readyState = 3; // WebSocket.CLOSED
    this.connected = false;
    setTimeout(() => this.trigger('close'), 0);
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    this.handlers[event] = this.handlers[event] || [];
    this.handlers[event].push(handler);
  }

  /**
   * Remove event handler
   */
  removeListener(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  /**
   * Trigger an event
   */
  trigger(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Simulate receiving a message from server
   */
  simulateReceiveMessage(message) {
    this.trigger('message', JSON.stringify(message));
  }

  /**
   * Simulate WebSocket error
   */
  simulateError(error) {
    this.trigger('error', error);
  }

  /**
   * Clear all recorded data
   */
  clear() {
    this.sentMessages = [];
    this.handlers = {};
  }
}

module.exports = MockWebSocketClient;
