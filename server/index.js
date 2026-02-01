/**
 * Bot Bridge Server
 *
 * HTTP API 服务，用于 OpenClaw bots 之间传递消息
 */
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const DB_PATH = process.env.TEST_DB_PATH || path.join(__dirname, 'messages.db');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 初始化数据库
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    metadata TEXT
  )`);

  // 创建索引加速查询
  db.run(`CREATE INDEX IF NOT EXISTS idx_recipient_status 
          ON messages(recipient, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sender 
          ON messages(sender)`);
});

// API 端点

/**
 * POST /api/messages
 * 发送消息
 *
 * Request Body:
 * {
 *   "sender": "xiaoc",
 *   "recipient": "xiaod",
 *   "content": "消息内容",
 *   "metadata": {...}
 * }
 */
app.post('/api/messages', (req, res) => {
  const { sender, recipient, content, metadata = {} } = req.body;

  if (!sender || !recipient || !content) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: sender, recipient, content'
    });
  }

  const id = `${sender}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.run(
    `INSERT INTO messages (id, sender, recipient, content, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [id, sender, recipient, content, JSON.stringify(metadata)],
    function(err) {
      if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }
      res.json({
        success: true,
        id,
        timestamp: new Date().toISOString()
      });
    }
  );
});

/**
 * GET /api/messages
 * 获取消息
 *
 * Query Parameters:
 * - recipient: 目标bot ID
 * - status: unread | read | all (default: unread)
 * - limit: 最多返回数量 (default: 50)
 */
app.get('/api/messages', (req, res) => {
  const { recipient, status = 'unread', limit = 50 } = req.query;

  if (!recipient) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: recipient'
    });
  }

  let query = 'SELECT * FROM messages WHERE recipient = ?';
  const params = [recipient];

  if (status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }

    // 解析 metadata
    const messages = rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));

    res.json({
      success: true,
      count: messages.length,
      messages
    });
  });
});

/**
 * POST /api/messages/:id/read
 * 标记消息为已读
 */
app.post('/api/messages/:id/read', (req, res) => {
  const { id } = req.params;

  db.run(
    `UPDATE messages 
     SET status = 'read', read_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }

      res.json({ success: true });
    }
  );
});

/**
 * DELETE /api/messages
 * 清理已读消息（可选）
 *
 * Query Parameters:
 * - older_than: 清理多少天前的消息 (default: 7)
 */
app.delete('/api/messages', (req, res) => {
  const { older_than = 7 } = req.query;

  db.run(
    `DELETE FROM messages 
     WHERE status = 'read' 
     AND read_at < datetime('now', '-' || ? || ' days')`,
    [older_than],
    function(err) {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }

      res.json({
        success: true,
        deleted_count: this.changes
      });
    }
  );
});

/**
 * GET /api/status
 * 服务状态
 */
app.get('/api/status', (req, res) => {
  db.get(
    'SELECT COUNT(*) as total FROM messages WHERE status = "unread"',
    (err, row) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }

      res.json({
        success: true,
        status: 'running',
        unread_count: row.total,
        timestamp: new Date().toISOString()
      });
    }
  );
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 仅在直接运行此模块时启动服务器
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Bot Bridge Server running on http://${HOST}:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
    console.log(`API endpoints:`);
    console.log(`  POST   /api/messages          - 发送消息`);
    console.log(`  GET    /api/messages          - 获取消息`);
    console.log(`  POST   /api/messages/:id/read - 标记已读`);
    console.log(`  DELETE /api/messages          - 清理消息`);
    console.log(`  GET    /api/status            - 服务状态`);
  });
}

module.exports = app;
