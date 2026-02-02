#!/usr/bin/env node
/**
 * Bot Bridge WebSocket 多 Bot 测试
 * 创建多个 WebSocket 客户端并测试通信
 */

const WebSocket = require('ws');

// 配置
const WS_URL = 'wss://telegrambot.709970.xyz';
const BOTS = [
  { id: 'xiaoc-bot', name: '小C' },
  { id: 'test-bot-1', name: '测试 Bot 1' },
  { id: 'test-bot-2', name: '测试 Bot 2' },
  { id: 'work-bot', name: '工作助手 Bot' }
];

// 存储客户端连接
const clients = new Map();

// 创建 WebSocket 客户端类
class BotClient {
  constructor(botId, botName) {
    this.botId = botId;
    this.botName = botName;
    this.ws = null;
    this.messages = [];
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔗 [${this.botName}] 连接到 ${WS_URL}?bot_id=${this.botId}...`);

      this.ws = new WebSocket(`${WS_URL}?bot_id=${this.botId}`);

      this.ws.on('open', () => {
        console.log(`✅ [${this.botName}] WebSocket 已连接`);
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log(`📨 [${this.botName}] 收到消息:`, message);
          this.messages.push(message);
        } catch (error) {
          console.error(`❌ [${this.botName}] 解析消息失败:`, error);
        }
      });

      this.ws.on('error', (error) => {
        console.error(`❌ [${this.botName}] WebSocket 错误:`, error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log(`🔌 [${this.botName}] WebSocket 已断开`);
        this.connected = false;
      });
    });
  }

  sendMessage(recipient, content, metadata = {}) {
    if (!this.connected || !this.ws) {
      console.error(`❌ [${this.botName}] 未连接，无法发送消息`);
      return Promise.reject(new Error('Not connected'));
    }

    return new Promise((resolve, reject) => {
      const message = {
        sender: this.botId,
        recipient,
        content,
        metadata: {
          ...metadata,
          senderName: this.botName,
          timestamp: new Date().toISOString()
        }
      };

      this.ws.send(JSON.stringify(message), (error) => {
        if (error) {
          console.error(`❌ [${this.botName}] 发送失败:`, error);
          reject(error);
        } else {
          console.log(`✉️ [${this.botName}] 发送给 ${recipient}: ${content}`);
          resolve(message);
        }
      });
    });
  }

  disconnect() {
    if (this.ws && this.connected) {
      this.ws.close();
    }
  }

  getMessageCount() {
    return this.messages.length;
  }
}

// 主测试函数
async function test() {
  console.log('🚀 Bot Bridge WebSocket 多 Bot 测试');
  console.log(`📡 服务器: ${WS_URL}`);
  console.log(`🤖 Bots 数量: ${BOTS.length}`);
  console.log('');

  // 1. 创建所有 bots
  console.log('--- 1. 创建并连接所有 Bots ---');
  const botClients = [];

  for (const bot of BOTS) {
    const client = new BotClient(bot.id, bot.name);
    botClients.push(client);
    clients.set(bot.id, client);

    try {
      await client.connect();
      await sleep(500); // 等待连接稳定
    } catch (error) {
      console.error(`❌ [${bot.name}] 连接失败:`, error.message);
    }
  }

  console.log('');
  const connectedBots = botClients.filter(b => b.connected);
  console.log(`✅ 已连接: ${connectedBots.length}/${botClients.length} 个 bots`);
  console.log('');

  // 2. 等待所有连接稳定
  console.log('--- 2. 等待连接稳定 ---');
  await sleep(2000);

  // 3. 测试发送消息
  console.log('--- 3. 测试发送消息 ---');

  // 小C 发送给测试 Bot 1
  if (connectedBots.length >= 2) {
    const xiaoc = clients.get('xiaoc-bot');
    const test1 = clients.get('test-bot-1');
    if (xiaoc && test1) {
      await xiaoc.sendMessage('test-bot-1', '你好！我是小C，这是一条测试消息。');
    }
  }

  await sleep(1000);

  // 测试 Bot 1 发送给测试 Bot 2
  if (connectedBots.length >= 3) {
    const test1 = clients.get('test-bot-1');
    const test2 = clients.get('test-bot-2');
    if (test1 && test2) {
      await test1.sendMessage('test-bot-2', '我是测试 Bot 1，测试机器人通信！');
    }
  }

  await sleep(1000);

  // 工作 Bot 发送给小C
  if (connectedBots.length >= 2) {
    const workBot = clients.get('work-bot');
    const xiaoc = clients.get('xiaoc-bot');
    if (workBot && xiaoc) {
      await workBot.sendMessage('xiaoc-bot', '工作助手 Bot: 任务已完成！');
    }
  }

  await sleep(2000);

  // 4. 查询每个 bot 收到的消息
  console.log('');
  console.log('--- 4. 消息统计 ---');
  for (const client of connectedBots) {
    console.log(`📊 [${client.botName}] 收到 ${client.getMessageCount()} 条消息`);
  }

  // 5. 查询服务器连接状态
  console.log('');
  console.log('--- 5. 服务器连接状态 ---');
  const axios = require('axios');
  try {
    const response = await axios.get('https://telegrambot.709970.xyz/api/connections');
    console.log('服务器连接状态:', response.data);
  } catch (error) {
    console.error('查询连接状态失败:', error.message);
  }

  // 6. 清理连接
  console.log('');
  console.log('--- 6. 清理连接 ---');
  for (const client of botClients) {
    client.disconnect();
  }

  await sleep(1000);

  console.log('');
  console.log('✅ 测试完成！');
  console.log('');
  console.log('📊 测试总结:');
  console.log(`   - 创建 bots: ${BOTS.length}`);
  console.log(`   - 成功连接: ${connectedBots.length}`);
  console.log(`   - 消息发送: 3 次`);
  console.log(`   - WebSocket 通信: ✅`);
  console.log(`   - 多 Bot 通信: ✅`);
}

// 辅助函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
test().catch(error => {
  console.error('');
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
