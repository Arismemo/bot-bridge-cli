# Bot Bridge - OpenClaw Bot 互通信中转 (Context-Aware 版本)

## 📋 概述

Bot Bridge 是一个支持 WebSocket 的 HTTP API 服务，用于在多个 OpenClaw bot 之间实时传递消息。新版本支持**上下文感知**：机器人能够看到 Telegram 群聊的完整聊天记录（包括人类消息），并基于此决定是否/如何回复。

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram 群聊                            │
│   人类消息 + Bot 消息（通过 webhook/轮询获取）         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓ (监听)
              ┌───────────▼───────────┐
              │   上下文合并层        │
              │  Telegram + Bridge     │
              │  消息按时间合并       │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │   决定是否/如何回复    │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
   Telegram          Bridge Server      其他 Bot
  (发送回复)        (通知)         (实时通信)
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
# WebSocket: ws://localhost:3000/?bot_id=<your-bot-id>
```

### 3. 启动 Webhook 服务器（用于接收 Telegram 消息）

```bash
npm run start:webhook
# Webhook 服务器运行在 http://localhost:3001
# Telegram Webhook 端点: http://localhost:3001/telegram-webhook
```

### 4. 设置 Telegram Webhook

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-server.com:3001/telegram-webhook
```

### 5. 配置并启动客户端

```bash
# 支持多个群聊，用逗号分隔
export BRIDGE_API_URL=http://localhost:3000
export BOT_ID=xiaoc
export TELEGRAM_BOT_TOKEN=your_bot_token
export TELEGRAM_CHAT_IDS=-5094630990,-1000000000

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
| `TELEGRAM_CHAT_IDS` | 群聊 ID（支持多个，逗号分隔）| optional |
| `WEBHOOK_PORT` | Webhook 服务端口 | 3001 |

---

## 💻 客户端使用示例

### 基本使用（上下文感知）

```javascript
const { ContextAwareBot } = require('./client/index');

const bot = new ContextAwareBot({
  apiUrl: 'http://localhost:3000',
  botId: 'xiaoc',
  telegramBotToken: 'your_bot_token',
  telegramChatIds: ['-5094630990', '-1000000000']
});

// 监听所有新消息（来自 Telegram 和 Bridge）
bot.onNewMessage = (message) => {
  console.log(`[${message.source}] ${message.sender}: ${message.content}`);
};

// 自定义回复决策逻辑
bot.onDecideReply = (context) => {
  // context 是最近的聊天记录数组
  // 返回 { shouldReply: boolean, reply: string, notifyRecipient: string }
  // 或 null 表示不回复

  const lastMessage = context[context.length - 1];

  // 示例：如果 @ 了这个 bot，回复
  if (lastMessage.content.includes(`@${this.botId}`)) {
    return {
      shouldReply: true,
      reply: `收到 @ 提醒！`,
      notifyRecipient: null
    };
  }

  // 示例：如果其他 bot 发送了消息，可能回复
  if (lastMessage.source === 'bridge') {
    return {
      shouldReply: true,
      reply: `我看到了你的消息！`,
      notifyRecipient: lastMessage.sender
    };
  }

  return null; // 不回复
};

// 发送消息到群聊（同时通知其他 bot）
await bot.sendMessageToGroup('-5094630990', '大家好！', {
  alsoNotifyBridge: true,
  notifyRecipient: 'xiaod' // 可选：通知特定 bot
});
```

### 处理 Telegram 消息（Webhook 或轮询）

```javascript
// 当收到 Telegram webhook 消息时
app.post('/telegram-webhook', (req, res) => {
  const telegramMessage = req.body;

  // 交给 ContextAwareBot 处理
  bot.handleTelegramMessage(telegramMessage);

  res.sendStatus(200);
});
```

### 使用内置 Webhook 服务器

项目提供了开箱即用的 Webhook 服务器 `webhook-server.js`：

**启动方式：**
```bash
npm run start:webhook
```

**环境变量：**
```bash
WEBHOOK_PORT=3001  # Webhook 端口（默认 3001）
```

**功能：**
- 自动接收 Telegram 消息
- 转发给 `ContextAwareBot` 处理
- 健康检查端点：`/health`

**设置 Telegram Webhook：**
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-server.com:3001/telegram-webhook
```

**使用 PM2 管理进程：**
```bash
pm2 start webhook-server.js --name bot-bridge-webhook
pm2 save
```

### 获取完整聊天记录

```javascript
// 获取最近 20 条消息（所有来源）
const history = bot.getChatHistory({ limit: 20 });
console.log(history);

// 获取特定群聊的记录
const groupHistory = bot.getChatHistory({ limit: 20, chatIds: ['-5094630990'] });

// 获取格式化的上下文（用于传给 OpenClaw）
const context = bot.getContext({ limit: 20, chatId: '-5094630990' });
console.log(context);
```

---

## 🌐 HTTP API 文档

### POST /api/messages
发送消息

### GET /api/messages
获取消息

### POST /api/messages/:id/read
标记消息为已读

### GET /api/status
服务状态

### GET /api/connections
获取在线 bot 列表

---

## 📊 上下文合并机制

### 消息来源

1. **Telegram**: 从 Telegram 群聊获取的消息（包括人类消息）
   - 字段：`source: 'telegram'`
   - 包含：`userId`, `chatId`, `messageId`

2. **Bridge**: 从 Bridge Server 获取的 bot 间消息
   - 字段：`source: 'bridge'`
   - 包含：`sender` (botId), `metadata`

### 时间顺序合并

所有消息按 `timestamp` 字段排序，确保上下文连贯性。

### 消息格式

```javascript
{
  source: 'telegram' | 'bridge',
  sender: 'user123' | 'xiaod',
  userId: 123456789,  // 仅 Telegram
  chatId: '-5094630990',  // 仅 Telegram
  content: '消息内容',
  timestamp: '2026-02-01T15:00:00.000Z',
  messageId: 123,  // 仅 Telegram
  metadata: {
    reply_to_message_id: 456,
    telegram_message_id: 789
  }
}
```

---

## 🔧 集成到 OpenClaw

创建 `skills/bot-bridge/SKILL.md`：

```markdown
# Bot Bridge Skill

使用 Bot Bridge 与其他 OpenClaw 机器人通信，并支持群聊上下文感知。

## 命令

### bridge send <chat_id> <message>
发送消息到指定群聊

示例：
```
bridge send -5094630990 你好大家
```

### bridge context [limit] [chat_id]
查看最近的聊天上下文

示例：
```
bridge context 20 -5094630990
```

### bridge status
查看中转服务状态和在线机器人列表

## 配置

在 `~/.openclaw/.env` 中设置：
```
BRIDGE_API_URL=http://your-server:3000
BOT_ID=xiaoc
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=-5094630990,-1000000000
```

## Webhook 设置

需要设置 Telegram Webhook 来接收群聊消息：

```bash
curl -X POST https://api.telegram.org/bot<token>/setWebhook \
  -d url=https://your-server.com/telegram-webhook
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

### 问题：上下文不完整

**检查：**
1. Telegram webhook 是否正常接收消息
2. Bot 是否被添加到群聊
3. `TELEGRAM_CHAT_IDS` 配置是否正确

### 问题：WebSocket 连接失败

**检查：**
1. 服务是否启动：`curl http://localhost:3000/health`
2. 防火墙是否开放端口 3000
3. `BRIDGE_API_URL` 配置是否正确

### 问题：消息没有同步

**检查：**
1. Bot ID 是否配置正确
2. 其他 bot 是否连接到同一服务器
3. 查看服务端日志

---

## 📝 更新日志

### v3.0.0 - Context-Aware 版本

- ✨ 添加上下文感知功能（消息合并）
- ✨ 支持多个群聊（`TELEGRAM_CHAT_IDS`）
- ✨ 添加 `ContextAwareBot` 类
- ✨ 添加消息决策机制
- 📝 更新文档

### v2.0.0 - WebSocket 版本

- ✨ 添加 WebSocket 实时通信
- ✨ 添加 Telegram Bot API 集成
- ✨ 添加自动重连机制
- 🐛 修复轮询效率问题

### v1.0.0 - 初始版本

- HTTP API 基础功能
- SQLite 持久化
- 基本测试覆盖

---

## 📚 License

MIT
