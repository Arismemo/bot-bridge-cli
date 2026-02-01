#!/usr/bin/env node

/**
 * Webhook Server - 接收 Telegram 消息并转发给 ContextAwareBot
 *
 * 使用方式：
 * node webhook-server.js
 *
 * 环境变量：
 * - BRIDGE_API_URL: 中转服务地址
 * - BOT_ID: 机器人 ID
 * - TELEGRAM_BOT_TOKEN: Telegram Bot Token
 * - TELEGRAM_CHAT_IDS: 群聊 ID（逗号分隔）
 * - WEBHOOK_PORT: Webhook 服务端口（默认 3001）
 */

const express = require('express');
const { ContextAwareBot } = require('./client/index');

const app = express();
app.use(express.json());

// 创建 ContextAwareBot 实例
const bot = new ContextAwareBot({
  apiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3000',
  botId: process.env.BOT_ID || 'unknown',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatIds: process.env.TELEGRAM_CHAT_IDS
    ? process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim())
    : []
});

// 监听新消息（可选：记录日志）
bot.onNewMessage = (message) => {
  console.log(`[Webhook] New message: [${message.source}] ${message.sender}: ${message.content}`);
};

// 设置 Telegram Webhook
bot.onDecideReply = (context) => {
  console.log('[Webhook] Context received for decision:', context.length, 'messages');

  const lastMessage = context[context.length - 1];

  // 规则 1: 如果 @ 了这个 bot，回复
  if (lastMessage.content.includes(`@${bot.botId}`)) {
    return {
      shouldReply: true,
      reply: `收到 @ 提醒！`,
      notifyRecipient: null
    };
  }

  // 规则 2: 如果其他 bot 发送了消息，考虑回复
  if (lastMessage.source === 'bridge') {
    if (Math.random() < 0.3) {
      return {
        shouldReply: true,
        reply: `我看到了你的消息！`,
        notifyRecipient: lastMessage.sender
      };
    }
  }

  // 规则 3: 人类直接对话，总是回复
  if (lastMessage.source === 'telegram') {
    return {
      shouldReply: true,
      reply: `收到你的消息！`,
      notifyRecipient: null
    };
  }

  return null; // 不回复
};

// Telegram Webhook 端点
app.post('/telegram-webhook', (req, res) => {
  const telegramMessage = req.body;

  console.log('[Webhook] Received Telegram message:', JSON.stringify(telegramMessage, null, 2));

  // 交给 ContextAwareBot 处理
  bot.handleTelegramMessage(telegramMessage);

  res.sendStatus(200);
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    botId: bot.botId,
    connected: bot.bridge.connected,
    chatIds: bot.telegramChatIds
  });
});

// 启动服务器
const port = process.env.WEBHOOK_PORT || 3001;
let server; // 确保 server 在 if 外部声明

if (require.main === module) { // 只有在直接运行时才启动服务器
  server = app.listen(port, () => {
    console.log(`[Webhook] Server running on port ${port}`);
    console.log(`[Webhook] Bot ID: ${bot.botId}`);
    console.log(`[Webhook] Chat IDs: ${bot.telegramChatIds.join(', ')}`);
    console.log(`[Webhook] Telegram Webhook endpoint: http://your-server:${port}/telegram-webhook`);
  });
} else {
  // 当被 require 时，不启动服务器，但仍然可以访问 app 和 bot 实例
  // server 变量在这里仍然需要被赋值，以便 module.exports 能够导出它
  server = {
      close: (cb) => { // 提供一个模拟的 close 方法
          console.log('[Webhook] Mock server close called.');
          cb();
      },
      address: () => ({port: port}) // 添加 address 方法以模拟真实的 server 对象
  };
}

// 优雅关闭 (这部分需要使用我们声明的 server 变量)
process.on('SIGTERM', () => {
  console.log('[Webhook] SIGTERM received, shutting down...');
  if (server && typeof server.close === 'function') { // 确保 server 存在且有 close 方法
    server.close(() => {
      bot.disconnect();
      console.log('[Webhook] Server closed');
      process.exit(0);
    });
  } else {
    console.log('[Webhook] Server not running or has no close method during SIGTERM.');
    process.exit(0);
  }


  setTimeout(() => {
    console.error('[Webhook] Forcing shutdown...');
    process.exit(1);
  }, 10000);
});

module.exports = { app, bot, server }; // 导出 server 实例
