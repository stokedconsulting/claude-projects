/**
 * WebSocket Server for Real-Time Notifications
 *
 * Provides persistent WebSocket connections for VSCode extension to receive
 * real-time state change notifications. Integrates with EventBus for event
 * distribution and supports project-based filtering.
 *
 * Authentication: Clients must provide API key in query parameter or header
 * Protocol: JSON messages over WebSocket
 * Keepalive: Ping/pong every 30 seconds
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { Server as HTTPServer, createServer } from 'http';
import { EventBus, StateChangeEvent } from './event-bus.js';
import { Logger } from '../config.js';
import { URL } from 'url';

/**
 * Client subscription message format
 */
interface SubscriptionMessage {
  type: 'subscribe';
  projectNumbers?: number[];
}

/**
 * Server event message format
 */
interface EventMessage {
  type: 'event';
  event: StateChangeEvent;
}

/**
 * Server error message format
 */
interface ErrorMessage {
  type: 'error';
  message: string;
}

/**
 * Client message types (received from client)
 */
type ClientMessage = SubscriptionMessage;

/**
 * Server message types (sent to client)
 */
type ServerMessage = EventMessage | ErrorMessage;

/**
 * WebSocket client connection state
 */
interface ClientConnection {
  /** WebSocket connection */
  ws: WebSocket;

  /** Unique client ID */
  id: string;

  /** Event bus subscriber ID (if subscribed) */
  subscriberId?: string;

  /** Project number filters (if any) */
  projectNumbers?: number[];

  /** Last ping timestamp */
  lastPing: number;

  /** Connection start time */
  connectedAt: string;

  /** Whether client is authenticated */
  authenticated: boolean;
}

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  /** Port to listen on */
  port: number;

  /** API key for client authentication */
  apiKey: string;

  /** Event bus instance for subscribing to events */
  eventBus: EventBus;

  /** Logger instance */
  logger: Logger;

  /** Path for WebSocket endpoint (default: /notifications) */
  path?: string;

  /** Ping interval in milliseconds (default: 30000) */
  pingInterval?: number;

  /** Pong timeout in milliseconds (default: 60000) */
  pongTimeout?: number;
}

/**
 * WebSocket Server for Real-Time Notifications
 *
 * Manages persistent WebSocket connections and forwards state change events
 * from the EventBus to connected clients. Handles authentication, subscription
 * management, and keepalive.
 */
export class WebSocketNotificationServer {
  private wss: WebSocketServer;
  private httpServer: HTTPServer;
  private config: WebSocketServerConfig;
  private clients: Map<string, ClientConnection>;
  private pingIntervalHandle?: NodeJS.Timeout;
  private logger: Logger;
  private eventBus: EventBus;

  constructor(config: WebSocketServerConfig) {
    this.config = {
      path: '/notifications',
      pingInterval: 30000, // 30 seconds
      pongTimeout: 60000, // 60 seconds
      ...config,
    };
    this.logger = config.logger;
    this.eventBus = config.eventBus;
    this.clients = new Map();

    // Create HTTP server
    this.httpServer = createServer((req, res) => {
      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          connections: this.clients.size,
          uptime: process.uptime(),
        }));
        return;
      }

      // All other requests return 404
      res.writeHead(404);
      res.end('Not found');
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: this.config.path,
    });

    this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket connection and message handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();

    this.logger.info(`New WebSocket connection attempt: ${clientId}`);

    // Authenticate client
    const apiKey = this.extractApiKey(req);
    if (!apiKey || apiKey !== this.config.apiKey) {
      this.logger.warn(`Authentication failed for client ${clientId}`);
      this.sendError(ws, 'Authentication failed: invalid or missing API key');
      ws.close(1008, 'Authentication required'); // 1008 = Policy Violation
      return;
    }

    // Create client connection
    const client: ClientConnection = {
      ws,
      id: clientId,
      lastPing: Date.now(),
      connectedAt: new Date().toISOString(),
      authenticated: true,
    };

    this.clients.set(clientId, client);
    this.logger.info(`Client ${clientId} authenticated and connected`);

    // Setup WebSocket event handlers
    ws.on('message', (data: RawData) => {
      this.handleMessage(client, data);
    });

    ws.on('pong', () => {
      this.handlePong(client);
    });

    ws.on('close', () => {
      this.handleDisconnect(client);
    });

    ws.on('error', (error) => {
      this.logger.error(`Client ${clientId} error:`, error);
      this.handleDisconnect(client);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'error', // Using error type for info messages
      message: 'Connected successfully. Send subscribe message to receive events.',
    });
  }

  /**
   * Extract API key from request (query parameter or header)
   */
  private extractApiKey(req: any): string | null {
    // Try query parameter first
    if (req.url) {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const apiKey = url.searchParams.get('apiKey');
        if (apiKey) {
          return apiKey;
        }
      } catch (error) {
        this.logger.warn('Failed to parse URL for API key:', error);
      }
    }

    // Try authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try x-api-key header
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    return null;
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: ClientConnection, data: RawData): void {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      if (message.type === 'subscribe') {
        this.handleSubscribe(client, message);
      } else {
        this.sendError(client.ws, `Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse message from client ${client.id}:`, error);
      this.sendError(client.ws, 'Invalid JSON message format');
    }
  }

  /**
   * Handle subscription message
   */
  private handleSubscribe(client: ClientConnection, message: SubscriptionMessage): void {
    // Unsubscribe from previous subscription if exists
    if (client.subscriberId) {
      this.eventBus.unsubscribe(client.subscriberId);
      this.logger.info(`Client ${client.id} unsubscribed from previous subscription`);
    }

    // Store project filters
    client.projectNumbers = message.projectNumbers;

    // Subscribe to event bus
    client.subscriberId = this.eventBus.subscribe(
      (event: StateChangeEvent) => {
        this.forwardEvent(client, event);
      },
      {}
    );

    this.logger.info(
      `Client ${client.id} subscribed with filters: ${JSON.stringify({ projectNumbers: message.projectNumbers })}`
    );

    // Send confirmation
    this.sendMessage(client.ws, {
      type: 'error', // Using error type for info messages
      message: `Subscribed successfully. Filters: ${JSON.stringify({ projectNumbers: message.projectNumbers || 'all' })}`,
    });
  }

  /**
   * Forward event to client (with filtering)
   */
  private forwardEvent(client: ClientConnection, event: StateChangeEvent): void {
    // Apply client-side project number filter if specified
    if (client.projectNumbers && client.projectNumbers.length > 0) {
      if (!client.projectNumbers.includes(event.projectNumber)) {
        return; // Skip event - doesn't match client filter
      }
    }

    // Send event to client
    this.sendMessage(client.ws, {
      type: 'event',
      event,
    });
  }

  /**
   * Handle pong response from client
   */
  private handlePong(client: ClientConnection): void {
    client.lastPing = Date.now();
    this.logger.debug(`Client ${client.id} responded to ping`);
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: ClientConnection): void {
    // Unsubscribe from event bus
    if (client.subscriberId) {
      this.eventBus.unsubscribe(client.subscriberId);
    }

    // Remove from clients map
    this.clients.delete(client.id);

    this.logger.info(`Client ${client.id} disconnected`);
  }

  /**
   * Send message to client
   */
  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      message: error,
    });
  }

  /**
   * Start keepalive ping interval
   */
  private startKeepalive(): void {
    this.pingIntervalHandle = setInterval(() => {
      const now = Date.now();
      const pongTimeout = this.config.pongTimeout!;

      this.clients.forEach((client) => {
        // Check if client has timed out
        if (now - client.lastPing > pongTimeout) {
          this.logger.warn(`Client ${client.id} timed out (no pong in ${pongTimeout}ms)`);
          client.ws.terminate();
          this.handleDisconnect(client);
          return;
        }

        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.config.pingInterval!);
  }

  /**
   * Stop keepalive ping interval
   */
  private stopKeepalive(): void {
    if (this.pingIntervalHandle) {
      clearInterval(this.pingIntervalHandle);
      this.pingIntervalHandle = undefined;
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Start the WebSocket server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer.listen(this.config.port, () => {
          this.logger.info(`WebSocket server listening on port ${this.config.port}`);
          this.logger.info(`WebSocket path: ${this.config.path}`);
          this.logger.info(`Health check: http://localhost:${this.config.port}/health`);

          // Start keepalive
          this.startKeepalive();

          resolve();
        });

        this.httpServer.on('error', (error) => {
          this.logger.error('HTTP server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    this.logger.info('Shutting down WebSocket server...');

    // Stop keepalive
    this.stopKeepalive();

    // Close all client connections
    this.clients.forEach((client) => {
      client.ws.close(1001, 'Server shutting down'); // 1001 = Going Away
      this.handleDisconnect(client);
    });

    // Close WebSocket server
    return new Promise((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          this.logger.error('Error closing WebSocket server:', error);
          reject(error);
          return;
        }

        // Close HTTP server
        this.httpServer.close((error) => {
          if (error) {
            this.logger.error('Error closing HTTP server:', error);
            reject(error);
            return;
          }

          this.logger.info('WebSocket server stopped');
          resolve();
        });
      });
    });
  }

  /**
   * Get current connection count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get all client connections (for testing/debugging)
   */
  getClients(): Array<Omit<ClientConnection, 'ws'>> {
    return Array.from(this.clients.values()).map(({ id, subscriberId, projectNumbers, lastPing, connectedAt, authenticated }) => ({
      id,
      subscriberId,
      projectNumbers,
      lastPing,
      connectedAt,
      authenticated,
    }));
  }
}
