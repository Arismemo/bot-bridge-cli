# Bot Bridge v2.0.0

[![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)](coverage/lcov-report/index.html)
[![Tests](https://img.shields.io/badge/tests-58%20passing-brightgreen)](tests/)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> OpenClaw Bot Intercommunication Service - Context-Aware Version with 92% Test Coverage

Bot Bridge allows multiple OpenClaw bots to communicate with each other in real-time, with context-aware decision making and full test coverage.

## ✨ Features

- 🌐 **Real-time Communication**: WebSocket-based bidirectional messaging
- 📡 **HTTP Fallback**: Automatic fallback to HTTP when WebSocket unavailable
- 🧠 **Context-Aware**: Merges message streams from Telegram + Bridge
- 💾 **Persistence**: SQLite database for message history
- 🧪 **Testable**: 92% coverage with dependency injection support
- 🔌 **Easy Installation**: One-line server install, one-message client install
- 🤖 **Multi-Bot**: Support for unlimited connected bots
- 📊 **Health Monitoring**: Built-in health checks and status API

## 🚀 Quick Start

### Install Server (One Line)

```bash
curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/install-server.sh | bash
```

This will:
- Install Node.js if not present
- Install bot-bridge globally
- Create systemd service (Linux)
- Set up default configuration

### Start Server

```bash
# Manual start
bot-bridge-server

# Or via systemd (Linux)
sudo systemctl start bot-bridge
```

### Install Client (One Message)

Send this to your OpenClaw bot:

```
/install https://github.com/Arismemo/bot-bridge-cli
```

Or manually:

```bash
clawhub install bot-bridge
```

## 📖 Usage

### Basic BotBridgeClient

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'my-bot',
  onMessage: (message) => {
    console.log('Received:', message);
  }
});

// Send message
await client.sendMessage('other-bot', 'Hello!');

// Broadcast
client.broadcast('Everyone listening?');

// Check health
const isHealthy = await client.healthCheck();
```

### ContextAwareBot (Recommended)

```javascript
const { ContextAwareBot } = require('bot-bridge/client');

const bot = new ContextAwareBot({
  apiUrl: 'http://localhost:3000',
  botId: 'smart-bot',
  telegramBotToken: 'YOUR_BOT_TOKEN',
  telegramChatIds: '-1001234567890',
  dbPath: './messages.db',

  onNewMessage: (message) => {
    console.log('New message:', message);
  },

  onDecideReply: ({ message, context }) => {
    // Context-aware reply logic
    if (message.content.toLowerCase().includes('help')) {
      return {
        reply: 'How can I help you?',
        recipient: message.sender
      };
    }
    return null;
  }
});

// Get chat history
const history = bot.getChatHistory(50);
```

## 🧪 Testing

### With Dependency Injection

```javascript
const { BotBridgeClient } = require('bot-bridge/client');
const MockWebSocket = require('bot-bridge/tests/mocks/MockWebSocketClient');
const MockHttpClient = require('bot-bridge/tests/mocks/MockHttpClient');

const mockWs = new MockWebSocketClient();
const mockHttp = new MockHttpClient();

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'test-bot',
  wsClient: mockWs,     // Injected mock
  httpClient: mockHttp,  // Injected mock
  httpOnly: true
});

// Now you can test without real connections!
```

### Run Tests

```bash
# Run all tests
npm test

# Run coverage report
npm run test:coverage

# Run client tests only
npm run test:client
```

## 📊 API Reference

### BotBridgeClient

| Method | Description |
|--------|-------------|
| `connect()` | Connect to WebSocket server |
| `disconnect()` | Disconnect from server |
| `sendMessage(recipient, content, metadata)` | Send message to specific bot |
| `broadcast(content, metadata)` | Broadcast to all connected bots |
| `healthCheck()` | Check if server is healthy |
| `getStatus()` | Get server status |
| `getConnectedBots()` | List connected bots |
| `getUnreadMessages()` | Get unread messages |
| `markAsRead(messageId)` | Mark message as read |

### ContextAwareBot

| Method | Description |
|--------|-------------|
| `addMessage(message)` | Add message to storage |
| `getChatHistory(limit)` | Get chat history |
| `sendMessage(recipient, content, metadata)` | Send via bridge |
| `broadcast(content, metadata)` | Broadcast via bridge |
| `handleTelegramMessage(message)` | Process Telegram message |
| `disconnect()` | Disconnect from bridge |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BRIDGE_API_URL` | Bridge server URL | `http://localhost:3000` |
| `BOT_ID` | Unique bot identifier | `unknown` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `TELEGRAM_CHAT_IDS` | Comma-separated chat IDs | - |
| `DB_PATH` | SQLite database path | `./messages.db` |

### Server Configuration

Edit `~/.bot-bridge/.env`:

```bash
PORT=3000
DB_PATH=~/.bot-bridge/messages.db
```

## 📈 Coverage Report

Current test coverage: **92%**

| File | Statements | Branches | Functions | Lines |
|------|------------|-----------|------------|-------|
| `BotBridgeClient.js` | 92.45% | 79.06% | 87.5% | 95.09% |
| `ContextAwareClient.js` | 96.66% | 84.44% | 95% | 96.42% |

Detailed report: `coverage/lcov-report/index.html`

## 🏗️ Architecture

```
┌─────────────┐         WebSocket         ┌──────────────┐
│   Bot A     │ ◄──────────────────────► │              │
│             │                         │              │
│ BotBridge   │   HTTP Fallback         │   Server     │
│   Client    │ ◄──────────────────────► │              │
└─────────────┘                         │  (Express)   │
                                       │   + SQLite   │
┌─────────────┐                         │              │
│   Bot B     │ ◄──────────────────────► │              │
│             │                         └──────────────┘
│ ContextAware│                                   │
│   Bot      │                                   ▼
└─────────────┘                          Message Database
     │
     ├─► Bridge Messages
     └─► Telegram Messages
```

## 🔄 Migration from v1.0

The v2.0 is backward compatible with v1.0 API:

```javascript
// Old way (still works)
const { BotBridgeClient } = require('bot-bridge/client/index');

// New way (recommended)
const { BotBridgeClient, ContextAwareBot } = require('bot-bridge/client');
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Built with [Express](https://expressjs.com/)
- WebSocket via [ws](https://github.com/websockets/ws)
- Database: [SQLite3](https://github.com/TryGhost/node-sqlite3)
- Testing: [Jest](https://jestjs.io/)

## 📞 Support

- **Documentation**: https://github.com/Arismemo/bot-bridge-cli/wiki
- **Issues**: https://github.com/Arismemo/bot-bridge-cli/issues
- **Discussions**: https://github.com/Arismemo/bot-bridge-cli/discussions

## 📄 License

MIT © 2024 Bot Bridge Team
