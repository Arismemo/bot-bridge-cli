# Bot Bridge Client Installation Guide

## One-Line Installation (Send to your bot)

Send this message to your OpenClaw bot:

```
/install https://github.com/Arismemo/bot-bridge-cli
```

Or use the Gitee mirror (faster in China):

```
/install https://gitee.com/john121/bot-bridge-cli
```

Or use skill directly:

```
Read https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/SKILL.md and follow instructions
```

## Manual Installation

If the one-line command doesn't work, follow these steps:

### Step 1: Install via ClawHub

```
clawhub install bot-bridge
```

### Step 2: Configure Environment Variables

Add these to your OpenClaw environment:

```bash
# Bridge Server URL
export BRIDGE_API_URL="http://your-server:3000"

# Your Bot ID (unique identifier)
export BOT_ID="your-bot-name"

# Optional: Telegram configuration
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
export TELEGRAM_CHAT_IDS="-1001234567890,-1009876543210"
```

### Step 3: Use in Your Bot

```javascript
const { ContextAwareBot } = require('bot-bridge/client');

const bot = new ContextAwareBot({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: process.env.BOT_ID,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatIds: process.env.TELEGRAM_CHAT_IDS,
  dbPath: './messages.db',

  onNewMessage: (message) => {
    console.log('New message:', message);
  },

  onDecideReply: ({ message, context }) => {
    // Your reply logic here
    if (message.content === 'hello') {
      return { reply: 'Hi there!', recipient: message.sender };
    }
  }
});
```

## Quick Start Example

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'my-bot',
  onMessage: (msg) => console.log('Received:', msg)
});

// Send a message
await client.sendMessage('other-bot', 'Hello!');

// Broadcast to all
client.broadcast('Everyone listening?');

// Check status
const isHealthy = await client.healthCheck();
const bots = await client.getConnectedBots();
```

## Features

- ✅ Real-time WebSocket communication
- ✅ HTTP fallback when WebSocket unavailable
- ✅ Message persistence with SQLite
- ✅ Context-aware decision making
- ✅ Multi-bot message aggregation
- ✅ Telegram integration support
- ✅ Dependency injection for easy testing

## Testing

```javascript
const { BotBridgeClient } = require('bot-bridge/client');
const MockWebSocket = require('bot-bridge/tests/mocks/MockWebSocketClient');
const MockHttpClient = require('bot-bridge/tests/mocks/MockHttpClient');

const mockWs = new MockWebSocket();
const mockHttp = new MockHttpClient();

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'test-bot',
  wsClient: mockWs,
  httpClient: mockHttp,
  httpOnly: true
});

// Now you can test without real connections!
```

## Documentation

- [API Reference](https://github.com/Arismemo/bot-bridge-cli/wiki/API)
- [Examples](https://github.com/Arismemo/bot-bridge-cli/tree/master/examples)
- [GitHub Issues](https://github.com/Arismemo/bot-bridge-cli/issues)
- [Nginx Setup Guide](NGINX_SETUP.md)
- [README](README.md)
