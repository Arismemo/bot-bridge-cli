const BotBridgeClient = require('../client/BotBridgeClient');
const MockWebSocketClient = require('./mocks/MockWebSocketClient');
const MockHttpClient = require('./mocks/MockHttpClient');

describe('BotBridgeClient - Refactored with Dependency Injection', () => {
  let mockWs;
  let mockHttp;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockHttp = new MockHttpClient();
  });

  describe('Dependency Injection', () => {
    test('should use injected WebSocket client', (done) => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        expect(mockWs.url).toBe('ws://localhost:3000/?bot_id=test-bot');
        expect(mockWs.connected).toBe(true);
        client.disconnect();
        done();
      }, 10);
    });

    test('should use injected HTTP client', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setPostResponse('http://localhost:3000/api/messages', {
        data: { success: true, messageId: 'msg-123' }
      });

      const result = await client.sendMessage('recipient', 'Hello');

      expect(result.success).toBe(true);
      expect(mockHttp.postCalls).toHaveLength(1);
      expect(mockHttp.postCalls[0].url).toBe('http://localhost:3000/api/messages');
      client.disconnect();
    });
  });

  describe('WebSocket Connection', () => {
    test('should connect with correct URL', () => {
      const client = new BotBridgeClient({
        apiUrl: 'https://api.example.com:8443',
        botId: 'bot-1',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      expect(mockWs.url).toBe('wss://api.example.com:8443/?bot_id=bot-1');
      client.disconnect();
    });

    test('should trigger onConnectionChange on connect', (done) => {
      const onConnectionChange = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        onConnectionChange,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(true);
        client.disconnect();
        done();
      }, 10);
    });

    test('should handle WebSocket open event', (done) => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        expect(client.connected).toBe(true);
        expect(client.reconnectAttempts).toBe(0);
        client.disconnect();
        done();
      }, 10);
    });

    test('should handle WebSocket close event', (done) => {
      const onConnectionChange = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        onConnectionChange,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.close();
        setTimeout(() => {
          expect(onConnectionChange).toHaveBeenCalledWith(false);
          expect(client.connected).toBe(false);
          done();
        }, 10);
      }, 10);
    });

    test('should handle WebSocket error', (done) => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        onError,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateError(new Error('Connection failed'));
        expect(onError).toHaveBeenCalledWith('WebSocket error: Connection failed');
        done();
      }, 10);
    });
  });

  describe('Message Handling', () => {
    test('should handle connected message', (done) => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateReceiveMessage({ type: 'connected' });

        // Should handle without errors
        client.disconnect();
        done();
      }, 10);
    });

    test('should handle message type and trigger onMessage', (done) => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        onMessage,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateReceiveMessage({
          type: 'message',
          sender: 'other-bot',
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00Z',
          id: 'msg-123',
          metadata: { custom: 'value' }
        });

        expect(onMessage).toHaveBeenCalledWith({
          source: 'bridge',
          sender: 'other-bot',
          content: 'Hello',
          timestamp: '2024-01-01T00:00:00Z',
          metadata: { custom: 'value' }
        });

        client.disconnect();
        done();
      }, 10);
    });

    test('should send ack for message with id', (done) => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateReceiveMessage({
          type: 'message',
          id: 'msg-456',
          sender: 'sender',
          content: 'Test'
        });

        expect(mockWs.sentMessages).toHaveLength(1);
        expect(JSON.parse(mockWs.sentMessages[0])).toEqual({
          type: 'ack',
          messageId: 'msg-456'
        });

        client.disconnect();
        done();
      }, 10);
    });

    test('should handle unread_messages type', (done) => {
      const onMessage = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        onMessage,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateReceiveMessage({
          type: 'unread_messages',
          count: 2,
          messages: [
            { id: 'm1', sender: 'bot1', content: 'msg1', created_at: '2024-01-01' },
            { id: 'm2', sender: 'bot2', content: 'msg2', created_at: '2024-01-02' }
          ]
        });

        expect(onMessage).toHaveBeenCalledTimes(2);
        expect(onMessage).toHaveBeenNthCalledWith(1, {
          source: 'bridge',
          sender: 'bot1',
          content: 'msg1',
          timestamp: '2024-01-01',
          metadata: undefined
        });

        expect(onMessage).toHaveBeenNthCalledWith(2, {
          source: 'bridge',
          sender: 'bot2',
          content: 'msg2',
          timestamp: '2024-01-02',
          metadata: undefined
        });

        client.disconnect();
        done();
      }, 10);
    });

    test('should handle pong message', (done) => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateReceiveMessage({ type: 'pong' });

        // Should handle without errors or ack
        expect(mockWs.sentMessages).toHaveLength(0);
        client.disconnect();
        done();
      }, 10);
    });

    test('should handle unknown message type', (done) => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.simulateReceiveMessage({ type: 'unknown_type' });

        expect(consoleLog).toHaveBeenCalledWith(
          '[BotBridge] Unknown message type: unknown_type'
        );

        consoleLog.mockRestore();
        client.disconnect();
        done();
      }, 10);
    });

    test('should handle invalid JSON', (done) => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        onError,
        httpOnly: true
      });

      client.connect();

      setTimeout(() => {
        mockWs.trigger('message', 'invalid json{{{');

        expect(onError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to parse message')
        );

        client.disconnect();
        done();
      }, 10);
    });
  });

  describe('sendMessage', () => {
    test('should send via WebSocket when connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await client.sendMessage('recipient', 'Hello', { key: 'value' });

      expect(result).toEqual({ success: true, sent: true });
      expect(mockWs.sentMessages).toHaveLength(1);

      const sentMessage = JSON.parse(mockWs.sentMessages[0]);
      expect(sentMessage.type).toBe('send');
      expect(sentMessage.sender).toBe('test-bot');
      expect(sentMessage.recipient).toBe('recipient');
      expect(sentMessage.content).toBe('Hello');
      expect(sentMessage.metadata).toEqual({ key: 'value' });

      client.disconnect();
    });

    test('should fallback to HTTP when not connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setPostResponse('http://localhost:3000/api/messages', {
        data: { success: true, messageId: 'http-msg-123' }
      });

      const result = await client.sendMessage('recipient', 'Hello');

      expect(result.success).toBe(true);
      expect(mockHttp.postCalls).toHaveLength(1);
      expect(mockHttp.postCalls[0].data).toEqual({
        sender: 'test-bot',
        recipient: 'recipient',
        content: 'Hello',
        metadata: {}
      });

      client.disconnect();
    });

    test('should handle HTTP send error', async () => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        onError,
        httpOnly: true
      });

      mockHttp.setPostResponse('http://localhost:3000/api/messages', new Error('Network error'));

      const result = await client.sendMessage('recipient', 'Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to send message'));

      client.disconnect();
    });
  });

  describe('broadcast', () => {
    test('should broadcast when connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await client.broadcast('Broadcast message', { custom: 'data' });

      expect(result).toEqual({ success: true });
      expect(mockWs.sentMessages).toHaveLength(1);

      const sentMessage = JSON.parse(mockWs.sentMessages[0]);
      expect(sentMessage.type).toBe('broadcast');
      expect(sentMessage.content).toBe('Broadcast message');
      expect(sentMessage.metadata).toEqual({ custom: 'data' });

      client.disconnect();
    });

    test('should return error when not connected', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      const result = await client.broadcast('Broadcast');

      expect(result).toEqual({ success: false, error: 'Not connected' });
    });
  });

  describe('HTTP API Methods', () => {
    test('healthCheck should return true on success', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/health', { status: 200 });

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockHttp.getCalls[0].url).toBe('http://localhost:3000/health');
      expect(mockHttp.getCalls[0].options).toEqual({ timeout: 3000 });

      client.disconnect();
    });

    test('healthCheck should return false on error', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/health', new Error('Connection failed'));

      const isHealthy = await client.healthCheck();

      expect(isHealthy).toBe(false);

      client.disconnect();
    });

    test('getStatus should return status data', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/api/status', {
        data: { success: true, status: 'running' }
      });

      const status = await client.getStatus();

      expect(status).toEqual({ success: true, status: 'running' });

      client.disconnect();
    });

    test('getStatus should handle error', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/api/status', new Error('API error'));

      const status = await client.getStatus();

      expect(status).toEqual({ success: false, error: 'API error' });

      client.disconnect();
    });

    test('getConnectedBots should return bots list', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/api/connections', {
        data: { success: true, bots: ['bot1', 'bot2', 'bot3'] }
      });

      const result = await client.getConnectedBots();

      expect(result).toEqual({ success: true, bots: ['bot1', 'bot2', 'bot3'] });

      client.disconnect();
    });

    test('getConnectedBots should handle error', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/api/connections', new Error('Network error'));

      const result = await client.getConnectedBots();

      expect(result).toEqual({ success: false, error: 'Network error' });

      client.disconnect();
    });

    test('getUnreadMessages should return messages', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/api/messages', {
        data: {
          success: true,
          messages: [
            { id: 'm1', content: 'msg1' },
            { id: 'm2', content: 'msg2' }
          ]
        }
      });

      const result = await client.getUnreadMessages();

      expect(result).toEqual({
        success: true,
        messages: [
          { id: 'm1', content: 'msg1' },
          { id: 'm2', content: 'msg2' }
        ]
      });

      expect(mockHttp.getCalls[0].url).toBe('http://localhost:3000/api/messages');
      expect(mockHttp.getCalls[0].options.params).toEqual({
        recipient: 'test-bot',
        status: 'unread',
        limit: 50
      });

      client.disconnect();
    });

    test('getUnreadMessages should handle error', async () => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        onError,
        httpOnly: true
      });

      mockHttp.setGetResponse('http://localhost:3000/api/messages', new Error('Network error'));

      const result = await client.getUnreadMessages();

      expect(result).toEqual({
        success: false,
        error: 'Network error',
        messages: []
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch'));

      client.disconnect();
    });

    test('markAsRead should mark message', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        httpOnly: true
      });

      mockHttp.setPostResponse('http://localhost:3000/api/messages/msg-123/read', {
        data: { success: true }
      });

      const result = await client.markAsRead('msg-123');

      expect(result).toEqual({ success: true });
      expect(mockHttp.postCalls[0].url).toBe('http://localhost:3000/api/messages/msg-123/read');

      client.disconnect();
    });

    test('markAsRead should handle error', async () => {
      const onError = jest.fn();

      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpClient: mockHttp,
        onError,
        httpOnly: true
      });

      mockHttp.setPostResponse('http://localhost:3000/api/messages/msg-123/read', new Error('API error'));

      const result = await client.markAsRead('msg-123');

      expect(result).toEqual({ success: false, error: 'API error' });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Failed to mark'));

      client.disconnect();
    });
  });

  describe('replyTo', () => {
    test('should reply to original message', async () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      await new Promise(resolve => setTimeout(resolve, 10));

      const originalMessage = {
        id: 'original-123',
        sender: 'original-sender',
        content: 'Original message'
      };

      await client.replyTo(originalMessage, 'Reply content', { custom: 'metadata' });

      expect(mockWs.sentMessages).toHaveLength(1);

      const sentMessage = JSON.parse(mockWs.sentMessages[0]);
      expect(sentMessage.type).toBe('send');
      expect(sentMessage.sender).toBe('test-bot');
      expect(sentMessage.recipient).toBe('original-sender');
      expect(sentMessage.content).toBe('Reply content');
      expect(sentMessage.metadata).toEqual({
        reply_to: 'original-123',
        custom: 'metadata'
      });

      client.disconnect();
    });
  });

  describe('disconnect', () => {
    test('should close WebSocket connection', () => {
      const client = new BotBridgeClient({
        apiUrl: 'http://localhost:3000',
        botId: 'test-bot',
        wsClient: mockWs,
        httpOnly: true
      });

      client.connect();

      expect(mockWs.readyState).toBe(1);

      client.disconnect();

      expect(mockWs.readyState).toBe(3);
      expect(client.connected).toBe(false);
    });
  });
});
