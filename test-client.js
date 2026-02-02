#!/usr/bin/env node
/**
 * Bot Bridge 测试客户端
 * 连接到 https://telegrambot.709970.xyz 并测试通信
 */

const axios = require('axios');

// 配置
const API_URL = 'https://telegrambot.709970.xyz';
const BOT_ID = 'xiaoc-test-bot';
const TEST_RECIPIENT = 'test-recipient';

// 创建客户端类
class BotBridgeClient {
  constructor(apiUrl, botId) {
    this.apiUrl = apiUrl;
    this.botId = botId;
  }

  // 检查服务器健康
  async checkHealth() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`);
      console.log('✅ 健康检查:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
      throw error;
    }
  }

  // 获取服务状态
  async getStatus() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/status`);
      console.log('✅ 服务状态:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 获取状态失败:', error.message);
      throw error;
    }
  }

  // 获取已连接的 bots
  async getConnections() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/connections`);
      console.log('✅ 已连接 bots:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 获取连接失败:', error.message);
      throw error;
    }
  }

  // 发送消息
  async sendMessage(recipient, content, metadata = {}) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/messages`, {
        sender: this.botId,
        recipient,
        content,
        metadata: { ...metadata, timestamp: new Date().toISOString() }
      });
      console.log(`✅ 发送消息到 ${recipient}:`, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 发送消息失败:', error.message);
      throw error;
    }
  }

  // 获取消息
  async getMessages() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/messages`, {
        params: { recipient: this.botId }
      });
      console.log(`✅ 收到 ${response.data.count} 条消息`);
      return response.data;
    } catch (error) {
      console.error('❌ 获取消息失败:', error.message);
      throw error;
    }
  }

  // 查询特定收件人的消息
  async getMessagesFor(recipient) {
    try {
      const response = await axios.get(`${this.apiUrl}/api/messages`, {
        params: { recipient }
      });
      console.log(`✅ ${recipient} 的消息数: ${response.data.count}`);
      return response.data;
    } catch (error) {
      console.error('❌ 获取消息失败:', error.message);
      throw error;
    }
  }

  // 标记消息已读
  async markAsRead(messageId) {
    try {
      const response = await axios.post(`${this.apiUrl}/api/messages/${messageId}/read`);
      console.log('✅ 标记已读:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 标记已读失败:', error.message);
      throw error;
    }
  }
}

// 主测试函数
async function test() {
  console.log('🚀 Bot Bridge 测试客户端');
  console.log(`📡 服务器: ${API_URL}`);
  console.log(`🤖 Bot ID: ${BOT_ID}`);
  console.log('');

  const client = new BotBridgeClient(API_URL, BOT_ID);

  try {
    // 1. 健康检查
    console.log('--- 1. 健康检查 ---');
    await client.checkHealth();
    console.log('');

    // 2. 获取服务状态
    console.log('--- 2. 服务状态 ---');
    const status = await client.getStatus();
    console.log('');

    // 3. 获取已连接的 bots
    console.log('--- 3. 已连接 bots ---');
    await client.getConnections();
    console.log('');

    // 4. 发送测试消息
    console.log('--- 4. 发送测试消息 ---');
    const sendResult = await client.sendMessage(
      TEST_RECIPIENT,
      'Hello from Bot Bridge test client! 这是一条来自小C的测试消息。',
      { test: true, sender: '小C (XiaoC)' }
    );
    console.log('');

    // 5. 查询发送的消息
    console.log('--- 5. 查询发送给 test-recipient 的消息 ---');
    const sentMessages = await client.getMessagesFor(TEST_RECIPIENT);
    if (sentMessages.count > 0) {
      const latest = sentMessages.messages[0];
      console.log('最新消息:', {
        id: latest.id,
        sender: latest.sender,
        content: latest.content,
        timestamp: latest.created_at
      });
    }
    console.log('');

    // 6. 测试接收消息
    console.log('--- 6. 接收消息 ---');
    await client.getMessages();
    console.log('');

    console.log('✅ 所有测试通过！');
    console.log('');
    console.log('📊 测试总结:');
    console.log('   - 服务器连接: ✅');
    console.log('   - 消息发送: ✅');
    console.log('   - 消息接收: ✅');
    console.log('   - 状态查询: ✅');
    console.log('');
    console.log('🎉 小C 已成功配置为 Bot Bridge 客户端！');

  } catch (error) {
    console.error('');
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

// 运行测试
test().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});
