/**
 * Direct unit tests for client/index.js without WebSocket overhead
 */

const { BotBridgeClient } = require('../client/index');

describe('BotBridgeClient - Direct Unit Tests', () => {
  describe('Constructor', () => {
    test('should initialize with default values', () => {
      const client = new BotBridgeClient();

      expect(client.apiUrl).toBe('http://localhost:3000');
      expect(client.botId).toBe('unknown');
      expect(client.ws).toBeNull();
      expect(client.connected).toBe(false);
      expect(client.messageQueue).toEqual([]);
      expect(client.reconnectAttempts).toBe(0);
      expect(client.maxReconnectAttempts).toBe(10);
      expect(client.reconnectDelay).toBe(1000);
      expect(client.httpOnly).toBe(false);

      client.disconnect();
    });

    test('should use provided config values', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://custom:8080',
        botId: 'custom-bot',
        maxReconnectAttempts: 5,
        reconnectDelay: 2000
      });

      expect(client.apiUrl).toBe('http://custom:8080');
      expect(client.botId).toBe('custom-bot');
      expect(client.maxReconnectAttempts).toBe(5);
      expect(client.reconnectDelay).toBe(2000);

      client.disconnect();
    });

    test('should use environment variables', () => {
      process.env.BRIDGE_API_URL = 'http://env:3000';
      process.env.BOT_ID = 'env-bot';

      const client = new BotBridgeClient();

      expect(client.apiUrl).toBe('http://env:3000');
      expect(client.botId).toBe('env-bot');

      delete process.env.BRIDGE_API_URL;
      delete process.env.BOT_ID;

      client.disconnect();
    });

    test('should set default callbacks', () => {
      const client = new BotBridgeClient();

      expect(() => client.onMessage()).not.toThrow();
      expect(() => client.onConnectionChange()).not.toThrow();
      expect(() => client.onError()).not.toThrow();

      client.disconnect();
    });

    test('should use custom callbacks', () => {
      const onMessage = jest.fn();
      const onConnectionChange = jest.fn();
      const onError = jest.fn();

      const client = new BotBridgeClient({
        onMessage,
        onConnectionChange,
        onError
      });

      expect(client.onMessage).toBe(onMessage);
      expect(client.onConnectionChange).toBe(onConnectionChange);
      expect(client.onError).toBe(onError);

      client.disconnect();
    });
  });

  describe('handleMessage', () => {
    test('should handle unknown message type', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient();
      const message = { type: 'unknown_type' };

      expect(() => client.handleMessage(message)).not.toThrow();

      consoleLog.mockRestore();
      client.disconnect();
    });

    test('should handle message with type connected', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient();
      const message = { type: 'connected' };

      expect(() => client.handleMessage(message)).not.toThrow();

      consoleLog.mockRestore();
      client.disconnect();
    });

    test('should handle pong message type', () => {
      const client = new BotBridgeClient();
      const message = { type: 'pong' };

      expect(() => client.handleMessage(message)).not.toThrow();

      client.disconnect();
    });

    test('should handle message type and call onMessage', () => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({ onMessage });
      const message = {
        type: 'message',
        sender: 'sender',
        content: 'test',
        timestamp: '2024-01-01',
        id: 'msg-123'
      };

      // Mock ws and connected state
      client.connected = true;
      client.ws = { send: jest.fn() };

      client.handleMessage(message);

      expect(onMessage).toHaveBeenCalledWith({
        source: 'bridge',
        sender: 'sender',
        content: 'test',
        timestamp: '2024-01-01',
        metadata: undefined
      });

      client.disconnect();
    });

    test('should handle unread_messages type', () => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({ onMessage });
      const message = {
        type: 'unread_messages',
        count: 2,
        messages: [
          { sender: 'bot1', content: 'msg1', created_at: '2024-01-01', id: 'msg-1' },
          { sender: 'bot2', content: 'msg2', created_at: '2024-01-01', id: 'msg-2' }
        ]
      };

      client.connected = true;
      client.ws = { send: jest.fn() };

      client.handleMessage(message);

      expect(onMessage).toHaveBeenCalledTimes(2);

      client.disconnect();
    });
  });

  describe('sendAck', () => {
    test('should send ack when connected and message has id', () => {
      const client = new BotBridgeClient();
      client.connected = true;
      client.ws = { send: jest.fn() };

      client.sendAck({ id: 'msg-123' });

      expect(client.ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ack', messageId: 'msg-123' })
      );

      client.disconnect();
    });

    test('should not send ack when not connected', () => {
      const client = new BotBridgeClient();
      client.connected = false;
      client.ws = { send: jest.fn() };

      client.sendAck({ id: 'msg-123' });

      expect(client.ws.send).not.toHaveBeenCalled();

      client.disconnect();
    });

    test('should not send ack when message has no id', () => {
      const client = new BotBridgeClient();
      client.connected = true;
      client.ws = { send: jest.fn() };

      client.sendAck({ content: 'test' });

      expect(client.ws.send).not.toHaveBeenCalled();

      client.disconnect();
    });

    test('should handle ws.send error gracefully', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const client = new BotBridgeClient();
      client.connected = true;
      client.ws = {
        send: jest.fn().mockImplementation(() => {
          throw new Error('Send error');
        })
      };

      expect(() => client.sendAck({ id: 'msg-123' })).not.toThrow();

      consoleError.mockRestore();
      client.disconnect();
    });
  });

  describe('flushMessageQueue', () => {
    test('should flush message queue when not empty', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient();
      client.messageQueue = [
        { type: 'test1' },
        { type: 'test2' }
      ];
      client.ws = { send: jest.fn() };

      client.flushMessageQueue();

      expect(client.ws.send).toHaveBeenCalledTimes(2);
      expect(client.messageQueue).toEqual([]);

      consoleLog.mockRestore();
      client.disconnect();
    });

    test('should do nothing when message queue is empty', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient();
      client.messageQueue = [];
      client.ws = { send: jest.fn() };

      client.flushMessageQueue();

      expect(client.ws.send).not.toHaveBeenCalled();

      consoleLog.mockRestore();
      client.disconnect();
    });
  });

  describe('replyTo', () => {
    test('should call sendMessage with correct parameters', async () => {
      const client = new BotBridgeClient();
      const originalMessage = {
        sender: 'original-sender',
        id: 'msg-456',
        content: 'original'
      };

      // Mock sendMessage
      client.sendMessage = jest.fn().mockResolvedValue({ success: true });

      await client.replyTo(originalMessage, 'reply content', {
        custom: 'metadata'
      });

      expect(client.sendMessage).toHaveBeenCalledWith(
        'original-sender',
        'reply content',
        {
          reply_to: 'msg-456',
          custom: 'metadata'
        }
      );

      client.disconnect();
    });
  });

  describe('disconnect', () => {
    test('should close ws when exists', () => {
      const client = new BotBridgeClient();
      client.ws = { close: jest.fn() };
      client.connected = true;

      client.disconnect();

      expect(client.ws.close).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });

    test('should handle ws being null', () => {
      const client = new BotBridgeClient();
      client.ws = null;

      expect(() => client.disconnect()).not.toThrow();

      client.disconnect();
    });
  });

  describe('HTTP methods error cases', () => {
    test('healthCheck should return false on error', async () => {
      const client = new BotBridgeClient({ apiUrl: 'http://invalid:9999' });

      const result = await client.healthCheck();

      expect(result).toBe(false);

      client.disconnect();
    });

    test('getStatus should return error object on failure', async () => {
      const client = new BotBridgeClient({ apiUrl: 'http://invalid:9999' });

      const status = await client.getStatus();

      expect(status).toEqual({
        success: false,
        error: expect.any(String)
      });

      client.disconnect();
    });

    test('getConnectedBots should return error object on failure', async () => {
      const client = new BotBridgeClient({ apiUrl: 'http://invalid:9999' });

      const result = await client.getConnectedBots();

      expect(result).toEqual({
        success: false,
        error: expect.any(String)
      });

      client.disconnect();
    });

    test('getUnreadMessages should call onError on failure', async () => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://invalid:9999',
        onError
      });

      const result = await client.getUnreadMessages();

      expect(result).toEqual({
        success: false,
        error: expect.any(String),
        messages: []
      });

      expect(onError).toHaveBeenCalled();

      client.disconnect();
    });

    test('markAsRead should call onError on failure', async () => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://invalid:9999',
        onError
      });

      const result = await client.markAsRead('msg-123');

      expect(result).toEqual({
        success: false,
        error: expect.any(String)
      });

      expect(onError).toHaveBeenCalled();

      client.disconnect();
    });
  });
});

describe('ContextAwareBot - Direct Unit Tests', () => {
  describe('parseChatIds', () => {
    test('should handle string input', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: '-100123, -100456'
      });

      expect(bot.telegramChatIds).toEqual(['-100123', '-100456']);

      bot.disconnect();
    });

    test('should handle array input', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: ['-100123', '-100456']
      });

      expect(bot.telegramChatIds).toEqual(['-100123', '-100456']);

      bot.disconnect();
    });

    test('should handle null input', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: null
      });

      expect(bot.telegramChatIds).toEqual([]);

      bot.disconnect();
    });

    test('should handle undefined input', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true
      });

      expect(bot.telegramChatIds).toEqual([]);

      bot.disconnect();
    });

    test('should trim whitespace from IDs', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: '  -100123  ,  -100456  '
      });

      expect(bot.telegramChatIds).toEqual(['-100123', '-100456']);

      bot.disconnect();
    });
  });

  describe('Message ID generation', () => {
    test('should generate telegram message ID', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        dbPath: ':memory:'
      });

      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Test'
      };

      bot.addTelegramMessage(telegramMessage);

      const messages = Array.from(bot.messages.values());
      expect(messages[0].id).toMatch(/^telegram-\d+-1$/);

      bot.disconnect();
    });

    test('should generate bridge message ID with message id', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true
      });

      bot.bridge.onMessage({
        sender: 'bridge-bot',
        content: 'Test',
        timestamp: '2024-01-01',
        id: 'bridge-123'
      });

      const messages = Array.from(bot.messages.values());
      expect(messages[0].id).toMatch(/^bridge-bridge-123$/);

      bot.disconnect();
    });

    test('should generate unique ID for bridge message without id', (done) => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true
      });

      bot.bridge.onMessage({
        sender: 'bridge-bot',
        content: 'Test',
        timestamp: '2024-01-01'
      });

      setTimeout(() => {
        const messages = Array.from(bot.messages.values());
        expect(messages[0].id).toMatch(/^generated-/);

        bot.disconnect();
        done();
      }, 100);
    });
  });

  describe('addMessage', () => {
    test('should call onNewMessage callback', (done) => {
      const onNewMessage = jest.fn();

      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        onNewMessage
      });

      bot.bridge.onMessage({
        sender: 'bridge-bot',
        content: 'Test',
        timestamp: '2024-01-01'
      });

      setTimeout(() => {
        expect(onNewMessage).toHaveBeenCalled();
        expect(onNewMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'bridge',
            sender: 'bridge-bot',
            content: 'Test'
          })
        );

        bot.disconnect();
        done();
      }, 200);
    });
  });

  describe('decideReply', () => {
    test('should call onDecideReply with context', (done) => {
      const onDecideReply = jest.fn().mockReturnValue({
        shouldReply: true,
        reply: 'Test reply'
      });

      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        onDecideReply
      });

      bot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello'
      });

      setTimeout(() => {
        const decision = bot.decideReply();

        expect(onDecideReply).toHaveBeenCalled();
        expect(decision).toEqual({
          shouldReply: true,
          reply: 'Test reply'
        });

        bot.disconnect();
        done();
      }, 200);
    });

    test('should return null when onDecideReply returns null', (done) => {
      const onDecideReply = jest.fn().mockReturnValue(null);

      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        onDecideReply
      });

      bot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello'
      });

      setTimeout(() => {
        const decision = bot.decideReply();

        expect(decision).toBeNull();

        bot.disconnect();
        done();
      }, 200);
    });
  });

  describe('getContext', () => {
    test('should return formatted context string', async (done) => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true
      });

      bot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello'
      });

      setTimeout(async () => {
        const context = await bot.getContext({ limit: 5 });

        expect(typeof context).toBe('string');
        expect(context).toContain('User');
        expect(context).toContain('Hello');

        bot.disconnect();
        done();
      }, 200);
    });

    test('should handle bridge messages in context', async (done) => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true
      });

      bot.bridge.onMessage({
        sender: 'bridge-bot',
        content: 'Bridge message',
        timestamp: '2024-01-01'
      });

      setTimeout(async () => {
        const context = await bot.getContext({ limit: 5 });

        expect(context).toContain('[来自 bridge-bot]');

        bot.disconnect();
        done();
      }, 200);
    });
  });

  describe('disconnect', () => {
    test('should call bridge disconnect', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true
      });

      const disconnectSpy = jest.spyOn(bot.bridge, 'disconnect');

      bot.disconnect();

      expect(disconnectSpy).toHaveBeenCalled();

      disconnectSpy.mockRestore();
    });
  });
});
