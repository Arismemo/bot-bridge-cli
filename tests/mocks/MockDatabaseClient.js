/**
 * Mock Database Client for testing
 * Simulates database operations without real SQLite
 */
class MockDatabaseClient {
  constructor() {
    this.messages = [];
    this.closed = false;
    this.initialized = false;
  }

  /**
   * Simulate database initialization
   */
  async initialize(path) {
    this.initialized = true;
    this.path = path;
    return Promise.resolve();
  }

  /**
   * Simulate executing SQL statement
   */
  async execute(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return Promise.resolve();
  }

  /**
   * Simulate querying database
   */
  async query(sql, params = []) {
    this.lastSql = sql;
    this.lastParams = params;
    return Promise.resolve([...this.messages]);
  }

  /**
   * Save message to mock storage
   */
  async saveMessage(message) {
    const existingIndex = this.messages.findIndex(m => m.id === message.id);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = { ...message };
    } else {
      this.messages.push({ ...message });
    }
    return Promise.resolve();
  }

  /**
   * Load all messages from mock storage
   */
  async loadMessages() {
    return Promise.resolve([...this.messages]);
  }

  /**
   * Close mock database
   */
  async close() {
    this.closed = true;
    return Promise.resolve();
  }

  /**
   * Get all stored messages
   */
  getAllMessages() {
    return [...this.messages];
  }

  /**
   * Find message by ID
   */
  findMessage(id) {
    return this.messages.find(m => m.id === id);
  }

  /**
   * Count messages
   */
  countMessages() {
    return this.messages.length;
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    this.messages = [];
  }

  /**
   * Reset mock state
   */
  reset() {
    this.messages = [];
    this.closed = false;
    this.initialized = false;
    this.lastSql = null;
    this.lastParams = null;
  }
}

module.exports = MockDatabaseClient;
