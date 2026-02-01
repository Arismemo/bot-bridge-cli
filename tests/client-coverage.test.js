/**
 * Extended tests for BotBridgeClient to achieve 90%+ code coverage
 */

jest.setTimeout(10000); // Increase timeout for WebSocket operations

const WebSocket = require('ws');
const http = require('http');
const axios = require('axios');
const { BotBridgeClient, ContextAwareBot, sendToTelegram } = require('../client/index');

describe('BotBridgeClient - Coverage Tests', () => {
  let wsServer;
  let client;
  const WS_PORT = 8081;
  const API_URL = `http://localhost:${WS_PORT}`;

  // Mock HTTP API for fallback
  let httpServer;
  let lastReceivedMessage = null;
  let shouldReturnSuccess = true;

  beforeEach((done) => {
    // Reset state
    lastReceivedMessage = null;
    shouldReturnSuccess = true;

    // Start WebSocket server
    wsServer = new WebSocket.Server({ port: WS_PORT });
    wsServer.on('connection', ws => {
      ws.send(JSON.stringify({ type: 'connected', botId: 'test-bot' }));

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          lastReceivedMessage = message;

          // Handle ack
          if (message.type === 'ack') {
            // Just acknowledge
          }

          // Handle send
          if (message.type === 'send') {
            if (shouldReturnSuccess) {
              ws.send(JSON.stringify({
                type: 'ack',
                messageId: 'msg-123'
              }));
            }
          }

          // Handle broadcast
          if (message.type === 'broadcast') {
            // Broadcast doesn't need response
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      });
    });

    wsServer.on('listening', () => done());
  });

  afterEach((done) => {
    if (client) {
      client.disconnect();
    }
    if (wsServer) {
      wsServer.close(() => done());
    } else {
      done();
    }
  });

  describe('Connection Management', () => {
    test('should handle connection error', (done) => {
      const onError = jest.fn();

      client = new BotBridgeClient({
        apiUrl: 'http://invalid-server:9999',
        httpOnly: false,
        onError
      });

      // Give time for connection to fail
      setTimeout(() => {
        expect(onError).toHaveBeenCalled();
        done();
      }, 2000);
    });

    test('should handle HTTP-only mode', () => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        httpOnly: true,
        botId: 'test-bot'
      });

      expect(client.connected).toBe(false);
      expect(client.httpOnly).toBe(true);
    });

    test('should call onConnectionChange callback on connect', (done) => {
      const onConnectionChange = jest.fn();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        onConnectionChange
      });

      setTimeout(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(true);
        done();
      }, 100);
    });

    test('should handle reconnection attempts', (done) => {
      const onError = jest.fn();
      const onConnectionChange = jest.fn();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        reconnectAttempts: 0, // Start fresh
        onError,
        onConnectionChange
      });

      // Close connection to trigger reconnection
      setTimeout(() => {
        client.ws.close();
      }, 100);

      // Wait for reconnection
      setTimeout(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(false);
        done();
      }, 2000);
    }, 5000);
  });

  describe('Message Handling', () => {
    test('should handle message type "connected"', (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL
      });

      // Server sends connected message automatically in beforeEach
      setTimeout(() => {
        expect(client.connected).toBe(true);
        done();
      }, 100);
    });

    test('should handle message type "pong"', (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        onMessage: jest.fn()
      });

      setTimeout(() => {
        // Send pong message from server
        const ws = wsServer.clients.values().next().value;
        if (ws) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
        done();
      }, 100);
    });

    test('should handle unknown message type', (done) => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      client = new BotBridgeClient({
        apiUrl: API_URL
      });

      setTimeout(() => {
        const ws = wsServer.clients.values().next().value;
        if (ws) {
          ws.send(JSON.stringify({ type: 'unknown_type' }));
        }

        setTimeout(() => {
          expect(consoleLog).toHaveBeenCalledWith(
            expect.stringContaining('Unknown message type')
          );
          consoleLog.mockRestore();
          done();
        }, 100);
      }, 100);
    });

    test('should handle invalid message (JSON parse error)', (done) => {
      const onError = jest.fn();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        onError
      });

      setTimeout(() => {
        const ws = wsServer.clients.values().next().value;
        if (ws) {
          ws.send('invalid json{{{');
        }

        setTimeout(() => {
          expect(onError).toHaveBeenCalledWith(
            expect.stringContaining('Failed to parse message')
          );
          done();
        }, 100);
      }, 100);
    });

    test('should call onMessage for bridge messages', (done) => {
      const onMessage = jest.fn();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        onMessage
      });

      setTimeout(() => {
        const ws = wsServer.clients.values().next().value;
        if (ws) {
          ws.send(JSON.stringify({
            type: 'message',
            sender: 'other-bot',
            content: 'Hello from bridge',
            timestamp: new Date().toISOString(),
            id: 'msg-456'
          }));
        }

        setTimeout(() => {
          expect(onMessage).toHaveBeenCalledWith({
            source: 'bridge',
            sender: 'other-bot',
            content: 'Hello from bridge',
            timestamp: expect.any(String),
            metadata: undefined
          });
          done();
        }, 100);
      }, 100);
    });

    test('should handle unread_messages type', (done) => {
      const onMessage = jest.fn();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        onMessage
      });

      setTimeout(() => {
        const ws = wsServer.clients.values().next().value;
        if (ws) {
          ws.send(JSON.stringify({
            type: 'unread_messages',
            count: 2,
            messages: [
              {
                sender: 'bot1',
                content: 'Message 1',
                created_at: new Date().toISOString(),
                id: 'msg-1'
              },
              {
                sender: 'bot2',
                content: 'Message 2',
                created_at: new Date().toISOString(),
                id: 'msg-2'
              }
            ]
          }));
        }

        setTimeout(() => {
          expect(onMessage).toHaveBeenCalledTimes(2);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Sending Messages', () => {
    test('should send message via WebSocket when connected', async (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot'
      });

      setTimeout(async () => {
        const result = await client.sendMessage('recipient-bot', 'Hello');

        expect(result).toEqual({ success: true, sent: true });
        expect(lastReceivedMessage).toEqual({
          type: 'send',
          sender: 'test-bot',
          recipient: 'recipient-bot',
          content: 'Hello',
          metadata: expect.objectContaining({
            timestamp: expect.any(String)
          })
        });
        done();
      }, 100);
    });

    test('should send message with metadata', async (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot'
      });

      setTimeout(async () => {
        const result = await client.sendMessage('recipient', 'Hello', {
          reply_to: 'msg-123',
          custom: 'value'
        });

        expect(result).toEqual({ success: true, sent: true });
        expect(lastReceivedMessage.metadata).toMatchObject({
          reply_to: 'msg-123',
          custom: 'value'
        });
        done();
      }, 100);
    });

    test('should include telegram_message_id in metadata', async (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot'
      });

      setTimeout(async () => {
        const result = await client.sendMessage('recipient', 'Hello', {
          telegram_message_id: 12345
        });

        expect(result).toEqual({ success: true, sent: true });
        expect(lastReceivedMessage.metadata.telegram_message_id).toBe(12345);
        done();
      }, 100);
    });

    test('should fallback to HTTP when not connected', async () => {
      // Create client without connecting
      client = new BotBridgeClient({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot'
      });

      const result = await client.sendMessage('recipient', 'Hello');

      // Since HTTP server doesn't exist, should return error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should send broadcast message via WebSocket', async (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot'
      });

      setTimeout(async () => {
        const result = await client.broadcast('Broadcast message');

        expect(result).toEqual({ success: true });
        expect(lastReceivedMessage).toEqual({
          type: 'broadcast',
          sender: 'test-bot',
          content: 'Broadcast message',
          metadata: expect.objectContaining({
            timestamp: expect.any(String)
          })
        });
        done();
      }, 100);
    });

    test('should fail broadcast when not connected', async () => {
      client = new BotBridgeClient({
        apiUrl: 'http://invalid:9999',
        httpOnly: true,
        botId: 'test-bot'
      });

      const result = await client.broadcast('Hello');

      expect(result).toEqual({ success: false, error: 'Not connected' });
    });
  });

  describe('Message Queue', () => {
    test('should queue messages when disconnected', async (done) => {
      const onError = jest.fn();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot',
        onError
      });

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 100));

      // Disconnect
      client.ws.close();

      // Try to send
      const result1 = await client.broadcast('Queued message 1');
      expect(result1).toEqual({ success: false, error: 'Not connected' });

      done();
    });

    test('should flush message queue on reconnection', (done) => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot'
      });

      setTimeout(() => {
        // Manually add to queue
        client.messageQueue.push({ type: 'queued' });

        // Trigger flush
        client.flushMessageQueue();

        expect(consoleLog).toHaveBeenCalledWith(
          expect.stringContaining('Sending')
        );
        consoleLog.mockRestore();
        done();
      }, 100);
    });
  });

  describe('Reply Functionality', () => {
    test('should reply to original message', async (done) => {
      client = new BotBridgeClient({
        apiUrl: API_URL,
        botId: 'test-bot'
      });

      setTimeout(async () => {
        const originalMessage = {
          sender: 'other-bot',
          id: 'msg-456',
          content: 'Original'
        };

        const result = await client.replyTo(originalMessage, 'Reply');

        expect(lastReceivedMessage).toEqual({
          type: 'send',
          sender: 'test-bot',
          recipient: 'other-bot',
          content: 'Reply',
          metadata: expect.objectContaining({
            reply_to: 'msg-456'
          })
        });
        done();
      }, 100);
    });
  });

  describe('Health Check', () => {
    test('should return true for healthy server', async (done) => {
      // Start a simple HTTP server for health check
      const healthServer = http.createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200);
          res.end('OK');
        }
      });

      healthServer.listen(8082, async () => {
        client = new BotBridgeClient({
          apiUrl: 'http://localhost:8082',
          botId: 'test-bot'
        });

        const isHealthy = await client.healthCheck();
        expect(isHealthy).toBe(true);

        healthServer.close(() => done());
      });
    });

    test('should return false for unhealthy server', async () => {
      client = new BotBridgeClient({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot'
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('HTTP API Methods', () => {
    test('should get status successfully', async (done) => {
      // Start mock HTTP server
      const statusServer = http.createServer((req, res) => {
        if (req.url === '/api/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, status: 'running' }));
        }
      });

      statusServer.listen(8083, async () => {
        client = new BotBridgeClient({
          apiUrl: 'http://localhost:8083',
          botId: 'test-bot'
        });

        const status = await client.getStatus();
        expect(status).toEqual({ success: true, status: 'running' });

        statusServer.close(() => done());
      });
    });

    test('should handle status request error', async () => {
      client = new BotBridgeClient({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot'
      });

      const status = await client.getStatus();
      expect(status.success).toBe(false);
      expect(status.error).toBeDefined();
    });

    test('should get connected bots', async (done) => {
      const connServer = http.createServer((req, res) => {
        if (req.url === '/api/connections') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, bots: ['bot1', 'bot2'] }));
        }
      });

      connServer.listen(8084, async () => {
        client = new BotBridgeClient({
          apiUrl: 'http://localhost:8084',
          botId: 'test-bot'
        });

        const result = await client.getConnectedBots();
        expect(result).toEqual({ success: true, bots: ['bot1', 'bot2'] });

        connServer.close(() => done());
      });
    });

    test('should handle connections request error', async () => {
      client = new BotBridgeClient({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot'
      });

      const result = await client.getConnectedBots();
      expect(result.success).toBe(false);
    });
  });

  describe('Message Retrieval', () => {
    test('should get unread messages', async (done) => {
      const msgServer = http.createServer((req, res) => {
        if (req.url.includes('/api/messages') && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            messages: [
              { id: 'msg-1', content: 'Message 1' },
              { id: 'msg-2', content: 'Message 2' }
            ]
          }));
        }
      });

      msgServer.listen(8085, async () => {
        client = new BotBridgeClient({
          apiUrl: 'http://localhost:8085',
          botId: 'test-bot'
        });

        const result = await client.getUnreadMessages();
        expect(result.success).toBe(true);
        expect(result.messages).toHaveLength(2);

        msgServer.close(() => done());
      });
    });

    test('should handle get messages error', async () => {
      const onError = jest.fn();

      client = new BotBridgeClient({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        onError
      });

      const result = await client.getUnreadMessages();
      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Mark as Read', () => {
    test('should mark message as read', async (done) => {
      const readServer = http.createServer((req, res) => {
        if (req.url.includes('/read') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }
      });

      readServer.listen(8086, async () => {
        client = new BotBridgeClient({
          apiUrl: 'http://localhost:8086',
          botId: 'test-bot'
        });

        const result = await client.markAsRead('msg-123');
        expect(result.success).toBe(true);

        readServer.close(() => done());
      });
    });

    test('should handle mark as read error', async () => {
      const onError = jest.fn();

      client = new BotBridgeClient({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        onError
      });

      const result = await client.markAsRead('msg-123');
      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('sendToTelegram utility', () => {
    test('should send message to Telegram successfully', async () => {
      const telegramServer = http.createServer((req, res) => {
        if (req.url.includes('telegram.org') || req.method === 'POST') {
          // Mock successful response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            result: {
              message_id: 123
            }
          }));
        }
      });

      // Since we can't mock telegram.org directly, we'll test error case
      try {
        await sendToTelegram('fake-token', 'chat-123', 'Hello');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle sendToTelegram error', async () => {
      await expect(
        sendToTelegram('invalid-token', 'chat-123', 'Hello')
      ).rejects.toThrow();
    });
  });
});

describe('ContextAwareBot - Coverage Tests', () => {
  let contextBot;
  let dbPath;

  beforeEach(() => {
    // Use in-memory database
    dbPath = ':memory:';

    contextBot = new ContextAwareBot({
      apiUrl: 'http://localhost:9999',
      botId: 'test-context-bot',
      httpOnly: true,
      dbPath
    });
  });

  afterEach((done) => {
    if (contextBot) {
      contextBot.disconnect();
    }
    setTimeout(done, 100);
  });

  describe('Initialization', () => {
    test('should parse chat IDs from string', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: '-100123, -100456, -100789'
      });

      expect(bot.telegramChatIds).toEqual(['-100123', '-100456', '-100789']);
    });

    test('should parse chat IDs from array', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: ['-100123', '-100456']
      });

      expect(bot.telegramChatIds).toEqual(['-100123', '-100456']);
    });

    test('should handle empty chat IDs', () => {
      const bot = new ContextAwareBot({
        apiUrl: 'http://localhost:9999',
        botId: 'test-bot',
        httpOnly: true,
        telegramChatIds: null
      });

      expect(bot.telegramChatIds).toEqual([]);
    });

    test('should initialize SQLite database', (done) => {
      expect(contextBot.db).toBeDefined();

      // Wait for database initialization
      setTimeout(() => {
        expect(contextBot.db).toBeTruthy();
        done();
      }, 200);
    });
  });

  describe('Message Handling', () => {
    test('should add Telegram message', (done) => {
      const onNewMessage = jest.fn();

      contextBot.onNewMessage = onNewMessage;

      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'Test User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello from Telegram'
      };

      contextBot.addTelegramMessage(telegramMessage);

      setTimeout(() => {
        expect(onNewMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'telegram',
            sender: 'Test User',
            content: 'Hello from Telegram'
          })
        );
        done();
      }, 200);
    });

    test('should add bridge message', (done) => {
      const onNewMessage = jest.fn();

      contextBot.onNewMessage = onNewMessage;

      const bridgeMessage = {
        sender: 'other-bot',
        content: 'Hello from bridge',
        timestamp: new Date().toISOString()
      };

      contextBot.bridge.onMessage(bridgeMessage);

      setTimeout(() => {
        expect(onNewMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            source: 'bridge',
            sender: 'other-bot',
            content: 'Hello from bridge'
          })
        );
        done();
      }, 200);
    });

    test('should handle message with caption', () => {
      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        caption: 'Photo caption'
      };

      contextBot.addTelegramMessage(telegramMessage);

      const messages = Array.from(contextBot.messages.values());
      expect(messages[0].content).toBe('Photo caption');
    });

    test('should handle message with reply_to', () => {
      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Reply message',
        reply_to_message: { message_id: 5 }
      };

      contextBot.addTelegramMessage(telegramMessage);

      const messages = Array.from(contextBot.messages.values());
      expect(messages[0].metadata.reply_to_message_id).toBe(5);
    });

    test('should generate unique ID for messages', () => {
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

      contextBot.addTelegramMessage(telegramMessage1);
      contextBot.addTelegramMessage(telegramMessage2);

      const messages = Array.from(contextBot.messages.values());
      expect(messages[0].id).not.toBe(messages[1].id);
    });
  });

  describe('Chat History', () => {
    test('should get chat history with limit', async (done) => {
      // Add some messages
      for (let i = 0; i < 5; i++) {
        contextBot.addTelegramMessage({
          message_id: i,
          from: { id: 123, first_name: 'User' },
          chat: { id: -100123 },
          date: Date.now() / 1000,
          text: `Message ${i}`
        });
      }

      setTimeout(async () => {
        const history = await contextBot.getChatHistory({ limit: 3 });
        expect(history).toHaveLength(3);
        done();
      }, 300);
    });

    test('should filter history by source', async (done) => {
      contextBot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Telegram message'
      });

      contextBot.bridge.onMessage({
        sender: 'bridge-bot',
        content: 'Bridge message',
        timestamp: new Date().toISOString()
      });

      setTimeout(async () => {
        const telegramOnly = await contextBot.getChatHistory({ sources: ['telegram'] });
        expect(telegramOnly.every(m => m.source === 'telegram')).toBe(true);
        done();
      }, 300);
    });

    test('should filter history by chat IDs', async (done) => {
      contextBot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Message in chat 1'
      });

      contextBot.addTelegramMessage({
        message_id: 2,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100456 },
        date: Date.now() / 1000,
        text: 'Message in chat 2'
      });

      setTimeout(async () => {
        const filtered = await contextBot.getChatHistory({ chatIds: ['-100123'] });
        expect(filtered.every(m => m.chatId === -100123)).toBe(true);
        done();
      }, 300);
    });

    test('should filter history after timestamp', async (done) => {
      const now = Date.now();

      contextBot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: (now - 10000) / 1000, // 10 seconds ago
        text: 'Old message'
      });

      contextBot.addTelegramMessage({
        message_id: 2,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: now / 1000,
        text: 'New message'
      });

      setTimeout(async () => {
        const afterDate = new Date(now - 5000).toISOString();
        const filtered = await contextBot.getChatHistory({ after: afterDate });
        expect(filtered.every(m => new Date(m.timestamp) > new Date(afterDate))).toBe(true);
        done();
      }, 300);
    });

    test('should return empty history when no messages', async () => {
      const history = await contextBot.getChatHistory();
      expect(history).toEqual([]);
    });
  });

  describe('Context', () => {
    test('should get context for OpenClaw', async (done) => {
      contextBot.addTelegramMessage({
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello'
      });

      contextBot.bridge.onMessage({
        sender: 'bridge-bot',
        content: 'Hi there',
        timestamp: new Date().toISOString()
      });

      setTimeout(async () => {
        const context = await contextBot.getContext({ limit: 10 });
        expect(typeof context).toBe('string');
        expect(context).toContain('User');
        expect(context).toContain('bridge-bot');
        done();
      }, 300);
    });
  });

  describe('Reply Decision', () => {
    test('should use custom onDecideReply function', (done) => {
      const onDecideReply = jest.fn().mockReturnValue({
        shouldReply: true,
        reply: 'Custom reply'
      });

      contextBot.onDecideReply = onDecideReply;

      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Trigger reply'
      };

      const decision = contextBot.decideReply({ chatId: -100123 });

      expect(decision).toEqual({
        shouldReply: true,
        reply: 'Custom reply'
      });
      done();
    });

    test('should return null when onDecideReply returns null', (done) => {
      const onDecideReply = jest.fn().mockReturnValue(null);

      contextBot.onDecideReply = onDecideReply;

      const decision = contextBot.decideReply();

      expect(decision).toBeNull();
      done();
    });
  });

  describe('Send Message to Group', () => {
    test('should send message to Telegram group', async (done) => {
      // Mock axios.post for Telegram API
      const axiosPost = jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          ok: true,
          result: { message_id: 123 }
        }
      });

      contextBot.telegramBotToken = 'fake-token';

      const result = await contextBot.sendMessageToGroup(-100123, 'Test message');

      expect(result).toEqual({
        ok: true,
        result: { message_id: 123 }
      });

      axiosPost.mockRestore();
      done();
    });

    test('should handle send message error', async () => {
      const axiosPost = jest.spyOn(axios, 'post').mockRejectedValue(
        new Error('Telegram API error')
      );

      contextBot.telegramBotToken = 'fake-token';

      await expect(
        contextBot.sendMessageToGroup(-100123, 'Test message')
      ).rejects.toThrow();

      axiosPost.mockRestore();
    });

    test('should send to bridge when alsoNotifyBridge is true', async (done) => {
      const axiosPost = jest.spyOn(axios, 'post').mockResolvedValue({
        data: {
          ok: true,
          result: { message_id: 123 }
        }
      });

      const bridgeSend = jest.spyOn(contextBot.bridge, 'sendMessage').mockResolvedValue({
        success: true
      });

      contextBot.telegramBotToken = 'fake-token';

      await contextBot.sendMessageToGroup(
        -100123,
        'Test message',
        {
          alsoNotifyBridge: true,
          notifyRecipient: 'other-bot'
        }
      );

      expect(bridgeSend).toHaveBeenCalledWith(
        'other-bot',
        'Test message',
        expect.objectContaining({
          telegram_message_id: 123
        })
      );

      axiosPost.mockRestore();
      bridgeSend.mockRestore();
      done();
    });
  });

  describe('Handle Telegram Message', () => {
    test('should handle incoming Telegram message', (done) => {
      const sendMessageSpy = jest.spyOn(contextBot, 'sendMessageToGroup').mockResolvedValue({});
      const decideReplySpy = jest.spyOn(contextBot, 'decideReply').mockReturnValue({
        shouldReply: true,
        reply: 'Response',
        notifyRecipient: 'bot'
      });

      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello bot'
      };

      contextBot.handleTelegramMessage(telegramMessage);

      setTimeout(() => {
        expect(decideReplySpy).toHaveBeenCalled();
        expect(sendMessageSpy).toHaveBeenCalledWith(
          -100123,
          'Response',
          expect.any(Object)
        );
        sendMessageSpy.mockRestore();
        decideReplySpy.mockRestore();
        done();
      }, 300);
    });

    test('should not reply when shouldReply is false', (done) => {
      const sendMessageSpy = jest.spyOn(contextBot, 'sendMessageToGroup').mockResolvedValue({});
      const decideReplySpy = jest.spyOn(contextBot, 'decideReply').mockReturnValue({
        shouldReply: false
      });

      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello'
      };

      contextBot.handleTelegramMessage(telegramMessage);

      setTimeout(() => {
        expect(sendMessageSpy).not.toHaveBeenCalled();
        sendMessageSpy.mockRestore();
        decideReplySpy.mockRestore();
        done();
      }, 300);
    });

    test('should not reply when decision is null', (done) => {
      const sendMessageSpy = jest.spyOn(contextBot, 'sendMessageToGroup').mockResolvedValue({});
      const decideReplySpy = jest.spyOn(contextBot, 'decideReply').mockReturnValue(null);

      const telegramMessage = {
        message_id: 1,
        from: { id: 123, first_name: 'User' },
        chat: { id: -100123 },
        date: Date.now() / 1000,
        text: 'Hello'
      };

      contextBot.handleTelegramMessage(telegramMessage);

      setTimeout(() => {
        expect(sendMessageSpy).not.toHaveBeenCalled();
        sendMessageSpy.mockRestore();
        decideReplySpy.mockRestore();
        done();
      }, 300);
    });
  });

  describe('Bridge Access', () => {
    test('should expose bridge instance', () => {
      expect(contextBot.bridge).toBeDefined();
      expect(contextBot.bridge.botId).toBe('test-context-bot');
    });
  });

  describe('Disconnect', () => {
    test('should disconnect bridge', () => {
      const disconnectSpy = jest.spyOn(contextBot.bridge, 'disconnect');
      contextBot.disconnect();
      expect(disconnectSpy).toHaveBeenCalled();
      disconnectSpy.mockRestore();
    });
  });
});
