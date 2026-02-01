/**
 * Bot Bridge Client Tests
 *
 * 测试客户端的所有功能
 */
const BotBridgeClient = require('../client/index');

function runClientTests() {
  let client;

  beforeAll(async () => {
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (client) {
      client.stopPolling();
    }
  });

  beforeEach(() => {
    client = new BotBridgeClient({
      apiUrl: 'http://localhost:3999',
      botId: 'test-bot',
      pollInterval: 1000
    });
  });

  describe('Bot Bridge Client', () => {
    describe('sendMessage', () => {
      test('should send message successfully', async () => {
        const result = await client.sendMessage('recipient-bot', 'Hello world');

        expect(result.success).toBe(true);
        expect(result.id).toBeDefined();
      });

      test('should include metadata', async () => {
        const result = await client.sendMessage(
          'recipient-bot',
          'Message with data',
          { chat_id: '123', message_id: 456 }
        );

        expect(result.success).toBe(true);
      });
    });

    describe('getUnreadMessages', () => {
      test('should retrieve unread messages', async () => {
        // 先发送一条消息
        await client.sendMessage('test-bot', 'Test message');

        const result = await client.getUnreadMessages();

        expect(result.success).toBe(true);
        expect(Array.isArray(result.messages)).toBe(true);
      });

      test('should handle no messages', async () => {
        // 使用一个不会收到消息的 bot id
        const emptyClient = new BotBridgeClient({
          apiUrl: 'http://localhost:3999',
          botId: 'empty-bot'
        });

        const result = await emptyClient.getUnreadMessages();

        expect(result.success).toBe(true);
        expect(result.messages.length).toBe(0);
      });
    });

    describe('markAsRead', () => {
      test('should mark message as read', async () => {
        // 发送消息
        const sendResult = await client.sendMessage('test-bot', 'Mark as read test');
        const messageId = sendResult.id;

        // 标记已读
        const result = await client.markAsRead(messageId);

        expect(result.success).toBe(true);
      });

      test('should handle non-existent message', async () => {
        const result = await client.markAsRead('non-existent-id');

        expect(result.success).toBe(false);
      });
    });

    describe('getStatus', () => {
      test('should return service status', async () => {
        const result = await client.getStatus();

        expect(result.success).toBe(true);
        expect(result.status).toBe('running');
        expect(result.unread_count).toBeDefined();
      });
    });

    describe('replyTo', () => {
      test('should reply to original message', async () => {
        const originalMessage = {
          id: 'original-msg-id',
          sender: 'other-bot',
          content: 'Original message'
        };

        const result = await client.replyTo(originalMessage, 'Reply content');

        expect(result.success).toBe(true);
      });
    });

    describe('healthCheck', () => {
      test('should return true for healthy server', async () => {
        const healthy = await client.healthCheck();

        expect(healthy).toBe(true);
      });
    });

    describe('Polling', () => {
      test('should start and stop polling', () => {
        expect(client.running).toBe(false);

        client.startPolling();
        expect(client.running).toBe(true);

        client.stopPolling();
        expect(client.running).toBe(false);
      });

      test('should call onMessage callback', async (done) => {
        let messageReceived = false;

        client.onMessage = (msg) => {
          messageReceived = true;
          expect(msg.content).toBeDefined();
          done();
        };

        // 发送一条消息到这个 bot
        await client.sendMessage('test-bot', 'Test for polling');

        client.startPolling();

        // 停止轮询
        setTimeout(() => {
          client.stopPolling();
        }, 2000);
      });
    });
  });
}

module.exports = runClientTests;
