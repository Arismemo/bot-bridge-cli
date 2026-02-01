/**
 * Bot Bridge Client (WebSocket 版本)
 *
 * OpenClaw bot 客户端，通过 WebSocket 与中转服务实时通信
 * 兼容 Telegram Bot API 集成
 */
const WebSocket = require('ws');
const axios = require('axios');

class BotBridgeClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.BRIDGE_API_URL || 'http://localhost:3000';
    this.botId = config.botId || process.env.BOT_ID || 'unknown';
    this.ws = null;
    this.connected = false;
    this.messageQueue = []; // 离线时缓存消息
    this.onMessage = config.onMessage || (() => {});
    this.onConnectionChange = config.onConnectionChange || (() => {});
    this.onError = config.onError || ((err) => console.error(err));
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.httpOnly = config.httpOnly || false;

    // Telegram 配置
    this.telegramBotToken = config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = config.telegramChatId || process.env.TELEGRAM_CHAT_ID;

    if (!this.httpOnly) {
      this.connect();
    }
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect() {
    const wsUrl = this.apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    this.ws = new WebSocket(`${wsUrl}/?bot_id=${this.botId}`);

    this.ws.on('open', () => {
      console.log(`[BotBridge] Connected: ${this.botId}`);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChange(true);

      // 发送离线时缓存的消息
      this.flushMessageQueue();
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (err) {
        this.onError(`Failed to parse message: ${err.message}`);
      }
    });

    this.ws.on('close', () => {
      console.log(`[BotBridge] Disconnected: ${this.botId}`);
      this.connected = false;
      this.onConnectionChange(false);

      // 尝试重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[BotBridge] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      }
    });

    this.ws.on('error', (err) => {
      this.onError(`WebSocket error: ${err.message}`);
    });
  }

  /**
   * 处理收到的消息
   */
  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log(`[BotBridge] Server acknowledged connection`);
        break;

      case 'message':
        // 新消息
        this.onMessage(message);
        this.sendAck(message);
        break;

      case 'unread_messages':
        // 离线时的未读消息
        console.log(`[BotBridge] Received ${message.count} unread message(s)`);
        message.messages.forEach(msg => {
          this.onMessage(msg);
          this.sendAck(msg);
        });
        break;

      case 'pong':
        // 心跳响应
        break;

      default:
        console.log(`[BotBridge] Unknown message type: ${message.type}`);
    }
  }

  /**
   * 发送消息确认
   */
  sendAck(message) {
    if (this.connected && message.id) {
      this.ws.send(JSON.stringify({
        type: 'ack',
        messageId: message.id
      }));
    }
  }

  /**
   * 发送消息给其他 bot
   * 如果 WebSocket 未连接，则回退到 HTTP API
   */
  async sendMessage(recipient, content, metadata = {}) {
    const message = {
      type: 'send',
      sender: this.botId,
      recipient,
      content,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        telegram_message_id: metadata.telegram_message_id // Telegram 消息 ID
      }
    };

    if (this.connected) {
      this.ws.send(JSON.stringify(message));
      return { success: true, sent: true };
    } else {
      // 回退到 HTTP API
      try {
        const response = await axios.post(`${this.apiUrl}/api/messages`, {
          sender: this.botId,
          recipient,
          content,
          metadata: message.metadata
        });
        return response.data;
      } catch (error) {
        this.onError(`HTTP Send message failed: ${error.message}`);
        return { success: false, error: error.message };
      }
    }
  }

  /**
   * 广播消息给所有 bot（除了自己）
   */
  broadcast(content, metadata = {}) {
    const message = {
      type: 'broadcast',
      sender: this.botId,
      content,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    };

    if (this.connected) {
      this.ws.send(JSON.stringify(message));
      return Promise.resolve({ success: true });
    } else {
      return Promise.resolve({ success: false, error: 'Not connected' });
    }
  }

  /**
   * 发送离线时缓存的消息
   */
  flushMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(`[BotBridge] Sending ${this.messageQueue.length} queued message(s)`);
      const queue = [...this.messageQueue];
      this.messageQueue = [];

      queue.forEach(message => {
        this.ws.send(JSON.stringify(message));
      });
    }
  }

  /**
   * 回复消息
   */
  replyTo(originalMessage, content, metadata = {}) {
    return this.sendMessage(
      originalMessage.sender,
      content,
      {
        reply_to: originalMessage.id,
        ...metadata
      }
    );
  }

  /**
   * 检查服务是否可用
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/status`);
      return response.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取在线 bot 列表
   */
  async getConnectedBots() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/connections`);
      return response.data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取未读消息（HTTP Fallback）
   */
  async getUnreadMessages() {
    try {
      const response = await axios.get(
        `${this.apiUrl}/api/messages`,
        {
          params: {
            recipient: this.botId,
            status: 'unread',
            limit: 50
          }
        }
      );

      return response.data;
    } catch (error) {
      this.onError(`Get messages failed: ${error.message}`);
      return { success: false, error: error.message, messages: [] };
    }
  }

  /**
   * 标记消息为已读（HTTP Fallback）
   */
  async markAsRead(messageId) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/messages/${messageId}/read`);
      return response.data;
    } catch (error) {
      this.onError(`Mark as read failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

// === Telegram 集成 ===

/**
 * 将消息发送到 Telegram 群聊
 */
async function sendToTelegram(botToken, chatId, text, replyToMessageId = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await axios.post(url, {
      chat_id: chatId,
      text: text,
      reply_to_message_id: replyToMessageId
    });

    return response.data;
  } catch (error) {
    console.error('[Telegram] Send error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * BotBridge 集成类
 * 同时管理 WebSocket 连接和 Telegram 发送
 */
class BotBridgeTelegram {
  constructor(config) {
    this.bridge = new BotBridgeClient(config);

    // 配置
    this.telegramBotToken = config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = config.telegramChatId || process.env.TELEGRAM_CHAT_ID;

    // 处理来自其他 bot 的消息
    this.bridge.onMessage = async (message) => {
      console.log(`[Bridge] Received from ${message.sender}: ${message.content}`);

      // 转发到 Telegram 群聊（如果配置了）
      if (this.telegramBotToken && this.telegramChatId) {
        try {
          await sendToTelegram(
            this.telegramBotToken,
            this.telegramChatId,
            `[来自 ${message.sender}]: ${message.content}`,
            message.metadata?.telegram_message_id
          );
        } catch (err) {
          console.error('[Bridge] Failed to forward to Telegram:', err);
        }
      }
    };
  }

  /**
   * 发送消息到其他 bot，同时也发送到 Telegram 群聊
   */
  async sendMessage(recipient, content, alsoSendToTelegram = true) {
    // 发送到其他 bot
    const result = await this.bridge.sendMessage(recipient, content);

    // 也发送到 Telegram 群聊
    if (alsoSendToTelegram && this.telegramBotToken && this.telegramChatId) {
      try {
        const telegramResult = await sendToTelegram(
          this.telegramBotToken,
          this.telegramChatId,
          content
        );

        return {
          ...result,
          telegram_message_id: telegramResult.result?.message_id
        };
      } catch (err) {
        console.error('[Bridge] Failed to send to Telegram:', err);
      }
    }

    return result;
  }

  /**
   * 处理来自 Telegram 的消息
   */
  async handleTelegramMessage(telegramMessage) {
    const { text, message_id, reply_to_message } = telegramMessage;
    const sender = telegramMessage.from?.username || 'unknown';

    // 检查是否是回复其他 bot
    if (reply_to_message?.text) {
      const replyText = reply_to_message.text;
      // 解析出被回复的 bot ID
      const match = replyText.match(/^\[来自 (\w+)\]:/);
      if (match) {
        const targetBotId = match[1];
        // 回复给目标 bot
        await this.sendMessage(targetBotId, text, false);
        return { success: true, forwarded: true };
      }
    }

    // 如果没有回复，检查是否 @ 了某个 bot
    if (text?.startsWith('@')) {
      const parts = text.split(' ');
      const targetBotId = parts[0].substring(1);
      const messageContent = parts.slice(1).join(' ');

      if (messageContent) {
        await this.sendMessage(targetBotId, messageContent, false);
        return { success: true, forwarded: true };
      }
    }

    return { success: true, forwarded: false };
  }

  get bridge() {
    return this.bridge;
  }

  disconnect() {
    this.bridge.disconnect();
  }
}

/**
 * 如果直接运行此文件，启动 CLI 客户端
 */
if (require.main === module) {
  const config = {
    apiUrl: process.env.BRIDGE_API_URL,
    botId: process.env.BOT_ID,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID
  };

  console.log('Bot Bridge Client (WebSocket + Telegram)');
  console.log('Configuration:');
  console.log(`  API URL: ${config.apiUrl}`);
  console.log(`  Bot ID: ${config.botId}`);
  console.log(`  Telegram: ${config.telegramBotToken ? 'enabled' : 'disabled'}`);

  if (!config.botId) {
    console.error('Error: BOT_ID is required');
    process.exit(1);
  }

  const client = new BotBridgeTelegram(config);

  console.log('\nConnected! Waiting for messages...\n');

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.disconnect();
    process.exit(0);
  });
}

module.exports = { BotBridgeClient, BotBridgeTelegram, sendToTelegram };
