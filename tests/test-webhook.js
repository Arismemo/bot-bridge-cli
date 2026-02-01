const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 模拟 Jest 的 fn 功能 (保持不变，因为其他测试文件也需要)
const jest = {
  fn: (implementation) => {
    const mockFn = (...args) => {
      mockFn.calls.push(args);
      mockFn.called = true;
      if (implementation) {
        return implementation(...args);
      }
    };
    mockFn.calls = [];
    mockFn.called = false;
    mockFn.calledWith = (...args) => mockFn.calls.some(call => JSON.stringify(call) === JSON.stringify(args));
    // 新增 mockClear 方法
    mockFn.mockClear = () => {
      mockFn.calls = [];
      mockFn.called = false;
    };
    return mockFn;
  }
};

// 模拟 ContextAwareBot 类 (保持不变)
class MockContextAwareBot {
  constructor({ apiUrl, botId, telegramBotToken, telegramChatIds }) {
    this.apiUrl = apiUrl;
    this.botId = botId;
    this.telegramBotToken = telegramBotToken;
    this.telegramChatIds = telegramChatIds;
    this.connected = false;
    this.onNewMessage = () => {};
    this.onDecideReply = () => {};

    this.bridge = {
      connected: false
    };

    this.handleTelegramMessage = jest.fn(async (telegramMessage) => {
      const simulatedContext = [
        {
          id: 'mock-msg-id',
          sender: telegramMessage.message.from.username || telegramMessage.message.from.first_name,
          recipient: this.botId,
          content: telegramMessage.message.text,
          timestamp: Date.now(),
          source: 'telegram',
          metadata: { telegram_chat_id: telegramMessage.message.chat.id, telegram_message_id: telegramMessage.message.message_id }
        }
      ];
      const decision = this.onDecideReply(simulatedContext);
      if (decision && decision.shouldReply) {
        console.log(`[MockBot] Simulating reply to Telegram: ${decision.reply}`);
        return this.sendMessageToTelegram(telegramMessage.message.chat.id, decision.reply, telegramMessage.message.message_id);
      }
      return null;
    });

    this.sendMessageToTelegram = jest.fn(async (chatId, text, replyToMessageId = null) => {
      console.log(`[MockBot] Sending to Telegram Chat ${chatId}: "${text}" (reply to: ${replyToMessageId})`);
      return { success: true, messageId: Math.random().toString(36).substring(7) };
    });

    this.disconnect = jest.fn();
    this.connect = jest.fn(() => { this.bridge.connected = true; });
  }
}

let originalContextAwareBot;

function setupMockContextAwareBot() {
  originalContextAwareBot = require('../client/index').ContextAwareBot;
  require('../client/index').ContextAwareBot = MockContextAwareBot;
}

function restoreContextAwareBot() {
  require('../client/index').ContextAwareBot = originalContextAwareBot;
}

// 封装所有 Webhook 测试的函数并导出
function runWebhookTests() {
  let webhookApp; // 用于 supertest 请求
  // webhookServerInstance 不再需要在这里启动和关闭服务器实例

  beforeAll(async () => {
    // 设置测试环境变量
    process.env.BRIDGE_API_URL = 'http://localhost:3999'; // 指向一个不存在的地址，因为我们 mock 了 BotBridgeClient
    process.env.BOT_ID = 'test_webhook_bot';
    process.env.TELEGRAM_BOT_TOKEN = 'test_token';
    process.env.TELEGRAM_CHAT_IDS = '-100, -200';
    process.env.WEBHOOK_PORT = 3002; // 使用一个独立的测试端口

    // 在加载 webhook-server 之前替换 Bot
    setupMockContextAwareBot();
    const webhookServerModule = require('../webhook-server');
    webhookApp = webhookServerModule.app; // 获取 Express app 实例

    console.log(`[Webhook Test] Using mock webhook app on port ${process.env.WEBHOOK_PORT}`);
  });

  afterAll(async () => {
    // 恢复原始 Bot
    restoreContextAwareBot();
    console.log('[Webhook Test] Restored original ContextAwareBot');
    // 不需要关闭服务器，因为没有在这里手动启动
  });

  describe('Webhook Server', () => {
    let mockBotInstance;

    beforeEach(() => {
      // 每次测试前重置 mockBotInstance
      mockBotInstance = require('../webhook-server').bot;
      // 清除 mock 上的调用记录，而不是重新创建实例
      mockBotInstance.handleTelegramMessage.mockClear();
      mockBotInstance.sendMessageToTelegram.mockClear();
    });

    test('GET /health returns 200 and bot status', async () => {
      const response = await request(webhookApp) // 使用 webhookApp
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.botId).toBe('test_webhook_bot');
      expect(response.body.connected).toBeFalsy(); // 模拟的 bot 默认不连接 WebSocket
      expect(response.body.chatIds).toEqual(['-100', '-200']);
    });

    test('POST /telegram-webhook handles text message to bot', async () => {
      const telegramMessage = {
        update_id: 12345,
        message: {
          message_id: 1,
          from: { id: 111, is_bot: false, first_name: 'User' },
          chat: { id: -100, type: 'group' },
          date: Date.now(),
          text: 'Hello @test_webhook_bot'
        }
      };

      await request(webhookApp) // 使用 webhookApp
        .post('/telegram-webhook')
        .send(telegramMessage)
        .expect(200);

      // 验证 handleTelegramMessage 被调用
      expect(mockBotInstance.handleTelegramMessage).toHaveBeenCalledWith(telegramMessage);

      // 验证 bot 决定回复并发送消息到 Telegram
      expect(mockBotInstance.sendMessageToTelegram).toHaveBeenCalledWith(
        telegramMessage.message.chat.id,
        '收到 @ 提醒！',
        telegramMessage.message.message_id
      );
    });

    test('POST /telegram-webhook handles human message without @ to bot', async () => {
      const telegramMessage = {
        update_id: 12346,
        message: {
          message_id: 2,
          from: { id: 222, is_bot: false, first_name: 'Human' },
          chat: { id: -100, type: 'group' },
          date: Date.now(),
          text: 'Just a normal message'
        }
      };

      await request(webhookApp) // 使用 webhookApp
        .post('/telegram-webhook')
        .send(telegramMessage)
        .expect(200);

      expect(mockBotInstance.handleTelegramMessage).toHaveBeenCalledWith(telegramMessage);
      expect(mockBotInstance.sendMessageToTelegram).toHaveBeenCalledWith(
        telegramMessage.message.chat.id,
        '收到你的消息！',
        telegramMessage.message.message_id
      );
    });

    test('POST /telegram-webhook handles other bot message (mocked random)', async () => {
      const telegramMessage = {
        update_id: 12347,
        message: {
          message_id: 3,
          from: { id: 333, is_bot: true, first_name: 'OtherBot' }, // 模拟来自其他 bot 的消息
          chat: { id: -100, type: 'group' },
          date: Date.now(),
          text: 'Hello from another bot'
        }
      };

      // 模拟 onDecideReply 中的随机数，使其回复
      mockBotInstance.onDecideReply = jest.fn(() => ({
        shouldReply: true,
        reply: `我看到了你的消息！`,
        notifyRecipient: 'OtherBot'
      }));


      await request(webhookApp) // 使用 webhookApp
        .post('/telegram-webhook')
        .send(telegramMessage)
        .expect(200);

      expect(mockBotInstance.handleTelegramMessage).toHaveBeenCalledWith(telegramMessage);
      expect(mockBotInstance.sendMessageToTelegram).toHaveBeenCalledWith(
        telegramMessage.message.chat.id,
        '我看到了你的消息！',
        telegramMessage.message.message_id
      );
    });

    test('POST /telegram-webhook should not reply if onDecideReply returns null', async () => {
      const telegramMessage = {
        update_id: 12348,
        message: {
          message_id: 4,
          from: { id: 444, is_bot: false, first_name: 'SilentUser' },
          chat: { id: -100, type: 'group' },
          date: Date.now(),
          text: 'Silent message'
        }
      };

      // 强制 onDecideReply 返回 null，表示不回复
      mockBotInstance.onDecideReply = jest.fn(() => null);

      await request(webhookApp) // 使用 webhookApp
        .post('/telegram-webhook')
        .send(telegramMessage)
        .expect(200);

      expect(mockBotInstance.handleTelegramMessage).toHaveBeenCalledWith(telegramMessage);
      expect(mockBotInstance.sendMessageToTelegram).not.toHaveBeenCalled(); // 确保没有调用发送消息
    });
  });
}

module.exports = runWebhookTests; // 导出函数
