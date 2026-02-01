/**
 * Comprehensive unit tests for BotBridgeClient with mocked dependencies
 * Using inline mock approach to avoid Jest hoisting issues
 */

// Inline mock for sqlite3
const mockDatabase = jest.fn();
const mockVerbose = jest.fn(() => ({ Database: mockDatabase }));

jest.mock('sqlite3', () => ({
  Database: mockDatabase,
  verbose: mockVerbose
}));

// Now we can require modules
const WebSocket = require('ws');
const axios = require('axios');
const { BotBridgeClient } = require('../client/index');

// Mock other dependencies
jest.mock('ws');
jest.mock('axios');

describe('BotBridgeClient - Comprehensive Coverage', () => {
  let mockWsInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock WebSocket instance
    mockWsInstance = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      readyState: WebSocket.OPEN
    };

    // Mock WebSocket constructor
    WebSocket.mockImplementation(() => mockWsInstance);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('WebSocket Connection Management', () => {
    test('should create WebSocket connection with correct URL', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:3000/?bot_id=test-bot');

      client.disconnect();
    });

    test('should handle HTTPS URL conversion', () => {
      const client = new BotBridgeClient({
        apiUrl: 'https://localhost:3000',
        botId: 'test-bot'
      });

      expect(WebSocket).toHaveBeenCalledWith('wss://localhost:3000/?bot_id=test-bot');

      client.disconnect();
    });

    test('should handle WS open event', (done) => {
      const onConnectionChange = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onConnectionChange
      });

      // Find open handler
      setTimeout(() => {
        const openHandler = mockWsInstance.on.mock.calls.find(call => call[0] === 'open');
        if (openHandler) {
          openHandler[1]();

          expect(onConnectionChange).toHaveBeenCalledWith(true);
          expect(client.connected).toBe(true);
          expect(client.reconnectAttempts).toBe(0);

          client.disconnect();
          done();
        }
      }, 10);
    });

    test('should handle WS message event', (done) => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onMessage
      });

      setTimeout(() => {
        const messageHandler = mockWsInstance.on.mock.calls.find(call => call[0] === 'message');
        if (messageHandler) {
          const testMessage = JSON.stringify({
            type: 'message',
            sender: 'other-bot',
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00Z',
            id: 'msg-123'
          });

          messageHandler[1](testMessage);

          expect(onMessage).toHaveBeenCalledWith({
            source: 'bridge',
            sender: 'other-bot',
            content: 'Hello',
            timestamp: '2024-01-01T00:00:00Z',
            metadata: undefined
          });

          expect(mockWsInstance.send).toHaveBeenCalledWith(
            JSON.stringify({ type: 'ack', messageId: 'msg-123' })
          );

          client.disconnect();
          done();
        }
      }, 10);
    });

    test('should handle WS close event', (done) => {
      const onConnectionChange = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onConnectionChange
      });

      setTimeout(() => {
        const closeHandler = mockWsInstance.on.mock.calls.find(call => call[0] === 'close');
        if (closeHandler) {
          closeHandler[1]();

          expect(onConnectionChange).toHaveBeenCalledWith(false);
          expect(client.connected).toBe(false);

          client.disconnect();
          done();
        }
      }, 10);
    });

    test('should handle WS error event', (done) => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onError
      });

      setTimeout(() => {
        const errorHandler = mockWsInstance.on.mock.calls.find(call => call[0] === 'error');
        if (errorHandler) {
          errorHandler[1](new Error('Connection error'));

          expect(onError).toHaveBeenCalledWith('WebSocket error: Connection error');

          client.disconnect();
          done();
        }
      }, 10);
    });
  });

  describe('Message Handling', () => {
    test('should handle unknown message type', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.handleMessage({ type: 'unknown_type' });

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Unknown message type')
      );

      consoleLog.mockRestore();
      client.disconnect();
    });

    test('should handle message with type "connected"', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.handleMessage({ type: 'connected' });

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Server acknowledged'));

      consoleLog.mockRestore();
      client.disconnect();
    });

    test('should handle pong message', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      expect(() => client.handleMessage({ type: 'pong' })).not.toThrow();

      client.disconnect();
    });

    test('should handle message and send ack', () => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onMessage
      });

      client.connected = true;
      client.ws = mockWsInstance;

      client.handleMessage({
        type: 'message',
        sender: 'sender',
        content: 'test',
        timestamp: '2024-01-01',
        id: 'msg-123'
      });

      expect(onMessage).toHaveBeenCalled();
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ack', messageId: 'msg-123' })
      );

      client.disconnect();
    });

    test('should handle message without sending ack if no id', () => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onMessage
      });

      client.connected = true;
      client.ws = mockWsInstance;

      client.handleMessage({
        type: 'message',
        sender: 'sender',
        content: 'test',
        timestamp: '2024-01-01'
      });

      expect(onMessage).toHaveBeenCalled();
      expect(mockWsInstance.send).not.toHaveBeenCalled();

      client.disconnect();
    });

    test('should not send ack if not connected', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = false;
      client.ws = mockWsInstance;

      client.handleMessage({
        type: 'message',
        sender: 'sender',
        content: 'test',
        timestamp: '2024-01-01',
        id: 'msg-123'
      });

      expect(mockWsInstance.send).not.toHaveBeenCalled();

      client.disconnect();
    });

    test('should handle unread_messages', () => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onMessage
      });

      client.connected = true;
      client.ws = mockWsInstance;

      client.handleMessage({
        type: 'unread_messages',
        count: 2,
        messages: [
          { sender: 'bot1', content: 'msg1', created_at: '2024-01-01', id: 'm1' },
          { sender: 'bot2', content: 'msg2', created_at: '2024-01-01', id: 'm2' }
        ]
      });

      expect(onMessage).toHaveBeenCalledTimes(2);

      client.disconnect();
    });

    test('should handle JSON parse error', () => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onError
      });

      const messageHandler = mockWsInstance.on.mock.calls.find(call => call[0] === 'message');
      if (messageHandler) {
        messageHandler[1]('invalid json{{{');

        expect(onError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse message')
        );
      }

      client.disconnect();
    });
  });

  describe('sendAck', () => {
    test('should send ack when connected and message has id', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      client.sendAck({ id: 'msg-123' });

      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ack', messageId: 'msg-123' })
      );

      client.disconnect();
    });

    test('should not send ack when not connected', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = false;
      client.ws = mockWsInstance;

      client.sendAck({ id: 'msg-123' });

      expect(mockWsInstance.send).not.toHaveBeenCalled();

      client.disconnect();
    });

    test('should not send ack when message has no id', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      client.sendAck({ content: 'test' });

      expect(mockWsInstance.send).not.toHaveBeenCalled();

      client.disconnect();
    });
  });

  describe('sendMessage', () => {
    test('should send message via WebSocket when connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      const result = await client.sendMessage('recipient', 'Hello');

      expect(result).toEqual({ success: true, sent: true });
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"recipient":"recipient"')
      );

      client.disconnect();
    });

    test('should send message with metadata via WebSocket', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      const result = await client.sendMessage('recipient', 'Hello', {
        reply_to: 'msg-123',
        custom: 'value'
      });

      expect(result).toEqual({ success: true, sent: true });
      expect(mockWsInstance.send).toHaveBeenCalled();

      const sentData = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      expect(sentData.metadata.reply_to).toBe('msg-123');
      expect(sentData.metadata.custom).toBe('value');

      client.disconnect();
    });

    test('should fallback to HTTP when not connected', async () => {
      axios.post.mockResolvedValue({
        data: { success: true, messageId: 'http-msg-123' }
      });

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = false;

      const result = await client.sendMessage('recipient', 'Hello');

      expect(result).toEqual({ success: true, messageId: 'http-msg-123' });
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/messages',
        {
          sender: 'test-bot',
          recipient: 'recipient',
          content: 'Hello',
          metadata: expect.any(Object)
        }
      );

      client.disconnect();
    });

    test('should handle HTTP send error', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        onError
      });

      client.connected = false;

      const result = await client.sendMessage('recipient', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(onError).toHaveBeenCalled();

      client.disconnect();
    });

    test('should include telegram_message_id in metadata', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      await client.sendMessage('recipient', 'Hello', {
        telegram_message_id: 12345
      });

      const sentData = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      expect(sentData.metadata.telegram_message_id).toBe(12345);

      client.disconnect();
    });
  });

  describe('broadcast', () => {
    test('should broadcast via WebSocket when connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      const result = await client.broadcast('Broadcast message');

      expect(result).toEqual({ success: true });
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"broadcast"')
      );

      client.disconnect();
    });

    test('should return error when not connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = false;

      const result = await client.broadcast('Broadcast');

      expect(result).toEqual({ success: false, error: 'Not connected' });

      client.disconnect();
    });

    test('should broadcast with metadata', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;

      await client.broadcast('Broadcast', { custom: 'data' });

      const sentData = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      expect(sentData.metadata.custom).toBe('data');

      client.disconnect();
    });
  });

  describe('flushMessageQueue', () => {
    test('should flush all queued messages', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.messageQueue = [
        { type: 'test1', data: 'data1' },
        { type: 'test2', data: 'data2' },
        { type: 'test3', data: 'data3' }
      ];

      client.ws = mockWsInstance;

      client.flushMessageQueue();

      expect(mockWsInstance.send).toHaveBeenCalledTimes(3);
      expect(client.messageQueue).toEqual([]);

      consoleLog.mockRestore();
      client.disconnect();
    });

    test('should do nothing when queue is empty', () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.messageQueue = [];
      client.ws = mockWsInstance;

      client.flushMessageQueue();

      expect(mockWsInstance.send).not.toHaveBeenCalled();

      consoleLog.mockRestore();
      client.disconnect();
    });
  });

  describe('replyTo', () => {
    test('should reply to original message', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.connected = true;
      client.ws = mockWsInstance;
      client.sendMessage = jest.fn().mockResolvedValue({ success: true });

      const originalMessage = {
        sender: 'original-sender',
        id: 'msg-456',
        content: 'Original'
      };

      await client.replyTo(originalMessage, 'Reply content', {
        custom: 'metadata'
      });

      expect(client.sendMessage).toHaveBeenCalledWith(
        'original-sender',
        'Reply content',
        {
          reply_to: 'msg-456',
          custom: 'metadata'
        }
      );

      client.disconnect();
    });
  });

  describe('HTTP API Methods', () => {
    describe('healthCheck', () => {
      test('should return true when health check succeeds', async () => {
        axios.get.mockResolvedValue({ status: 200 });

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const isHealthy = await client.healthCheck();

        expect(isHealthy).toBe(true);
        expect(axios.get).toHaveBeenCalledWith(
          'http://localhost:3000/health',
          { timeout: 3000 }
        );

        client.disconnect();
      });

      test('should return false when health check fails', async () => {
        axios.get.mockRejectedValue(new Error('Connection failed'));

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const isHealthy = await client.healthCheck();

        expect(isHealthy).toBe(false);

        client.disconnect();
      });
    });

    describe('getStatus', () => {
      test('should get status successfully', async () => {
        axios.get.mockResolvedValue({
          data: { success: true, status: 'running' }
        });

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const status = await client.getStatus();

        expect(status).toEqual({ success: true, status: 'running' });
        expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/api/status');

        client.disconnect();
      });

      test('should handle status error', async () => {
        axios.get.mockRejectedValue(new Error('API error'));

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const status = await client.getStatus();

        expect(status).toEqual({ success: false, error: 'API error' });

        client.disconnect();
      });
    });

    describe('getConnectedBots', () => {
      test('should get connected bots successfully', async () => {
        axios.get.mockResolvedValue({
          data: { success: true, bots: ['bot1', 'bot2'] }
        });

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const result = await client.getConnectedBots();

        expect(result).toEqual({ success: true, bots: ['bot1', 'bot2'] });
        expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/api/connections');

        client.disconnect();
      });

      test('should handle getConnectedBots error', async () => {
        axios.get.mockRejectedValue(new Error('Connection error'));

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const result = await client.getConnectedBots();

        expect(result).toEqual({ success: false, error: 'Connection error' });

        client.disconnect();
      });
    });

    describe('getUnreadMessages', () => {
      test('should get unread messages successfully', async () => {
        axios.get.mockResolvedValue({
          data: {
            success: true,
            messages: [
              { id: 'm1', content: 'msg1' },
              { id: 'm2', content: 'msg2' }
            ]
          }
        });

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const result = await client.getUnreadMessages();

        expect(result).toEqual({
          success: true,
          messages: [
            { id: 'm1', content: 'msg1' },
            { id: 'm2', content: 'msg2' }
          ]
        });

        expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/api/messages', {
          params: {
            recipient: 'test-bot',
            status: 'unread',
            limit: 50
          }
        });

        client.disconnect();
      });

      test('should handle getUnreadMessages error', async () => {
        const onError = jest.fn();

        axios.get.mockRejectedValue(new Error('Network error'));

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot',
          onError
        });

        const result = await client.getUnreadMessages();

        expect(result).toEqual({
          success: false,
          error: 'Network error',
          messages: []
        });

        expect(onError).toHaveBeenCalled();

        client.disconnect();
      });
    });

    describe('markAsRead', () => {
      test('should mark message as read successfully', async () => {
        axios.post.mockResolvedValue({
          data: { success: true }
        });

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot'
        });

        const result = await client.markAsRead('msg-123');

        expect(result).toEqual({ success: true });
        expect(axios.post).toHaveBeenCalledWith(
          'http://localhost:3000/api/messages/msg-123/read'
        );

        client.disconnect();
      });

      test('should handle markAsRead error', async () => {
        const onError = jest.fn();

        axios.post.mockRejectedValue(new Error('API error'));

        const client = new BotBridgeClient({
          apiUrl: 'http://localhost:3000',
          botId: 'test-bot',
          onError
        });

        const result = await client.markAsRead('msg-123');

        expect(result).toEqual({ success: false, error: 'API error' });
        expect(onError).toHaveBeenCalled();

        client.disconnect();
      });
    });
  });

  describe('disconnect', () => {
    test('should close WebSocket when exists', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.ws = mockWsInstance;
      client.connected = true;

      client.disconnect();

      expect(mockWsInstance.close).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });

    test('should handle WebSocket without close method', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.ws = {}; // Mock without close method
      client.connected = true;

      expect(() => client.disconnect()).not.toThrow();
      expect(client.connected).toBe(false);
    });

    test('should handle null WebSocket', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot'
      });

      client.ws = null;
      client.connected = true;

      expect(() => client.disconnect()).not.toThrow();
    });
  });
});
