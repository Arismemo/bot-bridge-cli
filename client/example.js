#!/usr/bin/env node

/**
 * Example Bot - 使用 ContextAwareBot 的示例
 *
 * 使用方式：
 * BOT_ID=xiaoc TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_IDS=-5094630990 node client/example.js
 */

const { ContextAwareBot } = require('./index');

// 创建 bot 实例
const bot = new ContextAwareBot({
  apiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3000',
  botId: process.env.BOT_ID || 'unknown',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatIds: process.env.TELEGRAM_CHAT_IDS
    ? process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim())
    : []
});

// 监听新消息
bot.onNewMessage = (message) => {
  console.log(`[Bot] New message: [${message.source}] ${message.sender}: ${message.content}`);
};

// 设置回复决策逻辑
bot.onDecideReply = (context) => {
  console.log(`[Bot] Making decision based on ${context.length} messages`);

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
    // 随机回复（避免刷屏）
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

console.log(`[Bot] Started: ${bot.botId}`);
console.log(`[Bot] Chat IDs: ${bot.telegramChatIds.join(', ')}`);
console.log('[Bot] Listening for messages...');

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Bot] SIGTERM received, shutting down...');
  bot.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Bot] SIGINT received, shutting down...');
  bot.disconnect();
  process.exit(0);
});
