const ContextAwareBot = require('../client/ContextAwareClient');
const MockWebSocketClient = require('./mocks/MockWebSocketClient');
const MockHttpClient = require('./mocks/MockHttpClient');
const MockDatabaseClient = require('./mocks/MockDatabaseClient');

describe('ContextAwareBot - Refactored with Dependency Injection', () => {
  let mockWs;
  let mockHttp;
  let mockDb;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockHttp = new MockHttpClient();
    mockDb = new MockDatabaseClient();
  });

  describe('Dependency Injection', () => {
    test('should use injected bridge', () => {
      const mockBridge = {
        sendMessage: jest.fn(),
        broadcast: jest.fn(),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        httpOnly: true
      });

      expect(bot.bridge).toBe(mockBridge);
    });

    test('should use injected database', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        dbPath: ':memory:',
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      expect(bot.db).toBe(mockDb);
      expect(mockDb.initialized).toBe(true);
    });
  });

  describe('Message Handling', () => {
    test('should add message to storage', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'test',
        sender: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(mockDb.countMessages()).toBe(1);
      const messages = mockDb.getAllMessages();
      const msg = messages[0];
      expect(msg).toBeDefined();
      expect(msg.content).toBe('Hello');
    });

    test('should generate unique ID for message', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'telegram',
        sender: 'User',
        content: 'Test message',
        timestamp: '2024-01-01T00:00:00Z'
      });

      const messages = mockDb.getAllMessages();
      expect(messages[0].id).toMatch(/^msg_\d+$/);
    });

    test('should use provided ID if available', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        id: 'custom-id',
        source: 'test',
        sender: 'user',
        content: 'Message',
        timestamp: '2024-01-01T00:00:00Z'
      });

      const msg = mockDb.findMessage('custom-id');
      expect(msg).toBeDefined();
      expect(msg.id).toBe('custom-id');
    });

    test('should save message to database', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'telegram',
        sender: 'User',
        content: 'Test',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(mockDb.countMessages()).toBe(1);
    });

    test('should handle database save error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      // Make saveMessage fail
      mockDb.saveMessage = jest.fn().mockRejectedValue(new Error('DB error'));

      await bot.addMessage({
        source: 'test',
        sender: 'user',
        content: 'Test',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(consoleError).toHaveBeenCalledWith(
        '[SQLite] Error saving message:',
        'DB error'
      );

      consoleError.mockRestore();
    });

    test('should trigger onNewMessage callback', async () => {
      const onNewMessage = jest.fn();

      const bot = new ContextAwareBot({
        db: mockDb,
        onNewMessage,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'test',
        sender: 'user',
        content: 'Test',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(onNewMessage).toHaveBeenCalled();
      expect(onNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'test',
          sender: 'user',
          content: 'Test'
        })
      );
    });

    test('should decide reply based on context', async () => {
      const onDecideReply = jest.fn().mockReturnValue({
        reply: 'I agree!',
        recipient: 'user'
      });

      const mockBridge = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        broadcast: jest.fn(),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        db: mockDb,
        onDecideReply,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'telegram',
        sender: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(onDecideReply).toHaveBeenCalled();
      expect(mockBridge.sendMessage).toHaveBeenCalledWith(
        'user',
        'I agree!',
        {}  // metadata defaults to {} in sendMessage
      );
    });

    test('should not send reply when decision returns null', async () => {
      const onDecideReply = jest.fn().mockReturnValue(null);

      const mockBridge = {
        sendMessage: jest.fn(),
        broadcast: jest.fn(),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        db: mockDb,
        onDecideReply,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'test',
        sender: 'user',
        content: 'Test',
        timestamp: '2024-01-01T00:00:00Z'
      });

      expect(mockBridge.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Chat History', () => {
    test('should return empty history when no messages', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      const history = bot.getChatHistory();

      expect(history).toEqual([]);
    });

    test('should return chat history sorted by timestamp', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      await bot.addMessage({
        source: 'test',
        sender: 'user1',
        content: 'Second',
        timestamp: '2024-01-01T00:00:02Z'
      });

      await bot.addMessage({
        source: 'test',
        sender: 'user2',
        content: 'First',
        timestamp: '2024-01-01T00:00:01Z'
      });

      await bot.addMessage({
        source: 'test',
        sender: 'user3',
        content: 'Third',
        timestamp: '2024-01-01T00:00:03Z'
      });

      const history = bot.getChatHistory();

      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('First');
      expect(history[1].content).toBe('Second');
      expect(history[2].content).toBe('Third');
    });

    test('should respect limit parameter', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      for (let i = 1; i <= 10; i++) {
        await bot.addMessage({
          source: 'test',
          sender: `user${i}`,
          content: `Message ${i}`,
          timestamp: `2024-01-01T00:00:0${i}Z`
        });
      }

      const history = bot.getChatHistory(5);

      expect(history).toHaveLength(5);
    });
  });

  describe('Bridge Integration', () => {
    test('should send message via bridge', async () => {
      const mockBridge = {
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        broadcast: jest.fn(),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        httpOnly: true
      });

      await bot.sendMessage('recipient', 'Hello', { key: 'value' });

      expect(mockBridge.sendMessage).toHaveBeenCalledWith(
        'recipient',
        'Hello',
        { key: 'value' }
      );
    });

    test('should broadcast via bridge', () => {
      const mockBridge = {
        sendMessage: jest.fn(),
        broadcast: jest.fn().mockReturnValue({ success: true }),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        httpOnly: true
      });

      bot.broadcast('Broadcast message', { custom: 'data' });

      expect(mockBridge.broadcast).toHaveBeenCalledWith(
        'Broadcast message',
        { custom: 'data' }
      );
    });

    test('should disconnect bridge', () => {
      const mockBridge = {
        sendMessage: jest.fn(),
        broadcast: jest.fn(),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        httpOnly: true
      });

      bot.disconnect();

      expect(mockBridge.disconnect).toHaveBeenCalled();
    });

    test('should listen to bridge messages', async () => {
      const mockBridge = {
        sendMessage: jest.fn(),
        broadcast: jest.fn(),
        disconnect: jest.fn(),
        onMessage: null
      };

      const bot = new ContextAwareBot({
        bridge: mockBridge,
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      // Simulate bridge receiving a message
      if (mockBridge.onMessage) {
        await mockBridge.onMessage({
          source: 'bridge',
          sender: 'other-bot',
          content: 'Hello from bridge',
          timestamp: '2024-01-01T00:00:00Z'
        });
      }

      expect(mockDb.countMessages()).toBe(1);
    });
  });

  describe('Telegram Message Handling', () => {
    test('should handle Telegram text message', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        telegramBotToken: 'test-token',
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      bot.handleTelegramMessage({
        message_id: 123,
        from: { id: 12345, first_name: 'John' },
        chat: { id: 67890 },
        text: 'Hello from Telegram'
      });

      const msg = mockDb.getAllMessages()[0];

      expect(msg.source).toBe('telegram');
      expect(msg.sender).toBe('John');
      expect(msg.content).toBe('Hello from Telegram');
      expect(msg.userId).toBe('12345');
      expect(msg.chatId).toBe('67890');
      expect(msg.messageId).toBe(123);
      expect(msg.metadata.telegram_message_id).toBe(123);
    });

    test('should handle Telegram message with caption', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      bot.handleTelegramMessage({
        message_id: 124,
        from: { id: 12345, first_name: 'Jane' },
        chat: { id: 67890 },
        caption: 'Image caption'
      });

      const msg = mockDb.getAllMessages()[0];

      expect(msg.content).toBe('Image caption');
    });

    test('should handle Telegram reply_to_message', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      bot.handleTelegramMessage({
        message_id: 125,
        from: { id: 12345, first_name: 'Bob' },
        chat: { id: 67890 },
        text: 'Reply',
        reply_to_message: {
          message_id: 100
        }
      });

      const msg = mockDb.getAllMessages()[0];

      expect(msg.metadata.reply_to).toBe(100);
    });

    test('should handle Telegram message without from field', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        httpOnly: true
      });

      await mockDb.initialize(':memory:');

      bot.handleTelegramMessage({
        message_id: 126,
        chat: { id: 67890 },
        text: 'Anonymous'
      });

      const msg = mockDb.getAllMessages()[0];

      expect(msg.sender).toBe('User');
    });
  });

  describe('Configuration', () => {
    test('should parse chat IDs from string', () => {
      const bot = new ContextAwareBot({
        telegramChatIds: '-1001234567890,-1009876543210',
        httpOnly: true
      });

      expect(bot.telegramChatIds).toEqual(['-1001234567890', '-1009876543210']);
    });

    test('should handle array of chat IDs', () => {
      const bot = new ContextAwareBot({
        telegramChatIds: ['-1001234567890', '-1009876543210'],
        httpOnly: true
      });

      expect(bot.telegramChatIds).toEqual(['-1001234567890', '-1009876543210']);
    });

    test('should handle empty chat IDs', () => {
      const bot = new ContextAwareBot({
        httpOnly: true
      });

      expect(bot.telegramChatIds).toEqual([]);
    });

    test('should load messages from database on initialization', async () => {
      const bot = new ContextAwareBot({
        db: mockDb,
        dbPath: ':memory:',
        httpOnly: true
      });

      // Pre-populate mock database
      mockDb.saveMessage({
        id: 'msg1',
        source: 'telegram',
        sender: 'User',
        content: 'Old message',
        timestamp: '2024-01-01T00:00:00Z'
      });

      await mockDb.initialize(':memory:');

      const bot2 = new ContextAwareBot({
        db: mockDb,
        dbPath: ':memory:',
        httpOnly: true
      });

      // Simulate database load completion
      mockDb.loadMessages = jest.fn().mockResolvedValue([
        { id: 'msg1', source: 'telegram', sender: 'User', content: 'Old message' }
      ]);

      await bot2.loadMessagesFromDb();

      expect(mockDb.loadMessages).toHaveBeenCalled();
    });
  });

  describe('ID Generation', () => {
    test('should generate consistent IDs for same message content', () => {
      const bot = new ContextAwareBot({ httpOnly: true });

      const id1 = bot.generateUniqueId('telegram', 'User', 'Test', '2024-01-01T00:00:00Z');
      const id2 = bot.generateUniqueId('telegram', 'User', 'Test', '2024-01-01T00:00:00Z');

      expect(id1).toBe(id2);
    });

    test('should generate different IDs for different messages', () => {
      const bot = new ContextAwareBot({ httpOnly: true });

      const id1 = bot.generateUniqueId('telegram', 'User', 'Message 1', '2024-01-01T00:00:00Z');
      const id2 = bot.generateUniqueId('telegram', 'User', 'Message 2', '2024-01-01T00:00:00Z');

      expect(id1).not.toBe(id2);
    });
  });
});
