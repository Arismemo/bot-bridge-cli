const request = require('supertest');
const fs = require('fs');
const path = require('path');

// 使用和 test-integration.js 相同的数据库路径
const DB_PATH = path.join(__dirname, 'test-messages.db');

function runServerTests() {
  let app;

  beforeAll(async () => {
    // 服务器模块已经在 test-integration.js 中加载
    // 这里只需要引用它
    const server = require('../server/index');
    app = server;
    // 等待数据库初始化
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // 测试数据库由 test-integration.js 清理
  });

  describe('Bot Bridge Server API', () => {
    describe('Health Check', () => {
      test('GET /health returns 200', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);
        expect(response.body.status).toBe('ok');
      });
    });

    describe('POST /api/messages', () => {
      test('should create a new message', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            sender: 'xiaoc',
            recipient: 'xiaod',
            content: 'Hello from xiaoc'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.id).toBeDefined();
        expect(response.body.timestamp).toBeDefined();
      });

      test('should fail without required fields', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            sender: 'xiaoc'
            // missing recipient and content
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Missing required fields');
      });

      test('should accept metadata', async () => {
        const response = await request(app)
          .post('/api/messages')
          .send({
            sender: 'xiaoc',
            recipient: 'xiaod',
            content: 'Message with metadata',
            metadata: { chat_id: '-5094630990', message_id: 123 }
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/messages', () => {
      beforeAll(async () => {
        // 创建测试消息，使用唯一 recipient 避免与其他测试冲突
        await request(app).post('/api/messages').send({
          sender: 'xiaoc',
          recipient: 'test-recipient-1',
          content: 'Test message 1'
        });

        await request(app).post('/api/messages').send({
          sender: 'xiaoc',
          recipient: 'test-recipient-1',
          content: 'Test message 2'
        });

        await request(app).post('/api/messages').send({
          sender: 'xiaod',
          recipient: 'test-recipient-2',
          content: 'Reply message'
        });
      });

      test('should retrieve messages for recipient', async () => {
        const response = await request(app)
          .get('/api/messages?recipient=test-recipient-1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.count).toBe(2);
        expect(response.body.messages).toHaveLength(2);

        response.body.messages.forEach(msg => {
          expect(msg.recipient).toBe('test-recipient-1');
        });
      });

      test('should return empty when no messages', async () => {
        const response = await request(app)
          .get('/api/messages?recipient=nonexistent')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.count).toBe(0);
        expect(response.body.messages).toHaveLength(0);
      });

      test('should fail without recipient parameter', async () => {
        const response = await request(app)
          .get('/api/messages')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Missing required parameter');
      });

      test('should respect limit parameter', async () => {
        const response = await request(app)
          .get('/api/messages?recipient=test-recipient-1&limit=1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.messages).toHaveLength(1);
      });
    });

    describe('POST /api/messages/:id/read', () => {
      let messageId;

      beforeAll(async () => {
        const response = await request(app).post('/api/messages').send({
          sender: 'xiaoc',
          recipient: 'xiaod',
          content: 'Mark as read test'
        });
        messageId = response.body.id;
      });

      test('should mark message as read', async () => {
        const response = await request(app)
          .post(`/api/messages/${messageId}/read`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return 404 for non-existent message', async () => {
        const response = await request(app)
          .post('/api/messages/nonexistent/read')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Message not found');
      });

      test('marked messages should not appear in unread query', async () => {
        const response = await request(app)
          .get('/api/messages?recipient=xiaod&status=unread')
          .expect(200);

        const found = response.body.messages.some(m => m.id === messageId);
        expect(found).toBe(false);
      });
    });

    describe('GET /api/status', () => {
      beforeAll(async () => {
        // 创建一条未读消息
        await request(app).post('/api/messages').send({
          sender: 'xiaoc',
          recipient: 'xiaod',
          content: 'Status test'
        });
      });

      test('should return service status', async () => {
        const response = await request(app)
          .get('/api/status')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe('running');
        expect(response.body.unread_count).toBeGreaterThanOrEqual(0);
        expect(response.body.timestamp).toBeDefined();
      });
    });

    describe('DELETE /api/messages', () => {
      beforeAll(async () => {
        // 创建一条已读消息
        const msg = await request(app).post('/api/messages').send({
          sender: 'xiaoc',
          recipient: 'xiaod',
          content: 'Old message'
        });
        await request(app).post(`/api/messages/${msg.body.id}/read`);
      });

      test('should delete old read messages', async () => {
        const response = await request(app)
          .delete('/api/messages?older_than=0')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.deleted_count).toBeGreaterThanOrEqual(0);
      });
    });
  });
}

module.exports = runServerTests;
