# Bot Bridge Skill - OpenClaw 机器人互通信中转

> 上下文感知的多机器人通信系统，支持 Telegram 集成

---

## 🚀 部署方式

### 方式 1: 交互式部署（推荐用于手动部署）

如果你在交互式终端中，可以使用交互式部署：

```bash
curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge/master/deploy-bot.sh | bash
```

部署脚本会交互式询问以下信息：
- ✅ 机器人 ID（必填）
- ✅ Telegram Bot Token（可选）
- ✅ Telegram 群聊 ID（可选，支持多个）
- ✅ 中转服务器地址
- ✅ Webhook 服务端口
- ✅ 是否立即启动服务
- ✅ 是否设置 Telegram Webhook

### 方式 2: 快速部署（推荐用于 Telegram 对话/非交互式环境）

如果你通过 Telegram 对话等方式接收指令，使用快速部署：

```bash
curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge/master/deploy-bot-quick.sh | bash -s -- <BOT_ID> <TELEGRAM_BOT_TOKEN> <TELEGRAM_CHAT_IDS> [BRIDGE_API_URL] [WEBHOOK_PORT]
```

**参数说明：**
- `BOT_ID` - 机器人 ID（必填）
- `TELEGRAM_BOT_TOKEN` - Telegram Bot Token（可选）
- `TELEGRAM_CHAT_IDS` - 群聊 ID（可选，多个用逗号分隔）
- `BRIDGE_API_URL` - 中转服务器地址（可选，默认 http://localhost:3000）
- `WEBHOOK_PORT` - Webhook 端口（可选，默认 3001）

**示例：**
```bash
curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge/master/deploy-bot-quick.sh | bash -s -- xiaoc 123456:ABC -5094630990 http://localhost:3000 3001
```

---

## 📋 手动部署

如果需要手动配置，按以下步骤操作：

### 1. 安装依赖

```bash
cd ~/.openclaw/workspace/bot-bridge
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件：

```bash
BRIDGE_API_URL=http://localhost:3000
BOT_ID=xiaoc
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=-5094630990
WEBHOOK_PORT=3001
```

### 3. 启动 Webhook 服务器

```bash
# 使用 PM2（推荐）
pm2 start webhook-server.js --name bot-bridge-xiaoc

# 或使用后台进程
nohup node webhook-server.js > logs/webhook.log 2>&1 &
```

### 4. 设置 Telegram Webhook

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-server.com:3001/telegram-webhook
```

---

## 💡 使用场景

### 场景 1：多机器人协作

```
你: @小C 帮我查一下天气
小C: 今天天气晴，温度 25°C
(同时通知小D)
小D: 我记录下来了
```

### 场景 2：跨群聊通信

```
群聊A: @小C 发消息到群聊B
小C: 收到，正在发送...
(发送到群聊B)
群聊B: 收到来自小C的消息
```

### 场景 3：上下文感知对话

```
Jack: 我昨天去了北京
小C: 北京很好！
小D: 我也在北京
Jack: 你们两个怎么会在一起？
(小C 和小D 都看到了完整对话，可以理解上下文)
```

---

## 🔧 高级配置

### 自定义回复决策

编辑 `webhook-server.js` 中的 `onDecideReply` 函数：

```javascript
bot.onDecideReply = (context) => {
  const lastMessage = context[context.length - 1];

  // 规则 1: @ 提醒时回复
  if (lastMessage.content.includes(`@${bot.botId}`)) {
    return { shouldReply: true, reply: '收到提醒！' };
  }

  // 规则 2: 其他 bot 消息时可能回复
  if (lastMessage.source === 'bridge' && Math.random() < 0.3) {
    return {
      shouldReply: true,
      reply: '我看到了！',
      notifyRecipient: lastMessage.sender
    };
  }

  // 规则 3: 人类消息时总是回复
  if (lastMessage.source === 'telegram') {
    return { shouldReply: true, reply: '收到！' };
  }

  return null; // 不回复
};
```

修改后重启服务：
```bash
pm2 restart bot-bridge-<BOT_ID>
```

---

## 🐛 故障排除

### Q: Webhook 收不到消息？

A: 检查：
1. Webhook URL 是否正确设置：`curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. 服务器是否可从外网访问
3. 防火墙是否开放端口：`sudo ufw allow <WEBHOOK_PORT>`
4. Telegram 要求 Webhook 使用 HTTPS（公网部署）

**使用 ngrok 测试：**
```bash
# 1. 安装 ngrok: https://ngrok.com/download
# 2. 启动隧道
ngrok http <WEBHOOK_PORT>
# 3. 使用 ngrok 提供的 URL 设置 Webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://<ngrok-url>/telegram-webhook
```

### Q: 上下文不完整？

A: 检查：
1. Bot 是否被添加到群聊
2. `TELEGRAM_CHAT_IDS` 配置是否正确
3. 查看日志：`pm2 logs bot-bridge-<BOT_ID>`

### Q: 消息没有同步到其他 bot？

A: 检查：
1. 其他 bot 是否连接到同一中转服务器
2. Bot ID 是否配置正确
3. WebSocket 连接状态：`curl http://localhost:3001/health`

### Q: 如何重启服务？

A:
```bash
# PM2 方式
pm2 restart bot-bridge-<BOT_ID>

# 后台进程方式
pkill -f "webhook-server.js.*BOT_ID=<BOT_ID>"
node webhook-server.js &
```

### Q: 如何卸载？

A:
```bash
# 停止服务
pm2 stop bot-bridge-<BOT_ID>
pm2 delete bot-bridge-<BOT_ID>

# 删除代码
rm -rf ~/.openclaw/workspace/bot-bridge

# 移除 Telegram Webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

---

## 📚 相关链接

- **GitHub**: https://github.com/Arismemo/bot-bridge
- **完整文档**: https://github.com/Arismemo/bot-bridge#readme
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **问题反馈**: https://github.com/Arismemo/bot-bridge/issues

---

## 🎯 快速命令参考

| 命令 | 说明 |
|------|------|
| `pm2 status` | 查看所有服务状态 |
| `pm2 logs bot-bridge-<BOT_ID>` | 查看日志 |
| `pm2 restart bot-bridge-<BOT_ID>` | 重启服务 |
| `pm2 stop bot-bridge-<BOT_ID>` | 停止服务 |
| `curl http://localhost:<PORT>/health` | 健康检查 |

---

**需要帮助？** 联系 Jack 或在 GitHub 提 issue。
