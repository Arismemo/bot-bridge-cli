/**
 * Simple coverage tests to verify basic functionality
 */

const { BotBridgeClient, ContextAwareBot } = require('../client/index');

describe('BotBridgeClient - Simple Tests', () => {
  test('should create client in HTTP-only mode', () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    expect(client).toBeDefined();
    expect(client.botId).toBe('test-bot');
    expect(client.httpOnly).toBe(true);
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  test('should handle sendMessage error when not connected', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    const result = await client.sendMessage('recipient', 'Hello');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    client.disconnect();
  });

  test('should handle broadcast when not connected', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    const result = await client.broadcast('Broadcast');

    expect(result).toEqual({ success: false, error: 'Not connected' });

    client.disconnect();
  });

  test('should handle healthCheck failure', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    const isHealthy = await client.healthCheck();

    expect(isHealthy).toBe(false);

    client.disconnect();
  });

  test('should handle getStatus error', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    const status = await client.getStatus();

    expect(status.success).toBe(false);
    expect(status.error).toBeDefined();

    client.disconnect();
  });

  test('should handle getConnectedBots error', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    const result = await client.getConnectedBots();

    expect(result.success).toBe(false);

    client.disconnect();
  });

  test('should handle getUnreadMessages error', async () => {
    const onError = jest.fn();

    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot',
      onError
    });

    const result = await client.getUnreadMessages();

    expect(result.success).toBe(false);
    expect(onError).toHaveBeenCalled();

    client.disconnect();
  });

  test('should handle markAsRead error', async () => {
    const onError = jest.fn();

    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot',
      onError
    });

    const result = await client.markAsRead('msg-123');

    expect(result.success).toBe(false);
    expect(onError).toHaveBeenCalled();

    client.disconnect();
  });

  test('should sendAck when connected and message has id', () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    // Mock connected state and ws
    client.connected = true;
    client.ws = {
      send: jest.fn(),
      close: jest.fn()
    };

    client.sendAck({ id: 'msg-123' });

    expect(client.ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'ack',
        messageId: 'msg-123'
      })
    );

    client.disconnect();
  });

  test('should not sendAck when not connected', () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    client.connected = false;

    // Should not throw
    expect(() => {
      client.sendAck({ id: 'msg-123' });
    }).not.toThrow();

    client.disconnect();
  });

  test('should not sendAck when message has no id', () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    client.connected = true;
    client.ws = {
      send: jest.fn(),
      close: jest.fn()
    };

    client.sendAck({ content: 'test' });

    expect(client.ws.send).not.toHaveBeenCalled();

    client.disconnect();
  });

  test('should replyTo original message', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    const originalMessage = {
      sender: 'other-bot',
      id: 'msg-456',
      content: 'Original'
    };

    const result = await client.replyTo(originalMessage, 'Reply');

    expect(result.success).toBe(false); // Not connected, so falls back to HTTP

    client.disconnect();
  });

  test('should disconnect properly', () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:9999',
      httpOnly: true,
      botId: 'test-bot'
    });

    client.connected = true;
    client.ws = {
      close: jest.fn()
    };

    client.disconnect();

    expect(client.ws.close).toHaveBeenCalled();
    expect(client.connected).toBe(false);
  });
});

describe('ContextAwareBot - Simple Tests', () => {
  test('should create bot with default config', (done) => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-context-bot',
      httpOnly: true,
      dbPath: ':memory:'
    });

    expect(bot).toBeDefined();
    expect(bot.bridge.botId).toBe('test-context-bot');
    expect(bot.telegramChatIds).toEqual([]);

    setTimeout(() => {
      bot.disconnect();
      done();
    }, 200);
  });

  test('should parse chat IDs from string', () => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true,
      telegramChatIds: '-100123, -100456, -100789'
    });

    expect(bot.telegramChatIds).toEqual(['-100123', '-100456', '-100789']);

    bot.disconnect();
  });

  test('should parse chat IDs from array', () => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true,
      telegramChatIds: ['-100123', '-100456']
    });

    expect(bot.telegramChatIds).toEqual(['-100123', '-100456']);

    bot.disconnect();
  });

  test('should handle empty chat IDs', () => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true,
      telegramChatIds: null
    });

    expect(bot.telegramChatIds).toEqual([]);

    bot.disconnect();
  });

  test('should add Telegram message', (done) => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true,
      dbPath: ':memory:'
    });

    const onNewMessage = jest.fn();

    bot.onNewMessage = onNewMessage;

    const telegramMessage = {
      message_id: 1,
      from: { id: 123, first_name: 'Test User' },
      chat: { id: -100123 },
      date: Date.now() / 1000,
      text: 'Hello from Telegram'
    };

    bot.addTelegramMessage(telegramMessage);

    setTimeout(() => {
      expect(onNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'telegram',
          sender: 'Test User',
          content: 'Hello from Telegram'
        })
      );

      bot.disconnect();
      done();
    }, 300);
  });

  test('should handle message with caption', (done) => {
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
      caption: 'Photo caption'
    };

    bot.addTelegramMessage(telegramMessage);

    setTimeout(() => {
      const messages = Array.from(bot.messages.values());
      expect(messages[0].content).toBe('Photo caption');

      bot.disconnect();
      done();
    }, 300);
  });

  test('should handle message with reply_to', (done) => {
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
      text: 'Reply message',
      reply_to_message: { message_id: 5 }
    };

    bot.addTelegramMessage(telegramMessage);

    setTimeout(() => {
      const messages = Array.from(bot.messages.values());
      expect(messages[0].metadata.reply_to_message_id).toBe(5);

      bot.disconnect();
      done();
    }, 300);
  });

  test('should generate unique ID for messages', (done) => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true,
      dbPath: ':memory:'
    });

    const telegramMessage1 = {
      message_id: 1,
      from: { id: 123, first_name: 'User' },
      chat: { id: -100123 },
      date: Date.now() / 1000,
      text: 'Message 1'
    };

    const telegramMessage2 = {
      message_id: 2,
      from: { id: 123, first_name: 'User' },
      chat: { id: -100123 },
      date: Date.now() / 1000,
      text: 'Message 2'
    };

    bot.addTelegramMessage(telegramMessage1);
    bot.addTelegramMessage(telegramMessage2);

    setTimeout(() => {
      const messages = Array.from(bot.messages.values());
      expect(messages[0].id).not.toBe(messages[1].id);

      bot.disconnect();
      done();
    }, 300);
  });

  test('should get empty chat history when no messages', async () => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true,
      dbPath: ':memory:'
    });

    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 200));

    const history = await bot.getChatHistory();
    expect(history).toEqual([]);

    bot.disconnect();
  });

  test('should expose bridge instance', () => {
    const bot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-bot',
      httpOnly: true
    });

    expect(bot.bridge).toBeDefined();
    expect(bot.bridge.botId).toBe('test-bot');
    expect(bot.telegramChatIds).toEqual([]);

    bot.disconnect();
  });

  test('should disconnect bridge', () => {
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
