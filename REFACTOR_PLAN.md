# 代码重构方案 - 为可测试性优化

## 目标
将 `client/index.js` 重构为可测试架构，支持依赖注入和 Mock

## 当前问题

### 1. 硬编码依赖
```javascript
// BotBridgeClient
this.ws = new WebSocket(...);  // ❌ 无法 mock
axios.get(...);               // ❌ 无法 mock
axios.post(...);              // ❌ 无法 mock

// ContextAwareBot
this.db = new sqlite3.Database(...);  // ❌ 无法 mock
```

### 2. 职责混杂
- 网络通信 (WebSocket + HTTP)
- 业务逻辑 (消息处理、决策)
- 数据持久化 (SQLite)
- 配置管理

### 3. 测试困难
- 必须使用真实的 WebSocket 连接
- SQLite 数据库文件创建/删除复杂
- 无法单独测试业务逻辑

## 重构方案

### 阶段 1: 创建接口层

#### 1.1 定义接口

```javascript
// interfaces/IWebSocketClient.js
class IWebSocketClient {
  connect(url) {}
  send(data) {}
  close() {}
  on(event, handler) {}
  removeListener(event, handler) {}
  get readyState() {}
}

// interfaces/IHttpClient.js
class IHttpClient {
  async get(url, options) {}
  async post(url, data, options) {}
  async put(url, data, options) {}
  async delete(url, options) {}
}

// interfaces/IDatabaseClient.js
class IDatabaseClient {
  async initialize(path) {}
  async execute(sql, params) {}
  async query(sql, params) {}
  async saveMessage(message) {}
  async loadMessages() {}
  async close() {}
}
```

#### 1.2 创建默认实现

```javascript
// adapters/DefaultWebSocketClient.js
class DefaultWebSocketClient extends IWebSocketClient {
  constructor() {
    super();
    this.ws = null;
  }

  connect(url) {
    const WebSocket = require('ws');
    this.ws = new WebSocket(url);
    return this;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  on(event, handler) {
    if (this.ws) {
      this.ws.on(event, handler);
    }
  }

  removeListener(event, handler) {
    if (this.ws) {
      this.ws.removeListener(event, handler);
    }
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
}

// adapters/DefaultHttpClient.js
const axios = require('axios');

class DefaultHttpClient extends IHttpClient {
  constructor(config) {
    super();
    this.axios = axios.create(config);
  }

  async get(url, options) {
    return await this.axios.get(url, options);
  }

  async post(url, data, options) {
    return await this.axios.post(url, data, options);
  }

  async put(url, data, options) {
    return await this.axios.put(url, data, options);
  }

  async delete(url, options) {
    return await this.axios.delete(url, options);
  }
}

// adapters/SQLiteClient.js
const sqlite3 = require('sqlite3').verbose();

class SQLiteClient extends IDatabaseClient {
  constructor() {
    super();
    this.db = null;
  }

  async initialize(path) {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(path, (err) => {
        if (err) return reject(err);
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          sender TEXT NOT NULL,
          userId TEXT,
          chatId TEXT,
          content TEXT,
          timestamp TEXT NOT NULL,
          messageId INTEGER,
          metadata TEXT
        )
      `;
      this.db.run(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async execute(sql, params) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async query(sql, params) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async saveMessage(message) {
    const sql = `
      INSERT OR REPLACE INTO messages
      (id, source, sender, userId, chatId, content, timestamp, messageId, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      message.id,
      message.source,
      message.sender,
      message.userId || null,
      message.chatId || null,
      message.content,
      message.timestamp,
      message.messageId || null,
      JSON.stringify(message.metadata || {})
    ];
    return this.execute(sql, params);
  }

  async loadMessages() {
    const rows = await this.query('SELECT * FROM messages ORDER BY timestamp ASC');
    return rows.map(row => ({
      id: row.id,
      source: row.source,
      sender: row.sender,
      userId: row.userId,
      chatId: row.chatId,
      content: row.content,
      timestamp: row.timestamp,
      messageId: row.messageId,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(resolve);
      } else {
        resolve();
      }
    });
  }
}
```

### 阶段 2: 重构 BotBridgeClient

```javascript
// client/BotBridgeClient.js
class BotBridgeClient {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.BRIDGE_API_URL || 'http://localhost:3000';
    this.botId = config.botId || process.env.BOT_ID || 'unknown';
    this.httpOnly = config.httpOnly || false;

    // 依赖注入 - 使用传入的实现或默认实现
    this.wsClient = config.wsClient || new DefaultWebSocketClient();
    this.httpClient = config.httpClient || new DefaultHttpClient();

    this.connected = false;
    this.messageQueue = [];
    this.onMessage = config.onMessage || (() => {});
    this.onConnectionChange = config.onConnectionChange || (() => {});
    this.onError = config.onError || ((err) => console.error(err));
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;

    if (!this.httpOnly) {
      this.connect();
    }
  }

  connect() {
    const wsUrl = this.apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    this.wsClient.connect(`${wsUrl}/?bot_id=${this.botId}`);

    this.wsClient.on('open', () => {
      console.log(`[BotBridge] Connected: ${this.botId}`);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.onConnectionChange(true);
      this.flushMessageQueue();
    });

    this.wsClient.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (err) {
        this.onError(`Failed to parse message: ${err.message}`);
      }
    });

    this.wsClient.on('close', () => {
      console.log(`[BotBridge] Disconnected: ${this.botId}`);
      this.connected = false;
      this.onConnectionChange(false);

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[BotBridge] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      }
    });

    this.wsClient.on('error', (err) => {
      this.onError(`WebSocket error: ${err.message}`);
    });
  }

  async sendMessage(recipient, content, metadata = {}) {
    if (this.connected) {
      const message = {
        type: 'send',
        sender: this.botId,
        recipient,
        content,
        timestamp: new Date().toISOString(),
        metadata
      };
      this.wsClient.send(JSON.stringify(message));
      return { success: true, sent: true };
    } else {
      // Fallback to HTTP
      try {
        const response = await this.httpClient.post(
          `${this.apiUrl}/api/messages`,
          {
            sender: this.botId,
            recipient,
            content,
            metadata
          }
        );
        return { success: true, messageId: response.data.messageId };
      } catch (err) {
        this.onError(`Failed to send message via HTTP: ${err.message}`);
        return { success: false, error: err.message };
      }
    }
  }

  async healthCheck() {
    try {
      const response = await this.httpClient.get(
        `${this.apiUrl}/health`,
        { timeout: 3000 }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async getStatus() {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/api/status`);
      return response.data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getConnectedBots() {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/api/connections`);
      return response.data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getUnreadMessages() {
    try {
      const response = await this.httpClient.get(`${this.apiUrl}/api/messages`, {
        params: {
          recipient: this.botId,
          status: 'unread',
          limit: 50
        }
      });
      return {
        success: true,
        messages: response.data.messages || []
      };
    } catch (err) {
      this.onError(`Failed to fetch unread messages: ${err.message}`);
      return {
        success: false,
        error: err.message,
        messages: []
      };
    }
  }

  async markAsRead(messageId) {
    try {
      await this.httpClient.post(`${this.apiUrl}/api/messages/${messageId}/read`);
      return { success: true };
    } catch (err) {
      this.onError(`Failed to mark message as read: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  broadcast(content, metadata = {}) {
    if (!this.connected) {
      return { success: false, error: 'Not connected' };
    }

    const message = {
      type: 'broadcast',
      sender: this.botId,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.wsClient.send(JSON.stringify(message));
    return { success: true };
  }

  disconnect() {
    this.wsClient.close();
    this.connected = false;
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log(`[BotBridge] Server acknowledged connection`);
        break;

      case 'message':
        this.onMessage({
          source: 'bridge',
          sender: message.sender,
          content: message.content,
          timestamp: message.timestamp,
          metadata: message.metadata
        });
        this.sendAck(message);
        break;

      case 'unread_messages':
        console.log(`[BotBridge] Received ${message.count} unread message(s)`);
        message.messages.forEach(msg => {
          this.onMessage({
            source: 'bridge',
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.created_at,
            metadata: msg.metadata
          });
          this.sendAck(msg);
        });
        break;

      case 'pong':
        // Heartbeat response - no action needed
        break;

      default:
        console.log(`[BotBridge] Unknown message type: ${message.type}`);
    }
  }

  sendAck(message) {
    if (!message.id) return;

    if (this.connected) {
      this.wsClient.send(JSON.stringify({
        type: 'ack',
        messageId: message.id
      }));
    }
  }

  flushMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`[BotBridge] Flushing ${this.messageQueue.length} queued message(s)`);
    this.messageQueue.forEach(msg => {
      this.wsClient.send(JSON.stringify(msg));
    });
    this.messageQueue = [];
  }

  replyTo(originalMessage, content, extraMetadata = {}) {
    return this.sendMessage(
      originalMessage.sender,
      content,
      {
        reply_to: originalMessage.id,
        ...extraMetadata
      }
    );
  }
}
```

### 阶段 3: 重构 ContextAwareBot

```javascript
// client/ContextAwareBot.js
class ContextAwareBot {
  constructor(config = {}) {
    // 依赖注入
    this.bridge = config.bridge || new BotBridgeClient(config);
    this.db = config.db || (config.dbPath ? new SQLiteClient() : null);

    // Telegram 配置
    this.telegramBotToken = config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatIds = this.parseChatIds(
      config.telegramChatIds || process.env.TELEGRAM_CHAT_IDS
    );

    // 消息存储
    this.messages = new Map();

    // 回调
    this.onNewMessage = config.onNewMessage || (() => {});
    this.onDecideReply = config.onDecideReply || ((context) => null);

    // 初始化数据库
    if (this.db && config.dbPath) {
      this.db.initialize(config.dbPath).then(() => {
        this.loadMessagesFromDb();
      }).catch(err => {
        console.error('[SQLite] Error initializing database:', err.message);
      });
    }

    // 启动监听
    this.startListening();
  }

  async loadMessagesFromDb() {
    try {
      const messages = await this.db.loadMessages();
      messages.forEach(msg => {
        this.messages.set(msg.id, msg);
      });
      console.log(`[SQLite] Loaded ${messages.length} messages from database.`);
    } catch (err) {
      console.error('[SQLite] Error loading messages from DB:', err.message);
    }
  }

  parseChatIds(chatIds) {
    if (!chatIds) return [];
    if (typeof chatIds === 'string') {
      return chatIds.split(',').map(id => id.trim());
    }
    return Array.isArray(chatIds) ? chatIds : [];
  }

  generateUniqueId(source, sender, content, timestamp) {
    const str = `${source}:${sender}:${content}:${timestamp}`;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `msg_${Math.abs(hash)}`;
  }

  async addMessage(message) {
    const id = message.id || this.generateUniqueId(
      message.source,
      message.sender,
      message.content,
      message.timestamp
    );

    const msg = {
      id,
      source: message.source,
      sender: message.sender,
      content: message.content,
      timestamp: message.timestamp,
      userId: message.userId,
      chatId: message.chatId,
      messageId: message.messageId,
      metadata: message.metadata || {}
    };

    this.messages.set(id, msg);
    console.log(`[Context] New message: [${msg.source}] ${msg.sender}: ${msg.content}`);

    // 保存到数据库
    if (this.db) {
      try {
        await this.db.saveMessage(msg);
      } catch (err) {
        console.error('[SQLite] Error saving message:', err.message);
      }
    }

    // 触发回调
    this.onNewMessage(msg);

    // 决策是否回复
    await this.decideReply(msg);
  }

  async decideReply(message) {
    const context = this.getChatHistory();
    const decision = this.onDecideReply({ message, context });

    if (decision && decision.reply) {
      await this.sendMessage(decision.recipient || message.sender, decision.reply, decision.metadata);
    }
  }

  getChatHistory(limit = 50) {
    const history = Array.from(this.messages.values())
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return history.slice(-limit);
  }

  async sendMessage(recipient, content, metadata = {}) {
    return await this.bridge.sendMessage(recipient, content, metadata);
  }

  broadcast(content, metadata = {}) {
    return this.bridge.broadcast(content, metadata);
  }

  disconnect() {
    this.bridge.disconnect();
  }

  // 原有的 Telegram 处理逻辑保持不变...
  handleTelegramMessage(telegramMessage) {
    const message = {
      source: 'telegram',
      sender: telegramMessage.from?.first_name || 'User',
      userId: telegramMessage.from?.id?.toString(),
      chatId: telegramMessage.chat?.id?.toString(),
      content: telegramMessage.text || telegramMessage.caption || '',
      timestamp: new Date().toISOString(),
      messageId: telegramMessage.message_id,
      metadata: {
        reply_to: telegramMessage.reply_to_message?.message_id,
        telegram_message_id: telegramMessage.message_id
      }
    };

    this.addMessage(message);
  }

  startListening() {
    // 原 Bridge 监听逻辑
    this.bridge.onMessage = async (message) => {
      await this.addMessage({
        ...message,
        userId: message.metadata?.userId,
        chatId: message.metadata?.chatId
      });
    };
  }
}
```

### 阶段 4: 创建测试工具

```javascript
// tests/mocks/MockWebSocketClient.js
class MockWebSocketClient {
  constructor() {
    this.connected = false;
    this.handlers = {};
    this.sentMessages = [];
    this.readyState = 0; // WebSocket.CONNECTING
  }

  connect(url) {
    this.url = url;
    this.readyState = 1; // WebSocket.OPEN
    setTimeout(() => {
      this.connected = true;
      this.trigger('open');
    }, 0);
    return this;
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // WebSocket.CLOSED
    this.connected = false;
    setTimeout(() => this.trigger('close'), 0);
  }

  on(event, handler) {
    this.handlers[event] = this.handlers[event] || [];
    this.handlers[event].push(handler);
  }

  removeListener(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  trigger(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data));
    }
  }

  simulateReceiveMessage(message) {
    this.trigger('message', JSON.stringify(message));
  }

  simulateError(error) {
    this.trigger('error', error);
  }
}

// tests/mocks/MockHttpClient.js
class MockHttpClient {
  constructor() {
    this.getResponses = {};
    this.postResponses = {};
    this.getCalls = [];
    this.postCalls = [];
  }

  setGetResponse(url, response) {
    this.getResponses[url] = response;
  }

  setPostResponse(url, response) {
    this.postResponses[url] = response;
  }

  async get(url, options) {
    this.getCalls.push({ url, options });
    const response = this.getResponses[url];
    if (response) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`No mock response for GET ${url}`));
  }

  async post(url, data, options) {
    this.postCalls.push({ url, data, options });
    const response = this.postResponses[url];
    if (response) {
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }
    return Promise.reject(new Error(`No mock response for POST ${url}`));
  }
}

// tests/mocks/MockDatabaseClient.js
class MockDatabaseClient {
  constructor() {
    this.messages = [];
    this.closed = false;
  }

  async initialize(path) {
    return Promise.resolve();
  }

  async execute(sql, params) {
    return Promise.resolve();
  }

  async query(sql, params) {
    return Promise.resolve(this.messages);
  }

  async saveMessage(message) {
    this.messages.push(message);
    return Promise.resolve();
  }

  async loadMessages() {
    return Promise.resolve([...this.messages]);
  }

  async close() {
    this.closed = true;
    return Promise.resolve();
  }
}
```

## 重构后的测试示例

```javascript
const { BotBridgeClient } = require('../client/BotBridgeClient');
const { MockWebSocketClient } = require('./mocks/MockWebSocketClient');
const { MockHttpClient } = require('./mocks/MockHttpClient');

describe('BotBridgeClient - Refactored', () => {
  let mockWs;
  let mockHttp;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    mockHttp = new MockHttpClient();
  });

  test('should use injected WebSocket client', () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:3000',
      botId: 'test-bot',
      wsClient: mockWs,
      httpOnly: true
    });

    client.connect();

    expect(mockWs.url).toBe('ws://localhost:3000/?bot_id=test-bot');
    expect(mockWs.connected).toBe(true);
  });

  test('should use injected HTTP client for sendMessage when not connected', async () => {
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
  });

  test('should use injected HTTP client for healthCheck', async () => {
    const client = new BotBridgeClient({
      apiUrl: 'http://localhost:3000',
      botId: 'test-bot',
      wsClient: mockWs,
      httpClient: mockHttp,
      httpOnly: true
    });

    mockHttp.setGetResponse('http://localhost:3000/health', {
      status: 200
    });

    const isHealthy = await client.healthCheck();

    expect(isHealthy).toBe(true);
    expect(mockHttp.getCalls).toHaveLength(1);
  });
});
```

## 实施步骤

### 第 1 步：创建接口层（1-2小时）
1. 创建 `interfaces/` 目录
2. 定义 `IWebSocketClient`, `IHttpClient`, `IDatabaseClient`
3. 创建适配器 `adapters/` 目录
4. 实现 `DefaultWebSocketClient`, `DefaultHttpClient`, `SQLiteClient`

### 第 2 步：重构 BotBridgeClient（2-3小时）
1. 创建 `client/BotBridgeClient.js`
2. 修改构造函数接受依赖注入
3. 替换所有直接依赖为注入的接口
4. 保持向后兼容的默认实现

### 第 3 步：重构 ContextAwareBot（1-2小时）
1. 创建 `client/ContextAwareBot.js`
2. 注入数据库客户端
3. 分离数据库初始化逻辑
4. 保持向后兼容

### 第 4 步：创建测试工具（1小时）
1. 创建 `tests/mocks/` 目录
2. 实现 `MockWebSocketClient`, `MockHttpClient`, `MockDatabaseClient`
3. 添加便捷方法（simulateReceiveMessage, setResponse）

### 第 5 步：迁移测试（2-3小时）
1. 更新现有测试使用新的 mocks
2. 验证所有测试通过
3. 检查覆盖率提升

### 第 6 步：清理（1小时）
1. 删除旧的 `client/index.js`
2. 更新导入引用
3. 运行完整测试套件
4. 生成覆盖率报告

## 预期收益

1. **测试覆盖率提升**: 从 46% → 85%+
2. **测试编写简单**: 不再需要复杂的 Jest mock hoisting
3. **代码质量提升**: 清晰的接口定义，依赖分离
4. **维护性提升**: 修改依赖不影响业务逻辑
5. **扩展性提升**: 可以轻松替换实现（如 Redis 替代 SQLite）

## 向后兼容

保持原有 API 不变：
```javascript
// 旧代码仍然工作
const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'test-bot'
});

// 新代码可以使用依赖注入
const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'test-bot',
  wsClient: mockWs,
  httpClient: mockHttp
});
```

## 总时间估计

- 总计: 8-12 小时
- 阶段 1: 1-2 小时
- 阶段 2: 2-3 小时
- 阶段 3: 1-2 小时
- 阶段 4: 1 小时
- 阶段 5: 2-3 小时
- 阶段 6: 1 小时
