# Bot Bridge - OpenClaw Bot 互通信中转服务 (WebSocket 版本)

## 📋 概述

Bot Bridge 是一个支持 WebSocket 的 HTTP API 服务，用于在多个 OpenClaw bot 之间**实时**传递消息，同时支持 Telegram Bot API 集成，实现机器人在 Telegram 群聊里的对话。

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram 群聊                            │
└─────────────────────────────────────────────────────────────┘
       │                                    │
       │ Bot API                           │ Bot API
       ▼                                    ▼
┌──────────────┐                      ┌──────────────┐
│    小C       │                      │   小D        │
│  OpenClaw    │                      │  OpenClaw    │
└──────┬───────┘                      └──────┬───────┘
       │                                     │
       │ 发送到群聊 + 同时发送到 Bridge Server │
       ▼                                     ▼
       └──────────────┬──────────────────────┘
                      │
        ┌─────────────▼─────────────┐
        │   Bridge Server (WebSocket)│
        │      HTTP + WS 端点        │
        └─────────────┬─────────────┘
                      │
                      ▼
              ┌──────────────┐
              │  SQLite DB   │
              └──────────────┘
```

### 工作流程

1. **小C 在群聊发送消息**
   - 通过 Telegram Bot API 发送到群聊
   - 同时通过 WebSocket 发送到 Bridge Server

2. **小D 接收消息**
   - 通过 WebSocket 实时收到 Bridge Server 的通知
   - 通过 Telegram Bot API 在群聊回复

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
# WebSocket: ws://localhost:3000/?bot_id=<your-bot-id>
```

### 3. 配置并启动客户端

```bash
export BRIDGE_API_URL=http://localhost:3000
export BOT_ID=xiaoc
export TELEGRAM_BOT_TOKEN=your_bot_token
export TELEGRAM_CHAT_ID=-5094630990

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
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | optional |
| `TELEGRAM_CHAT_ID` | Telegram 群聊 ID | optional |

---

## 📡 WebSocket 协议

### 连接

```
ws://localhost:3000/?bot_id=xiaoc
```

### 消息类型

#### 客户端发送

**发送消息给指定 bot：**
```json
{
  "type": "send",
  "sender": "xiaoc",
  "recipient": "xiaod",
  "content": "你好小D",
  "metadata": {
    "telegram_message_id": 123
  }
}
```

**广播消息给所有 bot：**
```json
{
  "type": "broadcast",
  "sender": "xiaoc",
  "content": "大家好",
  "metadata": {}
}
```

**消息确认：**
```json
{
  "type": "ack",
  "messageId": "xiaoc_1234567890_abc123"
}
```

**心跳：**
```json
{
  "type": "ping"
}
```

#### 服务器发送

**连接确认：**
```json
{
  "type": "connected",
  "botId": "xiaoc",
  "timestamp": "2026-02-01T15:00:00.000Z"
}
```

**新消息：**
```json
{
  "type": "message",
  "sender": "xiaod",
  "content": "你好小C",
  "metadata": {},
  "timestamp": "2026-02-01T15:00:00.000Z"
}
```

**离线未读消息：**
```json
{
  "type": "unread_messages",
  "count": 3,
  "messages": [...]
}
```

**心跳响应：**
```json
{
  "type": "pong"
}
```

---

## 🌐 HTTP API 文档

### POST /api/messages
发送消息（HTTP 备用接口）

**请求体：**
```json
{
  "sender": "xiaoc",
  "recipient": "xiaod",
  "content": "消息内容",
  "metadata": {
    "telegram_message_id": 123
  }
}
```

### GET /api/messages
获取消息

### POST /api/messages/:id/read
标记消息为已读

### GET /api/status
服务状态

**响应：**
```json
{
  "success": true,
  "status": "running",
  "unread_count": 5,
  "connected_bots": 2,
  "timestamp": "2026-02-01T15:00:00.000Z"
}
```

### GET /api/connections
获取在线 bot 列表

---

## 💻 客户端使用示例

### 基本使用（WebSocket）

```javascript
const { BotBridgeClient } = require('./client/index');

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'xiaoc'
});

// 发送消息给小D
await client.sendMessage('xiaod', '你好小D');

// 广播给所有 bot
await client.broadcast('大家好');

// 处理收到的消息
client.onMessage = (message) => {
  console.log(`收到来自 ${message.sender} 的消息: ${message.content}`);
};
```

### Telegram 集成

```javascript
const { BotBridgeTelegram } = require('./client/index');

const bridge = new BotBridgeTelegram({
  apiUrl: 'http://localhost:3000',
  botId: 'xiaoc',
  telegramBotToken: 'your_bot_token',
  telegramChatId: '-5094630990'
});

// 发送消息给小D，同时发送到 Telegram 群聊
await bridge.sendMessage('xiaod', '你好小D');

// 处理来自 Telegram 的消息
const telegramMessage = {
  text: '@xiaoc 你好',
  message_id: 123
};
await bridge.handleTelegramMessage(telegramMessage);
```

### 集成到 OpenClaw

创建 `skills/bot-bridge/SKILL.md`：

```markdown
# Bot Bridge Skill

使用 Bot Bridge 与其他 OpenClaw 机器人通信，并支持 Telegram 群聊对话。

## 命令

### bridge send <recipient> <message>
发送消息给其他机器人

示例：
```
bridge send xiaod 你好小D
```

### bridge broadcast <message>
广播消息给所有机器人

示例：
```
bridge broadcast 大家好
```

### bridge status
查看中转服务状态和在线机器人列表

## 配置

在 `~/.openclaw/.env` 中设置：
```
BRIDGE_API_URL=http://your-server:3000
BOT_ID=xiaoc
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=-5094630990
```

## Telegram 集成

当启用了 Telegram 集成时：
1. 收到其他 bot 的消息会自动转发到 Telegram 群聊
2. 发送消息会同时发送到其他 bot 和 Telegram 群聊
3. 支持 @ 回复语法（如 @xiaod 你好）
```

---

## 🧪 测试

### 运行所有测试

```bash
npm test
```

**注意：** 当前测试主要针对 HTTP API。WebSocket 测试需要单独的测试框架。

### 手动测试

1. **启动服务端**
```bash
npm start
```

2. **启动多个客户端（不同终端）**

终端 1 - 小C：
```bash
BOT_ID=xiaoc npm run start:client
```

终端 2 - 小D：
```bash
BOT_ID=xiaod npm run start:client
```

3. **测试通信**
在小C 的终端输入（如果添加了 REPL）或通过代码调用 `sendMessage`

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

4. **使用 PM2 管理进程**
```bash
pm2 start server/index.js --name bot-bridge
pm2 startup
pm2 save
```

### Nginx 反向代理（支持 WebSocket）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
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

### 问题：WebSocket 连接失败

**检查：**
1. 服务是否启动：`curl http://localhost:3000/health`
2. 防火墙是否开放端口 3000
3. `BRIDGE_API_URL` 是否正确
4. WebSocket URL 格式是否正确

### 问题：收不到消息

**检查：**
1. Bot ID 是否配置正确
2. 是否连接到同一个服务器
3. 查看服务端日志

### 问题：Telegram 消息未发送

**检查：**
1. `TELEGRAM_BOT_TOKEN` 是否正确
2. `TELEGRAM_CHAT_ID` 是否正确
3. Bot 是否被添加到群聊

---

## 📊 性能

### WebSocket vs HTTP 轮询

| 指标 | WebSocket | HTTP 轮询 (5s) |
|------|-----------|----------------|
| 实时性 | < 100ms | 0-5s |
| 网络开销 | 心跳包 ~1KB/min | ~2KB/请求 |
| 服务器连接 | 1个长期连接 | 每次请求新连接 |
| 消息延迟 | 推送即达 | 最多5秒 |

### 资源占用

- **服务端内存**: ~60MB (2个bot)
- **客户端内存**: ~25MB
- **网络流量**: ~1KB/分钟 (无消息时)

---

## 🔐 安全建议

1. **使用 HTTPS/WSS**: 生产环境使用 SSL 证书
2. **API 认证**: 添加 API Key 验证
3. **限制访问**: 使用防火墙限制访问来源
4. **定期清理**: 设置自动删除旧消息
5. **Telegram Token 安全**: 不要在代码中硬编码 Token

---

## 📝 更新日志

### v2.0.0 - WebSocket 版本

- ✨ 添加 WebSocket 实时通信
- ✨ 添加 Telegram Bot API 集成
- ✨ 添加自动重连机制
- ✨ 添加离线消息队列
- ✨ 添加消息确认 (ACK)
- 📝 添加连接状态监控
- 🐛 修复轮询效率问题

### v1.0.0 - 初始版本

- HTTP API 基础功能
- SQLite 持久化
- 基本测试覆盖

---

## 📚 License

MIT
