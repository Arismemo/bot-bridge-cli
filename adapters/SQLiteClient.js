const sqlite3 = require('sqlite3').verbose();
const IDatabaseClient = require('../interfaces/IDatabaseClient');

/**
 * SQLite database client implementation
 */
class SQLiteClient extends IDatabaseClient {
  constructor() {
    super();
    this.db = null;
  }

  /**
   * Initialize database connection and create tables
   */
  async initialize(path) {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(path, (err) => {
        if (err) return reject(err);
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  /**
   * Create messages table if not exists
   */
  async createTables() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          sender TEXT NOT NULL,
          userId TEXT,
          chatId TEXT,
          content TEXT,
          timestamp TEXT NOT NULL,
          messageId INTEGER,
          metadata TEXT
        )
      `;
      this.db.run(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Execute a SQL statement
   */
  async execute(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Query database for rows
   */
  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  /**
   * Save message to database
   */
  async saveMessage(message) {
    const sql = `
      INSERT OR REPLACE INTO messages
      (id, source, sender, userId, chatId, content, timestamp, messageId, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      message.id,
      message.source,
      message.sender,
      message.userId || null,
      message.chatId || null,
      message.content,
      message.timestamp,
      message.messageId || null,
      JSON.stringify(message.metadata || {})
    ];
    return this.execute(sql, params);
  }

  /**
   * Load all messages from database
   */
  async loadMessages() {
    const rows = await this.query('SELECT * FROM messages ORDER BY timestamp ASC');
    return rows.map(row => ({
      id: row.id,
      source: row.source,
      sender: row.sender,
      userId: row.userId,
      chatId: row.chatId,
      content: row.content,
      timestamp: row.timestamp,
      messageId: row.messageId,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

module.exports = SQLiteClient;
