"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketNotificationClient = void 0;
const vscode = __importStar(require("vscode"));
const ws_1 = __importDefault(require("ws"));
/**
 * WebSocket client for receiving real-time notifications from the MCP notification server
 *
 * Features:
 * - Automatic connection on extension activation
 * - Authentication with API key
 * - Automatic reconnection with exponential backoff
 * - Event batching to prevent excessive UI updates
 * - Graceful cleanup on extension deactivation
 */
class WebSocketNotificationClient {
    ws;
    reconnectTimer;
    reconnectAttempts = 0;
    maxReconnectDelay = 30000; // 30 seconds
    baseReconnectDelay = 1000; // 1 second
    isConnecting = false;
    isClosing = false;
    eventHandlers = new Map();
    eventBatchTimer;
    eventBatchQueue = [];
    batchWindow = 500; // 500ms batching window
    outputChannel;
    config;
    // Reliability features
    lastReceivedSequence = 0;
    processedSequences = new Set();
    maxProcessedSequences = 1000; // Limit memory usage
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Initialize and connect to the WebSocket server
     */
    async connect(config) {
        if (this.isConnecting || this.ws?.readyState === ws_1.default.OPEN) {
            this.outputChannel.appendLine('[WebSocket] Already connected or connecting');
            return;
        }
        this.config = config;
        this.isConnecting = true;
        this.isClosing = false;
        try {
            this.outputChannel.appendLine(`[WebSocket] Connecting to ${config.url}...`);
            // Only send Authorization header if API key is provided
            const headers = {};
            if (config.apiKey) {
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            }
            this.ws = new ws_1.default(config.url, {
                headers,
            });
            this.ws.on('open', () => this.handleOpen());
            this.ws.on('message', (data) => this.handleMessage(data));
            this.ws.on('error', (error) => this.handleError(error));
            this.ws.on('close', (code, reason) => this.handleClose(code, reason.toString()));
        }
        catch (error) {
            this.isConnecting = false;
            this.outputChannel.appendLine(`[WebSocket] Connection error: ${error}`);
            throw error;
        }
    }
    /**
     * Handle successful connection
     */
    handleOpen() {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.outputChannel.appendLine('[WebSocket] Connected successfully');
        vscode.window.showInformationMessage('Connected to notification server');
        // Request replay of missed events if this is a reconnection
        if (this.lastReceivedSequence > 0) {
            this.outputChannel.appendLine(`[WebSocket] Requesting replay since sequence ${this.lastReceivedSequence}`);
            this.requestReplay(this.lastReceivedSequence);
        }
        // Subscribe to project updates
        if (this.config?.projectNumbers && this.config.projectNumbers.length > 0) {
            this.subscribe(this.config.projectNumbers);
        }
    }
    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.outputChannel.appendLine(`[WebSocket] Received: ${JSON.stringify(message)}`);
            // Handle subscription confirmation
            if (message.type === 'subscribed') {
                this.outputChannel.appendLine(`[WebSocket] Subscribed to projects: ${message.projects?.join(', ')}`);
                return;
            }
            // Handle error messages
            if (message.type === 'error') {
                this.outputChannel.appendLine(`[WebSocket] Server error: ${message.message}`);
                return;
            }
            // Handle replay response
            if (message.type === 'replay') {
                this.handleReplayResponse(message.events || []);
                return;
            }
            // Handle events
            if (message.type === 'event' && message.event) {
                const event = {
                    type: message.event.type,
                    data: message.event.data,
                    timestamp: message.event.timestamp,
                    sequence: message.sequence,
                };
                this.processEvent(event);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`[WebSocket] Error parsing message: ${error}`);
        }
    }
    /**
     * Process a single event with deduplication and sequencing
     */
    processEvent(event) {
        // Check for duplicate (already processed)
        if (event.sequence && this.processedSequences.has(event.sequence)) {
            this.outputChannel.appendLine(`[WebSocket] Ignoring duplicate event sequence ${event.sequence}`);
            return;
        }
        // Detect sequence gap
        if (event.sequence) {
            if (this.lastReceivedSequence > 0 && event.sequence > this.lastReceivedSequence + 1) {
                const gap = event.sequence - this.lastReceivedSequence - 1;
                this.outputChannel.appendLine(`[WebSocket] Sequence gap detected! Expected ${this.lastReceivedSequence + 1}, got ${event.sequence} (gap of ${gap})`);
                // Request replay to fill the gap
                this.requestReplay(this.lastReceivedSequence);
            }
            // Update last received sequence
            this.lastReceivedSequence = event.sequence;
            // Track processed sequence (with memory limit)
            this.processedSequences.add(event.sequence);
            if (this.processedSequences.size > this.maxProcessedSequences) {
                // Remove oldest sequences (convert to array, sort, remove first 100)
                const sorted = Array.from(this.processedSequences).sort((a, b) => a - b);
                for (let i = 0; i < 100; i++) {
                    this.processedSequences.delete(sorted[i]);
                }
            }
            // Send acknowledgment
            this.sendAcknowledgment(event.sequence);
        }
        // Add to batch queue for processing
        this.eventBatchQueue.push(event);
        // Start or reset batch timer
        if (this.eventBatchTimer) {
            clearTimeout(this.eventBatchTimer);
        }
        this.eventBatchTimer = setTimeout(() => {
            this.processBatchedEvents();
        }, this.batchWindow);
    }
    /**
     * Handle replay response from server
     */
    handleReplayResponse(events) {
        if (events.length === 0) {
            this.outputChannel.appendLine('[WebSocket] Replay response: no missed events');
            return;
        }
        this.outputChannel.appendLine(`[WebSocket] Replay response: ${events.length} events`);
        // Process each replayed event
        for (const { event, sequence } of events) {
            const webSocketEvent = {
                type: event.type,
                data: event.data,
                timestamp: event.timestamp,
                sequence,
            };
            this.processEvent(webSocketEvent);
        }
    }
    /**
     * Process batched events to prevent excessive UI updates
     */
    processBatchedEvents() {
        if (this.eventBatchQueue.length === 0) {
            return;
        }
        this.outputChannel.appendLine(`[WebSocket] Processing ${this.eventBatchQueue.length} batched events`);
        // Group events by type for efficient processing
        const eventsByType = new Map();
        for (const event of this.eventBatchQueue) {
            const events = eventsByType.get(event.type) || [];
            events.push(event);
            eventsByType.set(event.type, events);
        }
        // Dispatch events to handlers
        for (const [type, events] of eventsByType) {
            const handlers = this.eventHandlers.get(type) || [];
            for (const handler of handlers) {
                for (const event of events) {
                    try {
                        handler(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`[WebSocket] Error in event handler: ${error}`);
                    }
                }
            }
            // Also call wildcard handlers
            const wildcardHandlers = this.eventHandlers.get('*') || [];
            for (const handler of wildcardHandlers) {
                for (const event of events) {
                    try {
                        handler(event);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`[WebSocket] Error in wildcard handler: ${error}`);
                    }
                }
            }
        }
        // Clear the batch queue
        this.eventBatchQueue = [];
    }
    /**
     * Handle WebSocket errors
     */
    handleError(error) {
        this.outputChannel.appendLine(`[WebSocket] Error: ${error.message}`);
    }
    /**
     * Handle connection close and attempt reconnection
     */
    handleClose(code, reason) {
        this.isConnecting = false;
        if (this.isClosing) {
            this.outputChannel.appendLine('[WebSocket] Connection closed gracefully');
            return;
        }
        this.outputChannel.appendLine(`[WebSocket] Connection closed (code: ${code}, reason: ${reason})`);
        vscode.window.showWarningMessage('Disconnected from notification server. Reconnecting...');
        // Attempt reconnection with exponential backoff
        this.scheduleReconnect();
    }
    /**
     * Schedule a reconnection attempt with exponential backoff
     */
    scheduleReconnect() {
        if (this.isClosing || !this.config) {
            return;
        }
        // Calculate delay with exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectAttempts++;
        this.outputChannel.appendLine(`[WebSocket] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);
        this.reconnectTimer = setTimeout(() => {
            if (!this.isClosing && this.config) {
                this.connect(this.config).catch(error => {
                    this.outputChannel.appendLine(`[WebSocket] Reconnection failed: ${error}`);
                });
            }
        }, delay);
    }
    /**
     * Subscribe to project updates
     */
    subscribe(projectNumbers) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.outputChannel.appendLine('[WebSocket] Cannot subscribe - not connected');
            return;
        }
        const message = {
            type: 'subscribe',
            projectNumbers,
        };
        this.ws.send(JSON.stringify(message));
        this.outputChannel.appendLine(`[WebSocket] Subscribing to projects: ${projectNumbers.join(', ')}`);
    }
    /**
     * Send acknowledgment for received event
     */
    sendAcknowledgment(sequence) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.outputChannel.appendLine(`[WebSocket] Cannot send ack for sequence ${sequence} - not connected`);
            return;
        }
        const message = {
            type: 'ack',
            sequence,
        };
        this.ws.send(JSON.stringify(message));
        this.outputChannel.appendLine(`[WebSocket] Sent ack for sequence ${sequence}`);
    }
    /**
     * Request replay of events since a specific sequence number
     */
    requestReplay(sinceSequence) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.outputChannel.appendLine(`[WebSocket] Cannot request replay - not connected`);
            return;
        }
        const message = {
            type: 'replay',
            sinceSequence,
        };
        this.ws.send(JSON.stringify(message));
        this.outputChannel.appendLine(`[WebSocket] Requested replay since sequence ${sinceSequence}`);
    }
    /**
     * Unsubscribe from project updates
     */
    unsubscribe(projectNumbers) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.outputChannel.appendLine('[WebSocket] Cannot unsubscribe - not connected');
            return;
        }
        const message = {
            type: 'unsubscribe',
            projects: projectNumbers,
        };
        this.ws.send(JSON.stringify(message));
        this.outputChannel.appendLine(`[WebSocket] Unsubscribing from projects: ${projectNumbers.join(', ')}`);
    }
    /**
     * Register an event handler
     * @param eventType Event type to listen for, or '*' for all events
     * @param handler Event handler callback
     */
    on(eventType, handler) {
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.push(handler);
        this.eventHandlers.set(eventType, handlers);
    }
    /**
     * Unregister an event handler
     */
    off(eventType, handler) {
        const handlers = this.eventHandlers.get(eventType) || [];
        const index = handlers.indexOf(handler);
        if (index >= 0) {
            handlers.splice(index, 1);
            this.eventHandlers.set(eventType, handlers);
        }
    }
    /**
     * Disconnect and cleanup
     */
    disconnect() {
        this.isClosing = true;
        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        // Clear batch timer
        if (this.eventBatchTimer) {
            clearTimeout(this.eventBatchTimer);
            this.eventBatchTimer = undefined;
        }
        // Process any pending batched events
        this.processBatchedEvents();
        // Close WebSocket connection
        if (this.ws) {
            if (this.ws.readyState === ws_1.default.OPEN || this.ws.readyState === ws_1.default.CONNECTING) {
                this.ws.close(1000, 'Extension deactivated');
            }
            this.ws = undefined;
        }
        // Clear reliability state (but preserve lastReceivedSequence for potential reconnection)
        this.processedSequences.clear();
        this.outputChannel.appendLine('[WebSocket] Disconnected');
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.ws?.readyState === ws_1.default.OPEN;
    }
    /**
     * Get connection state
     */
    getState() {
        if (!this.ws)
            return 'disconnected';
        switch (this.ws.readyState) {
            case ws_1.default.CONNECTING:
                return 'connecting';
            case ws_1.default.OPEN:
                return 'connected';
            case ws_1.default.CLOSING:
                return 'closing';
            case ws_1.default.CLOSED:
                return 'closed';
            default:
                return 'unknown';
        }
    }
}
exports.WebSocketNotificationClient = WebSocketNotificationClient;
//# sourceMappingURL=websocket-client.js.map