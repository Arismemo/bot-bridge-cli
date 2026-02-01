/**
 * Bot Bridge Client - Backward Compatibility Layer
 *
 * This file maintains backward compatibility with the old client/index.js API.
 * New code should use client/BotBridgeClient.js and client/ContextAwareClient.js directly.
 */

const { BotBridgeClient } = require('./BotBridgeClient');
const { ContextAwareBot } = require('./ContextAwareClient');

// Export for backward compatibility
module.exports = {
  BotBridgeClient,
  ContextAwareBot
};
