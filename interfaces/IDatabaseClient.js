/**
 * Database Client Interface
 * Defines the contract for database operations
 */
class IDatabaseClient {
  /**
   * Initialize database connection
   * @param {string} path - Database file path
   * @returns {Promise<void>}
   */
  async initialize(path) {
    throw new Error('Not implemented');
  }

  /**
   * Execute a SQL statement
   * @param {string} sql - SQL statement
   * @param {Array} params - Statement parameters
   * @returns {Promise<void>}
   */
  async execute(sql, params = []) {
    throw new Error('Not implemented');
  }

  /**
   * Query database for multiple rows
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Array of rows
   */
  async query(sql, params = []) {
    throw new Error('Not implemented');
  }

  /**
   * Save a message to database
   * @param {object} message - Message object
   * @returns {Promise<void>}
   */
  async saveMessage(message) {
    throw new Error('Not implemented');
  }

  /**
   * Load all messages from database
   * @returns {Promise<Array>} - Array of message objects
   */
  async loadMessages() {
    throw new Error('Not implemented');
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('Not implemented');
  }
}

module.exports = IDatabaseClient;
