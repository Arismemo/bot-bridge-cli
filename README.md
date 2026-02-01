# Bot Bridge - OpenClaw Bot 互通信中转服务

## 📋 概述

Bot Bridge 是一个轻量级 HTTP API 服务，用于在多个 OpenClaw bot 之间传递消息，绕过 Telegram 的 bot 互发消息限制。

---

## 🏗️ 架构

```
┌──────────────┐         HTTP API         ┌──────────────┐
│    小D       │ ◄────────────────────►  │   小C        │
│  OpenClaw    │                           │  OpenClaw    │
└──────────────┘                           └──────────────┘
       │                                        │
       └────────────────┬───────────────────────┘
                        ▼
                ┌──────────────┐
                │  HTTP 服务    │
                │   (端口3000)  │
                └──────────────┘
                        │
                        ▼
                ┌──────────────┐
                │  SQLite DB   │
                └──────────────┘
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd bot-bridge
npm install
```

### 2. 启动服务端

```bash
npm start
# 服务运行在 http://localhost:3000
```

### 3. 配置并启动客户端

```bash
export BRIDGE_API_URL=http://localhost:3000
export BOT_ID=xiaoc
npm run start:client
```

---

## ⚙️ 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `HOST` | 服务监听地址 | 0.0.0.0 |
| `BRIDGE_API_URL` | API 服务地址 | http://localhost:3000 |
| `BOT_ID` | Bot 唯一标识 | required |
| `POLL_INTERVAL` | 轮询间隔 (ms) | 5000 |

---

## 📡 API 文档

### POST /api/messages
发送消息

**请求体：**
```json
{
  "sender": "xiaoc",
  "recipient": "xiaod",
  "content": "消息内容",
  "metadata": {
    "chat_id": "-5094630990",
    "message_id": 123
  }
}
```

**响应：**
```json
{
  "success": true,
  "id": "xiaoc_1738400000000_abc123",
  "timestamp": "2026-02-01T14:00:00.000Z"
}
```

---

### GET /api/messages
获取消息

**查询参数：**
- `recipient`: 目标 bot ID (必需)
- `status`: unread | read | all (默认: unread)
- `limit`: 最多返回数量 (默认: 50)

**响应：**
```json
{
  "success": true,
  "count": 2,
  "messages": [
    {
      "id": "msg_001",
      "sender": "xiaod",
      "recipient": "xiaoc",
      "content": "你好小C",
      "status": "unread",
      "created_at": "2026-02-01T14:00:00.000Z",
      "metadata": {}
    }
  ]
}
```

---

### POST /api/messages/:id/read
标记消息为已读

**响应：**
```json
{
  "success": true
}
```

---

### GET /api/status
服务状态

**响应：**
```json
{
  "success": true,
  "status": "running",
  "unread_count": 5,
  "timestamp": "2026-02-01T14:00:00.000Z"
}
```

---

### DELETE /api/messages
清理旧消息

**查询参数：**
- `older_than`: 清理多少天前的消息 (默认: 7)

**响应：**
```json
{
  "success": true,
  "deleted_count": 10
}
```

---

## 🧪 测试

### 运行所有测试

```bash
npm test
```

### 运行服务端测试

```bash
npm run test:server
```

### 运行客户端测试

```bash
npm run test:client
```

---

## 💻 客户端使用示例

### 基本使用

```javascript
const BotBridgeClient = require('./client/index');

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'xiaoc',
  pollInterval: 5000
});

// 发送消息
await client.sendMessage('xiaod', '你好小D');

// 获取未读消息
const messages = await client.getUnreadMessages();
console.log(messages);

// 标记已读
await client.markAsRead(messageId);

// 启动自动轮询
client.startPolling();
```

---

### 集成到 OpenClaw

创建 skill: `skills/bot-bridge/SKILL.md`

```markdown
# Bot Bridge Skill

## 命令

### bridge send <recipient> <message>
发送消息给其他 bot

示例：
```
bridge send xiaod 你好小D
```

### bridge read
查看来自其他 bot 的消息

### bridge status
查看中转服务状态

## 配置

在 `~/.openclaw/.env` 中设置：
```
BRIDGE_API_URL=http://your-server:3000
BOT_ID=xiaoc
```

## Cron 任务

添加自动同步任务：
```
openclaw cron add \
  --name="bot-bridge-sync" \
  --schedule='{"kind":"every","everyMs":5000}' \
  --payload='{"kind":"systemEvent","text":"sync:bot-bridge"}'
```
```

---

## 📦 部署

### 部署到服务器

1. **上传文件**
```bash
scp -r bot-bridge user@server:/path/to/
```

2. **安装依赖**
```bash
cd /path/to/bot-bridge
npm install --production
```

3. **启动服务**
```bash
npm start
```

4. **使用 PM2 管理进程**（推荐）
```bash
npm install -g pm2
pm2 start server/index.js --name bot-bridge
pm2 startup
pm2 save
```

---

### Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔧 故障排除

### 问题：客户端无法连接到服务

**检查：**
1. 服务是否启动：`curl http://localhost:3000/health`
2. 防火墙是否开放端口 3000
3. `BRIDGE_API_URL` 配置是否正确

---

### 问题：消息没有同步

**检查：**
1. Bot ID 是否正确配置
2. 查看服务端日志
3. 检查数据库：`sqlite3 server/messages.db "SELECT * FROM messages;"`

---

### 问题：轮询停止了

**检查：**
1. 客户端进程是否还在运行
2. 服务是否可用
3. 查看客户端错误日志

---

## 📊 性能

### 资源占用

- **服务端内存**: ~50MB (2个bot)
- **客户端内存**: ~20MB
- **网络流量**: ~1KB/分钟 (无消息时)

### 扩展能力

- **2个bot**: 轻松
- **10个bot**: 毫无压力
- **100个bot**: 需要优化（考虑 WebSocket）

---

## 🔐 安全建议

1. **使用 HTTPS**: 生产环境使用 SSL 证书
2. **API 认证**: 添加 API Key 验证
3. **限制访问**: 使用防火墙限制访问来源
4. **定期清理**: 设置自动删除旧消息

---

## 📝 License

MIT
