const BotBridgeClient = require('./BotBridgeClient');
const SQLiteClient = require('../adapters/SQLiteClient');

/**
 * Context-Aware Bot (Refactored with dependency injection)
 * Merges Telegram and Bridge message streams for context understanding
 */
class ContextAwareBot {
  constructor(config = {}) {
    // Dependency injection
    this.bridge = config.bridge || new BotBridgeClient(config);
    this.db = config.db || (config.dbPath ? new SQLiteClient() : null);

    // Telegram configuration
    this.telegramBotToken = config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatIds = this.parseChatIds(
      config.telegramChatIds || process.env.TELEGRAM_CHAT_IDS
    );

    // Message storage (in-memory)
    this.messages = new Map();

    // Callbacks
    this.onNewMessage = config.onNewMessage || (() => {});
    this.onDecideReply = config.onDecideReply || ((context) => null);

    // Initialize database if path provided
    if (this.db && config.dbPath) {
      this.db.initialize(config.dbPath).then(() => {
        this.loadMessagesFromDb();
      }).catch(err => {
        console.error('[SQLite] Error initializing database:', err.message);
      });
    }

    // Start listening for bridge messages
    this.startListening();
  }

  /**
   * Load messages from database
   */
  async loadMessagesFromDb() {
    try {
      const messages = await this.db.loadMessages();
      messages.forEach(msg => {
        this.messages.set(msg.id, msg);
      });
      console.log(`[SQLite] Loaded ${messages.length} messages from database.`);
    } catch (err) {
      console.error('[SQLite] Error loading messages from DB:', err.message);
    }
  }

  /**
   * Parse chat IDs from string or array
   */
  parseChatIds(chatIds) {
    if (!chatIds) return [];
    if (typeof chatIds === 'string') {
      return chatIds.split(',').map(id => id.trim());
    }
    return Array.isArray(chatIds) ? chatIds : [];
  }

  /**
   * Generate unique ID for message
   */
  generateUniqueId(source, sender, content, timestamp) {
    const str = `${source}:${sender}:${content}:${timestamp}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `msg_${Math.abs(hash)}`;
  }

  /**
   * Add message to storage
   */
  async addMessage(message) {
    const id = message.id || this.generateUniqueId(
      message.source,
      message.sender,
      message.content,
      message.timestamp
    );

    const msg = {
      id,
      source: message.source,
      sender: message.sender,
      content: message.content,
      timestamp: message.timestamp,
      userId: message.userId,
      chatId: message.chatId,
      messageId: message.messageId,
      metadata: message.metadata || {}
    };

    this.messages.set(id, msg);
    console.log(`[Context] New message: [${msg.source}] ${msg.sender}: ${msg.content}`);

    // Save to database
    if (this.db) {
      try {
        await this.db.saveMessage(msg);
      } catch (err) {
        console.error('[SQLite] Error saving message:', err.message);
      }
    }

    // Trigger callback
    this.onNewMessage(msg);

    // Decide whether to reply
    await this.decideReply(msg);
  }

  /**
   * Decide whether to reply to message based on context
   */
  async decideReply(message) {
    const context = this.getChatHistory();
    const decision = this.onDecideReply({ message, context });

    if (decision && decision.reply) {
      await this.sendMessage(decision.recipient || message.sender, decision.reply, decision.metadata);
    }
  }

  /**
   * Get chat history
   */
  getChatHistory(limit = 50) {
    const history = Array.from(this.messages.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return history.slice(-limit);
  }

  /**
   * Send message via bridge
   */
  async sendMessage(recipient, content, metadata = {}) {
    return await this.bridge.sendMessage(recipient, content, metadata);
  }

  /**
   * Broadcast message via bridge
   */
  broadcast(content, metadata = {}) {
    return this.bridge.broadcast(content, metadata);
  }

  /**
   * Disconnect from bridge
   */
  disconnect() {
    this.bridge.disconnect();
  }

  /**
   * Handle incoming Telegram message
   */
  handleTelegramMessage(telegramMessage) {
    const message = {
      source: 'telegram',
      sender: telegramMessage.from?.first_name || 'User',
      userId: telegramMessage.from?.id?.toString(),
      chatId: telegramMessage.chat?.id?.toString(),
      content: telegramMessage.text || telegramMessage.caption || '',
      timestamp: new Date().toISOString(),
      messageId: telegramMessage.message_id,
      metadata: {
        reply_to: telegramMessage.reply_to_message?.message_id,
        telegram_message_id: telegramMessage.message_id
      }
    };

    this.addMessage(message);
  }

  /**
   * Start listening for bridge messages
   */
  startListening() {
    this.bridge.onMessage = async (message) => {
      await this.addMessage({
        ...message,
        userId: message.metadata?.userId,
        chatId: message.metadata?.chatId
      });
    };
  }
}

module.exports = ContextAwareBot;
