/**
 * Bot Bridge Server (WebSocket 版本)
 *
 * HTTP API + WebSocket 服务，用于 OpenClaw bots 之间实时通信
 */
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const DB_PATH = process.env.TEST_DB_PATH || path.join(__dirname, 'messages.db');

// 创建 HTTP 服务器
const server = http.createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 存储 WebSocket 连接
const connections = new Map(); // botId -> WebSocket

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

// === WebSocket 连接处理 ===

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const botId = url.searchParams.get('bot_id');

  if (!botId) {
    ws.close(1008, 'Missing bot_id parameter');
    return;
  }

  console.log(`[WebSocket] Bot connected: ${botId}`);

  // 存储连接
  connections.set(botId, ws);

  // 发送连接成功消息
  ws.send(JSON.stringify({
    type: 'connected',
    botId,
    timestamp: new Date().toISOString()
  }));

  // 处理消息
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleWebSocketMessage(botId, message, ws);
    } catch (err) {
      console.error(`[WebSocket] Invalid message from ${botId}:`, err);
    }
  });

  // 处理连接关闭
  ws.on('close', () => {
    console.log(`[WebSocket] Bot disconnected: ${botId}`);
    connections.delete(botId);
  });

  // 处理错误
  ws.on('error', (err) => {
    console.error(`[WebSocket] Error for ${botId}:`, err);
  });

  // 发送未读消息
  sendUnreadMessages(botId, ws);
});

/**
 * 处理 WebSocket 消息
 */
function handleWebSocketMessage(sender, message, ws) {
  switch (message.type) {
    case 'send':
      // 发送消息给其他 bot
      sendToRecipient(message);
      // 存储到数据库
      saveMessageToDB(message);
      break;

    case 'broadcast':
      // 广播消息给所有 bot（除了发送者）
      broadcastMessage(sender, message);
      break;

    case 'ack':
      // 消息确认
      markMessageAsRead(message.messageId);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.error(`[WebSocket] Unknown message type: ${message.type}`);
  }
}

/**
 * 发送消息给指定 recipient
 */
function sendToRecipient(message) {
  const { recipient, content, metadata = {} } = message;
  const ws = connections.get(recipient);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'message',
      sender: message.sender,
      content,
      metadata,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * 广播消息给所有 bot（除了发送者）
 */
function broadcastMessage(sender, message) {
  const { content, metadata = {} } = message;

  connections.forEach((ws, botId) => {
    if (botId !== sender && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'message',
        sender,
        content,
        metadata,
        timestamp: new Date().toISOString()
      }));
    }
  });
}

/**
 * 保存消息到数据库
 */
function saveMessageToDB(message) {
  const { sender, recipient, content, metadata = {} } = message;
  const id = `${sender}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.run(
    `INSERT INTO messages (id, sender, recipient, content, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [id, sender, recipient, content, JSON.stringify(metadata)],
    (err) => {
      if (err) console.error('[DB] Insert error:', err);
    }
  );
}

/**
 * 发送未读消息
 */
function sendUnreadMessages(botId, ws) {
  db.all(
    `SELECT * FROM messages WHERE recipient = ? AND status = 'unread' ORDER BY created_at ASC LIMIT 50`,
    [botId],
    (err, rows) => {
      if (err) {
        console.error('[DB] Query error:', err);
        return;
      }

      if (rows.length > 0) {
        const messages = rows.map(row => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        }));

        ws.send(JSON.stringify({
          type: 'unread_messages',
          messages,
          count: messages.length
        }));
      }
    }
  );
}

/**
 * 标记消息为已读
 */
function markMessageAsRead(messageId) {
  db.run(
    `UPDATE messages SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [messageId],
    (err) => {
      if (err) console.error('[DB] Update error:', err);
    }
  );
}

// === HTTP API 端点 ===

/**
 * POST /api/messages
 * 发送消息（HTTP 接口，用于不使用 WebSocket 的情况）
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

      // 如果接收者在线，通过 WebSocket 发送
      const ws = connections.get(recipient);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'message',
          sender,
          content,
          metadata,
          timestamp: new Date().toISOString()
        }));
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
 * 获取消息（HTTP 接口）
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
    `UPDATE messages SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE id = ?`,
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
 * 清理已读消息
 */
app.delete('/api/messages', (req, res) => {
  const { older_than = 7 } = req.query;

  db.run(
    `DELETE FROM messages WHERE status = 'read' AND read_at < datetime('now', '-' || ? || ' days')`,
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
        connected_bots: connections.size,
        timestamp: new Date().toISOString()
      });
    }
  );
});

/**
 * GET /api/connections
 * 获取在线 bot 列表
 */
app.get('/api/connections', (req, res) => {
  const bots = Array.from(connections.keys());
  res.json({
    success: true,
    count: bots.length,
    bots
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 仅在直接运行此模块时启动服务器
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Bot Bridge Server running on http://${HOST}:${PORT}`);
    console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/?bot_id=<your-bot-id>`);
    console.log(`Database: ${DB_PATH}`);
    console.log(`API endpoints:`);
    console.log(`  POST   /api/messages          - 发送消息`);
    console.log(`  GET    /api/messages          - 获取消息`);
    console.log(`  POST   /api/messages/:id/read - 标记已读`);
    console.log(`  DELETE /api/messages          - 清理消息`);
    console.log(`  GET    /api/status            - 服务状态`);
    console.log(`  GET    /api/connections       - 在线 bot 列表`);
  });
}

module.exports = { app, server, wss, connections };
