const WebSocket = require('ws');
const { BotBridgeClient } = require('../client/index');

describe('BotBridgeClient', () => {
  let wsServer;
  let client;
  const WS_PORT = 8080;
  const API_URL = `http://localhost:${WS_PORT}`;
  const WS_URL = `ws://localhost:${WS_PORT}`;

  beforeEach((done) => {
    wsServer = new WebSocket.Server({ port: WS_PORT });
    wsServer.on('connection', ws => {
      // Simulate server acknowledging connection
      ws.send(JSON.stringify({ type: 'connected' }));
    });
    // Wait for the server to be ready
    wsServer.on('listening', () => done());
  });

  afterEach((done) => {
    if (client) {
      client.disconnect();
    }
    if (wsServer) {
      wsServer.close(() => done());
    } else {
      done();
    }
  });

  test('should connect to the WebSocket server', (done) => {
    client = new BotBridgeClient({
      apiUrl: API_URL,
      onConnectionChange: (connected) => {
        if (connected) {
          expect(client.connected).toBe(true);
          done();
        }
      }
    });
  });

  test('should call onConnectionChange with false on disconnection', (done) => {
    client = new BotBridgeClient({
      apiUrl: API_URL,
      onConnectionChange: (connected) => {
        if (connected) {
          // Connected, now disconnect
          client.ws.close();
        } else if (client.connected === false) { // After disconnection
          expect(client.connected).toBe(false);
          done();
        }
      }
    });
  });
});
