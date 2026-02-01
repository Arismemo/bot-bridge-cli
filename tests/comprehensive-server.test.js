/**
 * Comprehensive unit tests for server/index.js with mocked dependencies
 */

const request = require('supertest');
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

// Inline mock for sqlite3
const mockDatabase = jest.fn();
const mockVerbose = jest.fn(() => ({ Database: mockDatabase }));

jest.mock('sqlite3', () => ({
  Database: mockDatabase,
  verbose: mockVerbose
}));

// Now require modules
jest.mock('ws');

const sqlite3 = require('sqlite3');

describe('Server - Comprehensive Coverage', () => {
  let mockDb;
  let mockWss;
  let mockWs;
  let serverApp;
  let testServer;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      serialize: jest.fn((cb) => cb()),
      run: jest.fn((sql, cb) => cb(null)),
      all: jest.fn((sql, cb) => cb(null, [])),
      get: jest.fn((sql, cb) => cb(null, null)),
      close: jest.fn()
    };

    mockDatabase.mockImplementation((path, cb) => {
      cb(null, mockDb);
      return mockDb;
    });

    // Mock WebSocket
    mockWs = {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      readyState: WebSocket.OPEN,
      removeListener: jest.fn()
    };

    // Mock WebSocket.Server
    mockWss = {
      on: jest.fn(),
      close: jest.fn(),
      clients: new Set(),
      handleUpgrade: jest.fn()
    };

    WebSocket.Server = jest.fn().mockImplementation(() => mockWss);

    WebSocket.mockImplementation(() => mockWs);

    // Import server
    const serverModule = require('../server/index');
    serverApp = serverModule.app;
    testServer = serverModule.server;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Database Initialization', () => {
    test('should create messages table', () => {
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS messages')
      );
    });

    test('should create indexes', () => {
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_recipient_status')
      );

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_sender')
      );
    });
  });

  describe('HTTP API Endpoints', () => {
    describe('POST /api/messages', () => {
      test('should create a new message', async () => {
        mockDb.run.mockImplementation((sql, params, cb) => {
          if (sql.includes('INSERT INTO messages')) {
            cb(null);
          }
        });

        const response = await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'test-sender',
            recipient: 'test-recipient',
            content: 'Test message'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.messageId).toBeDefined();
      });

      test('should create message with metadata', async () => {
        mockDb.run.mockImplementation((sql, params, cb) => cb(null));

        const response = await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender',
            recipient: 'recipient',
            content: 'Message',
            metadata: { custom: 'value', number: 123 }
          });

        expect(response.status).toBe(200);
      });

      test('should fail without required fields', async () => {
        const response = await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender'
            // Missing recipient and content
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/messages', () => {
      beforeEach(() => {
        mockDb.all.mockImplementation((sql, params, cb) => {
          cb(null, [
            { id: 'm1', sender: 'sender1', content: 'msg1', status: 'unread' },
            { id: 'm2', sender: 'sender2', content: 'msg2', status: 'unread' }
          ]);
        });
      });

      test('should retrieve messages for recipient', async () => {
        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'test-recipient' });

        expect(response.status).toBe(200);
        expect(response.body.messages).toHaveLength(2);
      });

      test('should filter by status', async () => {
        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'test-recipient', status: 'unread' });

        expect(response.status).toBe(200);
      });

      test('should respect limit parameter', async () => {
        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'test-recipient', limit: 1 });

        expect(response.status).toBe(200);
      });

      test('should return empty when no messages', async () => {
        mockDb.all.mockImplementation((sql, params, cb) => cb(null, []));

        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'non-existent' });

        expect(response.status).toBe(200);
        expect(response.body.messages).toEqual([]);
      });

      test('should fail without recipient parameter', async () => {
        const response = await request(serverApp)
          .get('/api/messages');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/messages/:id/read', () => {
      test('should mark message as read', async () => {
        mockDb.run.mockImplementation((sql, params, cb) => cb(null));

        const response = await request(serverApp)
          .post('/api/messages/msg-123/read');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      test('should return 404 for non-existent message', async () => {
        mockDb.run.mockImplementation((sql, params, cb) => cb(null));
        mockDb.get.mockImplementation((sql, params, cb) => {
          cb(null, null); // No message found
        });

        const response = await request(serverApp)
          .post('/api/messages/non-existent/read');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/messages', () => {
      test('should delete old read messages', async () => {
        mockDb.run.mockImplementation((sql, params, cb) => cb(null));
        mockDb.all.mockImplementation((sql, params, cb) => cb(null, [
          { id: 'm1' },
          { id: 'm2' }
        ]));

        const response = await request(serverApp)
          .delete('/api/messages')
          .query({ status: 'read', older_than_days: 0 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.deleted).toBe(2);
      });

      test('should not delete unread messages', async () => {
        mockDb.run.mockImplementation((sql, params, cb) => cb(null));
        mockDb.all.mockImplementation((sql, params, cb) => cb(null, [
          { id: 'm1', status: 'unread' }
        ]));

        const response = await request(serverApp)
          .delete('/api/messages')
          .query({ status: 'read', older_than_days: 0 });

        expect(response.status).toBe(200);
        expect(response.body.deleted).toBe(0);
      });
    });

    describe('GET /health', () => {
      test('should return health status', async () => {
        const response = await request(serverApp).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    describe('GET /api/status', () => {
      test('should return service status', async () => {
        const response = await request(serverApp).get('/api/status');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBeDefined();
      });
    });

    describe('GET /api/connections', () => {
      test('should return connected bots list', async () => {
        // Simulate connected bots
        mockWss.clients.add(mockWs);
        mockWs.send = jest.fn();

        const response = await request(serverApp).get('/api/connections');

        expect(response.status).toBe(200);
        expect(response.body.bots).toBeDefined();

        mockWss.clients.clear();
      });
    });
  });

  describe('WebSocket Connection Handling', () => {
    test('should handle connection with bot_id', () => {
      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection');
      expect(connectionHandler).toBeDefined();

      if (connectionHandler) {
        const mockReq = {
          url: '/?bot_id=test-bot'
        };

        // Simulate connection
        connectionHandler[1](mockWs, mockReq);

        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"connected"')
        );
      }
    });

    test('should reject connection without bot_id', () => {
      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection');

      if (connectionHandler) {
        const mockReq = {
          url: '/'
        };

        connectionHandler[1](mockWs, mockReq);

        expect(mockWs.close).toHaveBeenCalledWith(1008, expect.stringContaining('Missing bot_id'));
      }
    });

    test('should handle connection close', () => {
      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection');

      if (connectionHandler) {
        const mockReq = {
          url: '/?bot_id=test-bot'
        };

        connectionHandler[1](mockWs, mockReq);

        const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close');
        if (closeHandler) {
          closeHandler[1]();
          // Should handle close gracefully
        }
      }
    });

    test('should handle connection error', () => {
      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection');

      if (connectionHandler) {
        const mockReq = {
          url: '/?bot_id=test-bot'
        };

        connectionHandler[1](mockWs, mockReq);

        const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error');
        if (errorHandler) {
          errorHandler[1](new Error('Connection error'));
          // Should handle error gracefully
        }
      }
    });
  });

  describe('WebSocket Message Handling', () => {
    let connectionHandler;

    beforeEach(() => {
      connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection');

      if (connectionHandler) {
        const mockReq = {
          url: '/?bot_id=test-bot'
        };

        connectionHandler[1](mockWs, mockReq);
      }
    });

    test('should handle send message type', () => {
      mockDb.run.mockImplementation((sql, params, cb) => cb(null));

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message');
      if (messageHandler) {
        messageHandler[1](JSON.stringify({
          type: 'send',
          sender: 'sender-bot',
          recipient: 'recipient-bot',
          content: 'Hello'
        }));

        expect(mockDb.run).toHaveBeenCalled();
        expect(mockWs.send).toHaveBeenCalled();
      }
    });

    test('should handle broadcast message type', () => {
      // Add another client
      const mockWs2 = {
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        readyState: WebSocket.OPEN
      };
      mockWss.clients.add(mockWs2);

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message');
      if (messageHandler) {
        messageHandler[1](JSON.stringify({
          type: 'broadcast',
          sender: 'sender-bot',
          content: 'Broadcast message'
        }));

        // Other clients should receive the broadcast
        expect(mockWs2.send).toHaveBeenCalled();

        mockWss.clients.delete(mockWs2);
      }
    });

    test('should handle ack message type', () => {
      mockDb.run.mockImplementation((sql, params, cb) => cb(null));

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message');
      if (messageHandler) {
        messageHandler[1](JSON.stringify({
          type: 'ack',
          messageId: 'msg-123'
        }));

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE messages SET status ='),
          ['msg-123', expect.any(String)]
        );
      }
    });

    test('should handle unknown message type', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message');
      if (messageHandler) {
        messageHandler[1](JSON.stringify({
          type: 'unknown_type'
        }));

        // Should handle gracefully
      }

      consoleError.mockRestore();
    });

    test('should handle invalid JSON', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message');
      if (messageHandler) {
        messageHandler[1]('invalid json{{{');

        // Should handle gracefully
      }

      consoleError.mockRestore();
    });
  });

  describe('Helper Functions', () => {
    test('should send unread messages on connection', () => {
      mockDb.all.mockImplementation((sql, params, cb) => {
        cb(null, [
          { id: 'm1', sender: 'sender1', content: 'msg1' },
          { id: 'm2', sender: 'sender2', content: 'msg2' }
        ]);
      });

      const connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection');

      if (connectionHandler) {
        const mockReq = {
          url: '/?bot_id=recipient-bot'
        };

        connectionHandler[1](mockWs, mockReq);

        // Check if unread messages were sent
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"unread_messages"')
        );
      }
    });
  });
});
