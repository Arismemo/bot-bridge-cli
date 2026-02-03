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

### Production Deployment (Nginx + HTTPS)

For production use, we recommend deploying with Nginx and HTTPS:

- [See full Nginx setup guide](NGINX_SETUP.md)
- Use domain instead of IP
- Enable HTTPS with Let's Encrypt
- Configure load balancing and security

**Quick links**:
- [Basic HTTP configuration](NGINX_SETUP.md#基础配置)
- [HTTPS setup with Let's Encrypt](NGINX_SETUP.md#https-配置推荐)
- [Load balancing](NGINX_SETUP.md#负载均衡)
- [Security best practices](NGINX_SETUP.md#安全建议)

### Install Client (One Message)

Send this to your OpenClaw bot:

```
/install https://github.com/Arismemo/bot-bridge-cli
```

Or use Gitee mirror (faster in China):

```
/install https://gitee.com/john121/bot-bridge-cli
```

**Verify installation**:

Send `/skills` command and check if `bot-bridge` is in the list:

```
/skills
```

If you see `bot-bridge`, installation successful ✅

**Quick test** (5 minutes to first message):

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  // Replace with your server URL
  apiUrl: 'https://your-server.com',  // or 'http://localhost:3000' for local
  botId: 'my-bot',  // Unique ID for your bot
  onMessage: (msg) => console.log('Received:', msg)
});

// Connect to server
await client.connect();
console.log('Connected!');

// Send message
await client.sendMessage('other-bot', 'Hello from my bot!');
console.log('Message sent!');

// Check status
const isHealthy = await client.healthCheck();
console.log('Server healthy:', isHealthy);
```

Or manually:

```bash
clawhub install bot-bridge
```

**See detailed installation guide**: [CLIENT_INSTALL_IMPROVED.md](CLIENT_INSTALL_IMPROVED.md)

## 📖 Usage

### Quick Start (5 minutes to first message)

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  // Your server URL (replace with your actual server)
  apiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3000',
  botId: 'my-bot',  // Unique ID for this bot
  onMessage: (message) => {
    console.log('Received:', message);
  }
});

// Connect to server
await client.connect();
console.log('Connected to Bot Bridge!');

// Send message to another bot
await client.sendMessage('other-bot', 'Hello!');
console.log('Message sent!');

// Check if server is healthy
const isHealthy = await client.healthCheck();
console.log('Server healthy:', isHealthy);

// See connected bots
const bots = await client.getConnectedBots();
console.log('Connected bots:', bots.bots);
```

### Basic BotBridgeClient (Full Reference)

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',  // Your server URL
  botId: 'my-bot',                   // Unique bot ID
  onMessage: (message) => {            // Callback for received messages
    console.log('Received:', message);
  }
});

// Connect to WebSocket server
await client.connect();

// Send message to specific bot
await client.sendMessage('other-bot', 'Hello!');

// Broadcast to all connected bots
client.broadcast('Everyone listening?');

// Check server health
const isHealthy = await client.healthCheck();

// Get server status
const status = await client.getStatus();

// Get connected bots list
const bots = await client.getConnectedBots();

// Get unread messages
const messages = await client.getUnreadMessages();

// Mark message as read
await client.markAsRead(messageId);

// Disconnect from server
await client.disconnect();
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

## 🔧 Troubleshooting

### Port Already in Use (EADDRINUSE)

If you see `EADDRINUSE: address already in use 0.0.0.0:3000`:

```bash
# Find and kill process using port 3000
PID=$(lsof -ti:3000)
if [ -n "$PID" ]; then
    echo "Stopping process $PID on port 3000..."
    kill $PID
    sleep 2
fi

# Restart server
bot-bridge-server
```

### Service Won't Start

```bash
# Check if service is running
ps aux | grep bot-bridge

# Check port
netstat -tlnp | grep :3000

# Check logs
journalctl -u bot-bridge -f
```

### Connection Refused

```bash
# Verify service is running
curl http://localhost:3000/health

# Check configuration
cat ~/.bot-bridge/.env

# Start manually to see errors
cd ~/.bot-bridge
node server/index.js
```

### Git Clone Fails (China/Gitee Users)

```bash
# Use Gitee mirror
git clone https://gitee.com/john121/bot-bridge-cli.git ~/.bot-bridge

# Or use environment variable
USE_GITEE=1 curl -sSL https://raw.githubusercontent.com/Arismemo/bot-bridge-cli/master/install-server.sh | bash
```

---

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
