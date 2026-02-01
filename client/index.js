/**
 * Bot Bridge Client
 *
 * OpenClaw bot 客户端，用于与中转服务通信
 */
const axios = require('axios');

class BotBridgeClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.BRIDGE_API_URL || 'http://localhost:3000';
    this.botId = config.botId || process.env.BOT_ID || 'unknown';
    this.pollInterval = config.pollInterval || process.env.POLL_INTERVAL || 5000;
    this.lastSyncTime = Date.now();
    this.messageStore = new Map(); // 本地消息缓存
    this.running = false;
    this.onMessage = config.onMessage || (() => {});
    this.onError = config.onError || ((err) => console.error(err));
  }

  /**
   * 发送消息
   */
  async sendMessage(recipient, content, metadata = {}) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/messages`, {
        sender: this.botId,
        recipient,
        content,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });

      return response.data;
    } catch (error) {
      this.onError(`Send message failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取未读消息
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
   * 标记消息为已读
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
   * 获取服务状态
   */
  async getStatus() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/status`);
      return response.data;
    } catch (error) {
      this.onError(`Get status failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量标记消息为已读
   */
  async markAllAsRead(messages) {
    for (const msg of messages) {
      await this.markAsRead(msg.id);
    }
  }

  /**
   * 开始轮询
   */
  startPolling() {
    if (this.running) {
      console.log('Polling already running');
      return;
    }

    this.running = true;
    console.log(`Starting polling for bot: ${this.botId}`);
    console.log(`  API URL: ${this.apiUrl}`);
    console.log(`  Interval: ${this.pollInterval}ms`);

    this.poll();
  }

  /**
   * 停止轮询
   */
  stopPolling() {
    this.running = false;
    console.log('Polling stopped');
  }

  /**
   * 轮询循环
   */
  async poll() {
    if (!this.running) return;

    try {
      const result = await this.getUnreadMessages();

      if (result.success && result.messages.length > 0) {
        console.log(`[BotBridge] Received ${result.messages.length} message(s)`);

        // 处理每条消息
        for (const msg of result.messages) {
          try {
            await this.onMessage(msg);
          } catch (err) {
            console.error(`Error handling message ${msg.id}:`, err);
          }

          // 标记为已读
          await this.markAsRead(msg.id);
        }
      }
    } catch (error) {
      this.onError(`Poll error: ${error.message}`);
    }

    // 继续轮询
    if (this.running) {
      setTimeout(() => this.poll(), this.pollInterval);
    }
  }

  /**
   * 发送回复消息
   */
  async replyTo(originalMessage, content) {
    return this.sendMessage(
      originalMessage.sender,
      content,
      {
        reply_to: originalMessage.id,
        original_message_id: originalMessage.metadata?.message_id
      }
    );
  }

  /**
   * 获取来自特定 bot 的消息
   */
  async getMessagesFrom(senderBotId) {
    const allMessages = Array.from(this.messageStore.values());
    return allMessages.filter(m => m.sender === senderBotId);
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
}

/**
 * 如果直接运行此文件，启动 CLI 客户端
 */
if (require.main === module) {
  const config = {
    apiUrl: process.env.BRIDGE_API_URL,
    botId: process.env.BOT_ID,
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 5000
  };

  console.log('Bot Bridge Client');
  console.log('Configuration:');
  console.log(`  API URL: ${config.apiUrl}`);
  console.log(`  Bot ID: ${config.botId}`);
  console.log(`  Poll Interval: ${config.pollInterval}ms`);

  // 检查配置
  if (!config.botId) {
    console.error('Error: BOT_ID is required');
    console.error('Set environment variable: export BOT_ID=your_bot_id');
    process.exit(1);
  }

  if (!config.apiUrl) {
    console.error('Error: BRIDGE_API_URL is required');
    console.error('Set environment variable: export BRIDGE_API_URL=http://server:3000');
    process.exit(1);
  }

  const client = new BotBridgeClient(config);

  // 设置消息处理回调
  client.onMessage = async (message) => {
    console.log('\n=== New Message ===');
    console.log(`From: ${message.sender}`);
    console.log(`Content: ${message.content}`);
    console.log(`Time: ${message.created_at}`);
    console.log('==================\n');

    // 这里可以添加自定义逻辑
    // 例如：回复消息、触发 OpenClaw 命令等
  };

  // 启动轮询
  client.startPolling();

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.stopPolling();
    process.exit(0);
  });
}

module.exports = BotBridgeClient;
