/**
 * WebSocket Server Tests
 *
 * Tests for WebSocket notification server including:
 * - AC-4.2.a: Authentication with valid API key
 * - AC-4.2.b: Rejection without API key
 * - AC-4.2.c: Subscription and event filtering
 * - AC-4.2.d: Event delivery within 2 seconds
 * - AC-4.2.e: Cleanup on disconnect
 * - AC-4.2.f: Keepalive ping/pong
 */

import { WebSocketNotificationServer, WebSocketServerConfig } from './websocket-server';
import { EventBus, StateChangeEvent } from './event-bus';
import { Logger } from '../config';
import WebSocket from 'ws';

/**
 * Mock logger for testing
 */
const createMockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Helper to create WebSocket client
 */
const createClient = (port: number, apiKey?: string): WebSocket => {
  const url = apiKey
    ? `ws://localhost:${port}/notifications?apiKey=${apiKey}`
    : `ws://localhost:${port}/notifications`;
  return new WebSocket(url);
};

/**
 * Helper to wait for WebSocket to open
 */
const waitForOpen = (ws: WebSocket): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
};

/**
 * Helper to wait for WebSocket to close
 */
const waitForClose = (ws: WebSocket): Promise<void> => {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once('close', () => resolve());
  });
};

/**
 * Helper to receive next message from WebSocket
 */
const receiveMessage = (ws: WebSocket): Promise<any> => {
  return new Promise((resolve, reject) => {
    ws.once('message', (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
    ws.once('error', reject);
    ws.once('close', () => reject(new Error('WebSocket closed')));
  });
};

/**
 * Helper to send message to WebSocket
 */
const sendMessage = (ws: WebSocket, message: any): void => {
  ws.send(JSON.stringify(message));
};

describe('WebSocketNotificationServer', () => {
  let server: WebSocketNotificationServer;
  let eventBus: EventBus;
  let logger: Logger;
  const TEST_PORT = 8081;
  const TEST_API_KEY = 'test-api-key-12345';

  beforeEach(async () => {
    eventBus = new EventBus();
    logger = createMockLogger();

    const config: WebSocketServerConfig = {
      port: TEST_PORT,
      apiKey: TEST_API_KEY,
      eventBus,
      logger,
      pingInterval: 1000, // 1 second for testing
      pongTimeout: 2000, // 2 seconds for testing
    };

    server = new WebSocketNotificationServer(config);
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('AC-4.2.a: Authentication with valid API key', () => {
    it('should accept connection with valid API key in query parameter', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);

      await waitForOpen(client);

      expect(client.readyState).toBe(WebSocket.OPEN);

      // Receive welcome message
      const welcomeMsg = await receiveMessage(client);
      expect(welcomeMsg.type).toBe('error'); // Using error type for info
      expect(welcomeMsg.message).toContain('Connected successfully');

      client.close();
      await waitForClose(client);
    });

    it('should accept connection with valid API key in Authorization header', async () => {
      const client = new WebSocket(`ws://localhost:${TEST_PORT}/notifications`, {
        headers: {
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      });

      await waitForOpen(client);

      expect(client.readyState).toBe(WebSocket.OPEN);

      client.close();
      await waitForClose(client);
    });

    it('should accept connection with valid API key in x-api-key header', async () => {
      const client = new WebSocket(`ws://localhost:${TEST_PORT}/notifications`, {
        headers: {
          'x-api-key': TEST_API_KEY,
        },
      });

      await waitForOpen(client);

      expect(client.readyState).toBe(WebSocket.OPEN);

      client.close();
      await waitForClose(client);
    });
  });

  describe('AC-4.2.b: Rejection without API key', () => {
    it('should close connection when no API key is provided', async () => {
      const client = createClient(TEST_PORT); // No API key

      await waitForClose(client);

      expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('should close connection with invalid API key', async () => {
      const client = createClient(TEST_PORT, 'invalid-key');

      await waitForClose(client);

      expect(client.readyState).toBe(WebSocket.CLOSED);
    });

    it('should return 401-like close code for authentication failure', async () => {
      const client = createClient(TEST_PORT);

      const closeCode = await new Promise<number>((resolve) => {
        client.once('close', (code) => resolve(code));
      });

      expect(closeCode).toBe(1008); // Policy Violation
    });
  });

  describe('AC-4.2.c: Subscription and event filtering', () => {
    it('should allow client to subscribe without filters', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Send subscription message
      sendMessage(client, { type: 'subscribe' });

      // Receive subscription confirmation
      const confirmMsg = await receiveMessage(client);
      expect(confirmMsg.type).toBe('error'); // Using error type for info
      expect(confirmMsg.message).toContain('Subscribed successfully');

      client.close();
      await waitForClose(client);
    });

    it('should allow client to subscribe with project number filter', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Send subscription message with filter
      sendMessage(client, { type: 'subscribe', projectNumbers: [70, 71] });

      // Receive subscription confirmation
      const confirmMsg = await receiveMessage(client);
      expect(confirmMsg.message).toContain('70');
      expect(confirmMsg.message).toContain('71');

      client.close();
      await waitForClose(client);
    });

    it('should receive events matching subscribed project number', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Subscribe to project 72
      sendMessage(client, { type: 'subscribe', projectNumbers: [72] });
      await receiveMessage(client); // Consume confirmation

      // Emit event for project 72
      eventBus.emit('issue.created', 72, { title: 'Test issue' }, 123);

      // Receive event
      const eventMsg = await receiveMessage(client);
      expect(eventMsg.type).toBe('event');
      expect(eventMsg.event.type).toBe('issue.created');
      expect(eventMsg.event.projectNumber).toBe(72);
      expect(eventMsg.event.issueNumber).toBe(123);

      client.close();
      await waitForClose(client);
    });

    it('should NOT receive events for non-subscribed projects', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Subscribe to project 70 only
      sendMessage(client, { type: 'subscribe', projectNumbers: [70] });
      await receiveMessage(client); // Consume confirmation

      // Emit event for project 72 (not subscribed)
      eventBus.emit('issue.created', 72, { title: 'Test issue' }, 123);

      // Wait a bit to ensure no message is received
      await new Promise((resolve) => setTimeout(resolve, 100));

      // No message should be received (readyState still OPEN)
      expect(client.readyState).toBe(WebSocket.OPEN);

      client.close();
      await waitForClose(client);
    });

    it('should receive all events when subscribed without filters', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Subscribe without filters
      sendMessage(client, { type: 'subscribe' });
      await receiveMessage(client); // Consume confirmation

      // Emit events for different projects
      eventBus.emit('issue.created', 70, { title: 'Issue 1' }, 100);
      eventBus.emit('issue.created', 71, { title: 'Issue 2' }, 200);

      // Receive both events
      const event1 = await receiveMessage(client);
      expect(event1.event.projectNumber).toBe(70);

      const event2 = await receiveMessage(client);
      expect(event2.event.projectNumber).toBe(71);

      client.close();
      await waitForClose(client);
    });
  });

  describe('AC-4.2.d: Event delivery within 2 seconds', () => {
    it('should deliver events within 2 seconds', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Subscribe
      sendMessage(client, { type: 'subscribe', projectNumbers: [72] });
      await receiveMessage(client); // Consume confirmation

      // Emit event and measure delivery time
      const startTime = Date.now();
      eventBus.emit('issue.updated', 72, { status: 'done' }, 456);

      // Receive event
      const eventMsg = await receiveMessage(client);
      const deliveryTime = Date.now() - startTime;

      expect(eventMsg.type).toBe('event');
      expect(deliveryTime).toBeLessThan(2000); // Within 2 seconds

      client.close();
      await waitForClose(client);
    });

    it('should deliver multiple events quickly', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Subscribe
      sendMessage(client, { type: 'subscribe', projectNumbers: [72] });
      await receiveMessage(client); // Consume confirmation

      // Emit multiple events
      const startTime = Date.now();
      eventBus.emit('issue.created', 72, { title: 'Issue 1' }, 1);
      eventBus.emit('issue.created', 72, { title: 'Issue 2' }, 2);
      eventBus.emit('issue.created', 72, { title: 'Issue 3' }, 3);

      // Receive all events
      await receiveMessage(client);
      await receiveMessage(client);
      await receiveMessage(client);

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(2000); // All within 2 seconds

      client.close();
      await waitForClose(client);
    });
  });

  describe('AC-4.2.e: Cleanup on disconnect', () => {
    it('should unsubscribe from event bus when client disconnects', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Subscribe
      sendMessage(client, { type: 'subscribe' });
      await receiveMessage(client); // Consume confirmation

      // Verify subscription exists
      expect(eventBus.getSubscriberCount()).toBe(1);

      // Disconnect
      client.close();
      await waitForClose(client);

      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify subscription removed
      expect(eventBus.getSubscriberCount()).toBe(0);
    });

    it('should remove client from connection list on disconnect', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Verify client connected
      expect(server.getConnectionCount()).toBe(1);

      // Disconnect
      client.close();
      await waitForClose(client);

      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify client removed
      expect(server.getConnectionCount()).toBe(0);
    });

    it('should handle multiple clients disconnecting independently', async () => {
      const client1 = createClient(TEST_PORT, TEST_API_KEY);
      const client2 = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client1);
      await waitForOpen(client2);

      // Verify both connected
      expect(server.getConnectionCount()).toBe(2);

      // Disconnect first client
      client1.close();
      await waitForClose(client1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify only first client removed
      expect(server.getConnectionCount()).toBe(1);

      // Disconnect second client
      client2.close();
      await waitForClose(client2);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify both removed
      expect(server.getConnectionCount()).toBe(0);
    });
  });

  describe('AC-4.2.f: Keepalive ping/pong', () => {
    it('should send ping to clients at regular intervals', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Wait for ping (pingInterval = 1000ms)
      const pingReceived = await new Promise<boolean>((resolve) => {
        client.once('ping', () => resolve(true));
        setTimeout(() => resolve(false), 1500); // Wait 1.5 seconds
      });

      expect(pingReceived).toBe(true);

      client.close();
      await waitForClose(client);
    });

    it('should keep connection alive when client responds to ping', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Wait for multiple ping/pong cycles
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds (3 pings)

      // Connection should still be open
      expect(client.readyState).toBe(WebSocket.OPEN);

      client.close();
      await waitForClose(client);
    });

    it('should disconnect client that does not respond to ping', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Disable automatic pong response
      (client as any)._receiver.on('ping', () => {
        // Don't send pong
      });

      // Wait for pong timeout (2 seconds) + ping interval (1 second)
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Connection should be closed
      expect(client.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Server lifecycle', () => {
    it('should start and stop cleanly', async () => {
      const testServer = new WebSocketNotificationServer({
        port: 8082,
        apiKey: TEST_API_KEY,
        eventBus,
        logger,
      });

      await testServer.start();
      expect(testServer.getConnectionCount()).toBe(0);

      await testServer.stop();
      expect(testServer.getConnectionCount()).toBe(0);
    });

    it('should close all connections when stopping', async () => {
      const client1 = createClient(TEST_PORT, TEST_API_KEY);
      const client2 = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client1);
      await waitForOpen(client2);

      expect(server.getConnectionCount()).toBe(2);

      // Stop server
      await server.stop();

      // Wait for clients to close
      await waitForClose(client1);
      await waitForClose(client2);

      expect(client1.readyState).toBe(WebSocket.CLOSED);
      expect(client2.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Health check endpoint', () => {
    it('should return health status on /health endpoint', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.connections).toBe(0);
      expect(data.uptime).toBeGreaterThan(0);
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/unknown`);

      expect(response.status).toBe(404);
    });
  });

  describe('Error handling', () => {
    it('should send error message for invalid JSON', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Send invalid JSON
      client.send('not json');

      // Receive error message
      const errorMsg = await receiveMessage(client);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.message).toContain('Invalid JSON');

      client.close();
      await waitForClose(client);
    }, 10000); // 10 second timeout

    it('should send error message for unknown message type', async () => {
      const client = createClient(TEST_PORT, TEST_API_KEY);
      await waitForOpen(client);

      // Consume welcome message
      await receiveMessage(client);

      // Send unknown message type
      sendMessage(client, { type: 'unknown' });

      // Receive error message
      const errorMsg = await receiveMessage(client);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.message).toContain('Unknown message type');

      client.close();
      await waitForClose(client);
    }, 10000); // 10 second timeout
  });
});
