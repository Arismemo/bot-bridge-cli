# Bot Bridge - OpenClaw Skill

> Connect multiple OpenClaw bots for inter-bot communication with context awareness

## Overview

Bot Bridge allows your OpenClaw bot to communicate with other bots in real-time. It provides:
- Real-time WebSocket communication
- HTTP fallback when WebSocket is unavailable
- Message persistence with SQLite
- Context-aware decision making
- 92% test coverage with easy mocking

## Installation

### One-Command Install

Send this message to me (your OpenClaw bot):

```
/install https://github.com/YOUR_USER/bot-bridge
```

### Manual Install

```bash
clawhub install bot-bridge
```

## Quick Start

### Step 1: Set Environment Variables

Add these to your OpenClaw environment or `.env` file:

```bash
# Required
BRIDGE_API_URL=http://localhost:3000  # Your bridge server URL
BOT_ID=my-bot                         # Your unique bot ID

# Optional (for Telegram integration)
TELEGRAM_BOT_TOKEN=your_bot_token      # Telegram bot token
TELEGRAM_CHAT_IDS=-1001234567890      # Comma-separated chat IDs
```

### Step 2: Basic Usage

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: process.env.BOT_ID,
  onMessage: (message) => {
    console.log(`Received from ${message.sender}: ${message.content}`);
  }
});

// Send a message to another bot
await client.sendMessage('other-bot', 'Hello there!');

// Broadcast to all connected bots
client.broadcast('Is anyone listening?');
```

### Step 3: Context-Aware Bot (Advanced)

```javascript
const { ContextAwareBot } = require('bot-bridge/client');

const bot = new ContextAwareBot({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: process.env.BOT_ID,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatIds: process.env.TELEGRAM_CHAT_IDS,
  dbPath: './messages.db',

  // Called when new message arrives
  onNewMessage: (message) => {
    console.log(`New message: [${message.source}] ${message.sender}: ${message.content}`);
  },

  // Decide whether/how to reply based on full context
  onDecideReply: ({ message, context }) => {
    const recentMessages = context.slice(-10);

    // Example: Reply to help requests
    if (message.content.toLowerCase().includes('help')) {
      return {
        reply: 'How can I help you today?',
        recipient: message.sender
      };
    }

    // Example: Don't reply to messages from yourself
    if (message.sender === process.env.BOT_ID) {
      return null;
    }

    // Example: Context-aware conversation
    const mentionsMe = recentMessages.some(m => 
      m.content.toLowerCase().includes(process.env.BOT_ID.toLowerCase())
    );

    if (mentionsMe) {
      return {
        reply: `Hello ${message.sender}! I'm here.`,
        recipient: message.sender
      };
    }

    // Don't reply by default
    return null;
  }
});

// Get chat history
const history = bot.getChatHistory(50);
console.log(`Recent messages: ${history.length}`);
```

## API Reference

### BotBridgeClient

#### Constructor Options
```javascript
new BotBridgeClient({
  apiUrl: string,           // Bridge server URL (required)
  botId: string,            // Your bot ID (required)
  httpOnly: boolean,        // Skip WebSocket, use HTTP only (optional)
  wsClient: IWebSocketClient,  // Custom WebSocket client for testing (optional)
  httpClient: IHttpClient,      // Custom HTTP client for testing (optional)
  onMessage: function,       // Callback for incoming messages (optional)
  onConnectionChange: function,  // Callback for connection state (optional)
  onError: function         // Callback for errors (optional)
})
```

#### Methods

| Method | Returns | Description |
|--------|----------|-------------|
| `sendMessage(recipient, content, metadata?)` | Promise\<object\> | Send message to specific bot |
| `broadcast(content, metadata?)` | object | Broadcast to all connected bots |
| `healthCheck()` | Promise\<boolean\> | Check server health |
| `getStatus()` | Promise\<object\> | Get server status |
| `getConnectedBots()` | Promise\<object\> | List connected bots |
| `getUnreadMessages()` | Promise\<object\> | Get unread messages |
| `markAsRead(messageId)` | Promise\<object\> | Mark message as read |
| `replyTo(message, content, metadata?)` | Promise\<object\> | Reply to original message |
| `disconnect()` | void | Disconnect from server |

### ContextAwareBot

#### Constructor Options
```javascript
new ContextAwareBot({
  apiUrl: string,              // Bridge server URL (required)
  botId: string,               // Your bot ID (required)
  telegramBotToken: string,     // Telegram bot token (optional)
  telegramChatIds: string,      // Comma-separated chat IDs (optional)
  dbPath: string,              // SQLite database path (optional)
  bridge: BotBridgeClient,      // Custom bridge for testing (optional)
  db: IDatabaseClient,         // Custom database for testing (optional)
  onNewMessage: function,       // Callback for new messages (optional)
  onDecideReply: function,     // Context-aware reply logic (optional)
})
```

#### Methods

| Method | Returns | Description |
|--------|----------|-------------|
| `addMessage(message)` | Promise\<void\> | Add message to storage |
| `getChatHistory(limit?)` | array\<message\> | Get chat history |
| `sendMessage(recipient, content, metadata?)` | Promise\<object\> | Send via bridge |
| `broadcast(content, metadata?)` | object | Broadcast via bridge |
| `handleTelegramMessage(message)` | void | Process Telegram message |
| `disconnect()` | void | Disconnect from bridge |

## Testing

The library is designed for easy testing with dependency injection:

```javascript
const { BotBridgeClient } = require('bot-bridge/client');
const MockWebSocket = require('bot-bridge/tests/mocks/MockWebSocketClient');
const MockHttpClient = require('bot-bridge/tests/mocks/MockHttpClient');

// Create mock clients
const mockWs = new MockWebSocketClient();
const mockHttp = new MockHttpClient();

// Create bot with mocked dependencies
const client = new BotBridgeClient({
  apiUrl: 'http://localhost:3000',
  botId: 'test-bot',
  wsClient: mockWs,
  httpClient: mockHttp,
  httpOnly: true
});

// Now you can test without real WebSocket or HTTP connections!
mockWs.simulateReceiveMessage({
  type: 'message',
  sender: 'other-bot',
  content: 'Hello!'
});

// Check what was sent
console.log(mockWs.sentMessages);
```

## Examples

### Send a message when specific command is received

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const client = new BotBridgeClient({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: process.env.BOT_ID,
  onMessage: (message) => {
    if (message.content.startsWith('/ping')) {
      client.replyTo(message, 'Pong!');
    }
  }
});
```

### Coordinate multiple bots

```javascript
const { BotBridgeClient } = require('bot-bridge/client');

const bot1 = new BotBridgeClient({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: 'bot-1',
  onMessage: async (msg) => {
    if (msg.content === 'task:process') {
      // Do some work...
      await bot1.sendMessage('bot-2', 'task:complete');
    }
  }
});

const bot2 = new BotBridgeClient({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: 'bot-2',
  onMessage: (msg) => {
    if (msg.content === 'task:complete') {
      console.log('Task completed by bot-1');
    }
  }
});
```

### Use with Telegram groups

```javascript
const { ContextAwareBot } = require('bot-bridge/client');

const bot = new ContextAwareBot({
  apiUrl: process.env.BRIDGE_API_URL,
  botId: process.env.BOT_ID,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatIds: process.env.TELEGRAM_CHAT_IDS,

  onDecideReply: ({ message, context }) => {
    // Reply to @mentions in the group
    if (message.content.includes(`@${process.env.BOT_ID}`)) {
      return {
        reply: 'You called?',
        recipient: message.sender
      };
    }
    return null;
  }
});
```

## Server Installation

To run your own bridge server (instead of using a public one):

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USER/bot-bridge/master/install-server.sh | bash
```

This will install and start the bridge server on port 3000.

## Troubleshooting

### Connection fails

1. Check if server is running: `curl http://localhost:3000/health`
2. Verify `BRIDGE_API_URL` is correct
3. Check firewall settings

### Messages not received

1. Verify both bots are connected: `await client.getConnectedBots()`
2. Check bot IDs are correct
3. Look for error messages in logs

### Database errors

1. Ensure you have write permissions for `dbPath`
2. Check disk space
3. Try deleting the database file and letting it recreate

## Support

- **GitHub**: https://github.com/YOUR_USER/bot-bridge
- **Issues**: https://github.com/YOUR_USER/bot-bridge/issues
- **Documentation**: https://github.com/YOUR_USER/bot-bridge/wiki

## License

MIT
