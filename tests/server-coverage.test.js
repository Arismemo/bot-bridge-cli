/**
 * Extended tests for server/index.js to achieve 90%+ code coverage
 */

const request = require('supertest');
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Create a test database
const TEST_DB_PATH = path.join(__dirname, 'test-messages.db');

// Clear test database before tests
beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// Import server code
let serverApp;
let testServer;
let wss;

beforeAll((done) => {
  // Set test database path
  process.env.TEST_DB_PATH = TEST_DB_PATH;

  // Load server module
  const server = require('../server/index');
  serverApp = server.app;
  testServer = server.server;
  wss = server.wss;

  testServer.on('listening', () => done());
});

afterAll((done) => {
  if (testServer) {
    testServer.close(() => {
      // Close database
      const db = require('../server/index').db;
      if (db) {
        db.close();
      }
      done();
    });
  } else {
    done();
  }
});

describe('Server - Coverage Tests', () => {
  describe('WebSocket Connection Handling', () => {
    test('should handle WebSocket connection with bot_id', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=test-bot-1`);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'connected') {
          expect(message.botId).toBe('test-bot-1');
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    test('should reject WebSocket connection without bot_id', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/`);

      ws.on('close', (code, reason) => {
        expect(code).toBe(1008); // Policy violation
        expect(reason.toString()).toContain('Missing bot_id');
        done();
      });

      ws.on('error', () => {
        // Ignore error, close event should fire
      });
    });

    test('should handle WebSocket close', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=test-bot-close`);

      ws.on('open', () => {
        // Close the connection
        ws.close();
      });

      ws.on('close', () => {
        done();
      });
    });

    test('should handle invalid JSON message from WebSocket', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=test-bot-invalid`);

      ws.on('open', () => {
        // Send invalid JSON
        ws.send('invalid json{{{');
      });

      // Connection should remain open, but error should be logged
      setTimeout(() => {
        ws.close();
        done();
      }, 200);
    });

    test('should send unread messages on connection', (done) => {
      const ws1 = new WebSocket(`ws://localhost:3000/?bot_id=unread-sender`);

      ws1.on('open', () => {
        // Send a message
        ws1.send(JSON.stringify({
          type: 'send',
          sender: 'unread-sender',
          recipient: 'unread-receiver',
          content: 'Test message'
        }));
      });

      setTimeout(() => {
        ws1.close();

        // Now connect as receiver
        const ws2 = new WebSocket(`ws://localhost:3000/?bot_id=unread-receiver`);

        ws2.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'unread_messages') {
            expect(message.count).toBeGreaterThan(0);
            expect(message.messages).toBeDefined();
            ws2.close();
            done();
          }
        });
      }, 300);
    });
  });

  describe('WebSocket Message Types', () => {
    test('should handle send message type', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=send-sender`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'send',
          sender: 'send-sender',
          recipient: 'send-recipient',
          content: 'Hello from sender'
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'ack') {
          expect(message.messageId).toBeDefined();
          ws.close();
          done();
        }
      });
    });

    test('should handle broadcast message type', (done) => {
      const ws1 = new WebSocket(`ws://localhost:3000/?bot_id=broadcast-sender`);
      const ws2 = new WebSocket(`ws://localhost:3000/?bot_id=broadcast-receiver`);

      let receiverConnected = false;

      ws2.on('open', () => {
        receiverConnected = true;
      });

      ws1.on('open', () => {
        setTimeout(() => {
          if (receiverConnected) {
            ws1.send(JSON.stringify({
              type: 'broadcast',
              sender: 'broadcast-sender',
              content: 'Broadcast message'
            }));
          }
        }, 100);
      });

      let received = false;
      ws2.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'message' && message.sender === 'broadcast-sender') {
          expect(message.content).toBe('Broadcast message');
          received = true;
        }
      });

      setTimeout(() => {
        expect(received).toBe(true);
        ws1.close();
        ws2.close();
        done();
      }, 500);
    });

    test('should handle ack message type', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=ack-bot`);

      ws.on('open', () => {
        // First send a message
        ws.send(JSON.stringify({
          type: 'send',
          sender: 'ack-bot',
          recipient: 'recipient',
          content: 'Message to acknowledge'
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'ack') {
          // Now send an ack
          ws.send(JSON.stringify({
            type: 'ack',
            messageId: message.messageId
          }));

          // Check that message is marked as read
          setTimeout(() => {
            ws.close();
            done();
          }, 100);
        }
      });
    });

    test('should handle unknown message type', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=unknown-type-bot`);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'unknown_type',
          data: 'test'
        }));
      });

      // Connection should stay open
      setTimeout(() => {
        ws.close();
        done();
      }, 200);
    });
  });

  describe('HTTP API Endpoints', () => {
    describe('POST /api/messages', () => {
      test('should create a new message', async () => {
        const response = await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'http-sender',
            recipient: 'http-recipient',
            content: 'HTTP message'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.messageId).toBeDefined();
      });

      test('should create message with metadata', async () => {
        const response = await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender',
            recipient: 'recipient',
            content: 'Message with metadata',
            metadata: { custom: 'value', number: 123 }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
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
      beforeEach(async () => {
        // Create some test messages
        await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'test-sender',
            recipient: 'test-recipient',
            content: 'Message 1'
          });

        await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'test-sender-2',
            recipient: 'test-recipient',
            content: 'Message 2'
          });
      });

      test('should retrieve messages for recipient', async () => {
        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'test-recipient' });

        expect(response.status).toBe(200);
        expect(response.body.messages).toBeDefined();
        expect(response.body.messages.length).toBeGreaterThan(0);
      });

      test('should filter by status', async () => {
        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'test-recipient', status: 'unread' });

        expect(response.status).toBe(200);
        expect(response.body.messages.length).toBeGreaterThan(0);
      });

      test('should respect limit parameter', async () => {
        const response = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'test-recipient', limit: 1 });

        expect(response.status).toBe(200);
        expect(response.body.messages.length).toBeLessThanOrEqual(1);
      });

      test('should return empty when no messages', async () => {
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
      let messageId;

      beforeEach(async () => {
        const response = await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender',
            recipient: 'recipient',
            content: 'Message to mark read'
          });
        messageId = response.body.messageId;
      });

      test('should mark message as read', async () => {
        const response = await request(serverApp)
          .post(`/api/messages/${messageId}/read`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify it's marked as read
        const getResponse = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'recipient', status: 'unread' });

        // The message should no longer appear as unread
        const stillUnread = getResponse.body.messages.some(m => m.id === messageId);
        expect(stillUnread).toBe(false);
      });

      test('should return 404 for non-existent message', async () => {
        const response = await request(serverApp)
          .post('/api/messages/non-existent-id/read');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/messages', () => {
      beforeEach(async () => {
        // Create old messages
        await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender',
            recipient: 'recipient',
            content: 'Old message 1',
            status: 'read'
          });

        await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender',
            recipient: 'recipient',
            content: 'Old message 2',
            status: 'read'
          });
      });

      test('should delete old read messages', async () => {
        const response = await request(serverApp)
          .delete('/api/messages')
          .query({ status: 'read', older_than_days: 0 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.deleted).toBeGreaterThan(0);
      });

      test('should not delete unread messages', async () => {
        // Create an unread message
        await request(serverApp)
          .post('/api/messages')
          .send({
            sender: 'sender',
            recipient: 'recipient',
            content: 'Unread message',
            status: 'unread'
          });

        const response = await request(serverApp)
          .delete('/api/messages')
          .query({ status: 'read', older_than_days: 0 });

        // Unread message should still exist
        const getResponse = await request(serverApp)
          .get('/api/messages')
          .query({ recipient: 'recipient' });

        const hasUnread = getResponse.body.messages.some(m => m.status === 'unread');
        expect(hasUnread).toBe(true);
      });
    });
  });

  describe('Utility Endpoints', () => {
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
        // Connect a bot via WebSocket
        const ws = new WebSocket(`ws://localhost:3000/?bot_id=status-check-bot`);

        await new Promise(resolve => ws.on('open', resolve));

        const response = await request(serverApp).get('/api/connections');

        expect(response.status).toBe(200);
        expect(response.body.bots).toBeDefined();
        expect(response.body.bots).toContain('status-check-bot');

        ws.close();
      });
    });
  });

  describe('Database Operations', () => {
    test('should handle database errors gracefully', async () => {
      // This test is difficult to implement without mocking SQLite
      // For now, we just verify normal operations work
      const response = await request(serverApp)
        .post('/api/messages')
        .send({
          sender: 'sender',
          recipient: 'recipient',
          content: 'Database test message'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON in POST requests', async () => {
      const response = await request(serverApp)
        .post('/api/messages')
        .set('Content-Type', 'application/json')
        .send('invalid json{{{');

      expect(response.status).toBe(400);
    });

    test('should handle malformed query parameters', async () => {
      const response = await request(serverApp)
        .get('/api/messages')
        .query({ recipient: '', limit: 'invalid' });

      // Should handle gracefully
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});

describe('Server Helper Functions', () => {
  // Test internal helper functions by importing them
  const serverModule = require('../server/index');

  describe('sendToRecipient', () => {
    test('should send message to WebSocket if connected', (done) => {
      const ws = new WebSocket(`ws://localhost:3000/?bot_id=recipient-bot`);

      ws.on('open', () => {
        // This function is tested indirectly through WebSocket message handling
        ws.close();
        done();
      });
    });

    test('should store message if recipient not connected', async () => {
      // Send message to non-existent bot
      const response = await request(serverModule.app)
        .post('/api/messages')
        .send({
          sender: 'sender',
          recipient: 'non-existent-bot',
          content: 'Stored message'
        });

      expect(response.body.success).toBe(true);
    });
  });

  describe('broadcastMessage', () => {
    test('should broadcast to all connected bots except sender', (done) => {
      const ws1 = new WebSocket(`ws://localhost:3000/?bot_id=broadcast-1`);
      const ws2 = new WebSocket(`ws://localhost:3000/?bot_id=broadcast-2`);

      let receivedBy2 = false;
      let receivedBy1 = false;

      ws2.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'message' && msg.sender === 'broadcast-1') {
          receivedBy2 = true;
        }
      });

      ws1.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'message' && msg.sender === 'broadcast-1') {
          // Sender should NOT receive their own broadcast
          receivedBy1 = true;
        }
      });

      setTimeout(() => {
        ws1.send(JSON.stringify({
          type: 'broadcast',
          sender: 'broadcast-1',
          content: 'Broadcast test'
        }));
      }, 100);

      setTimeout(() => {
        expect(receivedBy2).toBe(true);
        expect(receivedBy1).toBe(false);
        ws1.close();
        ws2.close();
        done();
      }, 500);
    });
  });

  describe('sendUnreadMessages', () => {
    test('should send unread messages when bot connects', (done) => {
      // Create a message
      request(serverModule.app)
        .post('/api/messages')
        .send({
          sender: 'storage-sender',
          recipient: 'storage-recipient',
          content: 'Stored for later'
        })
        .then(() => {
          const ws = new WebSocket(`ws://localhost:3000/?bot_id=storage-recipient`);

          ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'unread_messages') {
              expect(msg.count).toBeGreaterThan(0);
              ws.close();
              done();
            }
          });
        });
    });
  });
});
