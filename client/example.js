/**
 * Bot Bridge Client Example
 *
 * This example shows how to use the refactored BotBridgeClient and ContextAwareBot
 * with dependency injection support.
 */

const { BotBridgeClient } = require('./BotBridgeClient');
const { ContextAwareBot } = require('./ContextAwareClient');

// Example 1: Basic BotBridgeClient usage
function basicClientExample() {
  console.log('\n=== Example 1: Basic BotBridgeClient ===\n');

  const client = new BotBridgeClient({
    apiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3000',
    botId: process.env.BOT_ID || 'example-bot',
    onConnectionChange: (connected) => {
      console.log(`Connection status: ${connected ? 'Connected' : 'Disconnected'}`);
    },
    onMessage: (message) => {
      console.log(`Received message:`, message);
    },
    onError: (error) => {
      console.error(`Error: ${error}`);
    }
  });

  // Send a message
  client.sendMessage('recipient-bot', 'Hello from example!')
    .then(result => {
      console.log('Send result:', result);
    });

  // Check health
  client.healthCheck().then(healthy => {
    console.log('Server healthy:', healthy);
  });

  // Get connected bots
  client.getConnectedBots().then(result => {
    console.log('Connected bots:', result);
  });

  // Get unread messages
  client.getUnreadMessages().then(result => {
    console.log('Unread messages:', result);
  });

  // Disconnect after 5 seconds
  setTimeout(() => {
    client.disconnect();
    console.log('\nClient disconnected');
  }, 5000);
}

// Example 2: ContextAwareBot with SQLite persistence
function contextAwareExample() {
  console.log('\n=== Example 2: ContextAwareBot ===\n');

  const bot = new ContextAwareBot({
    apiUrl: process.env.BRIDGE_API_URL || 'http://localhost:3000',
    botId: process.env.BOT_ID || 'context-bot',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatIds: process.env.TELEGRAM_CHAT_IDS,
    dbPath: './bot-messages.db',

    // Called when new message arrives
    onNewMessage: (message) => {
      console.log(`New message from ${message.sender}: ${message.content}`);
    },

    // Decide whether/how to reply based on context
    onDecideReply: ({ message, context }) => {
      console.log(`Deciding reply for message: ${message.content}`);
      console.log(`Context has ${context.length} messages`);

      // Example: Reply to messages containing "hello"
      if (message.content.toLowerCase().includes('hello')) {
        return {
          reply: 'Hi there! How can I help you?',
          recipient: message.sender
        };
      }

      return null; // Don't reply
    }
  });

  // Get chat history
  setTimeout(() => {
    const history = bot.getChatHistory(10);
    console.log('\nChat history (last 10):');
    history.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.source}] ${msg.sender}: ${msg.content}`);
    });
  }, 2000);

  // Disconnect after 10 seconds
  setTimeout(() => {
    bot.disconnect();
    console.log('\nBot disconnected');
  }, 10000);
}

// Example 3: Using dependency injection for testing
function dependencyInjectionExample() {
  console.log('\n=== Example 3: Dependency Injection ===\n');

  // You can inject custom implementations for WebSocket, HTTP, and Database
  const MockWebSocket = require('../tests/mocks/MockWebSocketClient');
  const MockHttpClient = require('../tests/mocks/MockHttpClient');
  const MockDatabase = require('../tests/mocks/MockDatabaseClient');

  const mockWs = new MockWebSocket();
  const mockHttp = new MockHttpClient();
  const mockDb = new MockDatabase();

  const client = new BotBridgeClient({
    apiUrl: 'http://localhost:3000',
    botId: 'mock-bot',
    wsClient: mockWs,
    httpClient: mockHttp,
    httpOnly: true // Don't try to connect to real WebSocket
  });

  console.log('Created client with mock dependencies');

  // Send a message (will be recorded in mock, not actually sent)
  client.sendMessage('recipient', 'Test message')
    .then(result => {
      console.log('Mock send result:', result);
    });
}

// Main entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const example = args[0] || 'basic';

  switch (example) {
    case 'basic':
      basicClientExample();
      break;
    case 'context':
      contextAwareExample();
      break;
    case 'mock':
      dependencyInjectionExample();
      break;
    default:
      console.log('Usage: node example.js [basic|context|mock]');
      console.log('\nAvailable examples:');
      console.log('  basic   - Basic BotBridgeClient usage');
      console.log('  context - ContextAwareBot with persistence');
      console.log('  mock    - Dependency injection for testing');
  }
}

module.exports = {
  basicClientExample,
  contextAwareExample,
  dependencyInjectionExample
};
