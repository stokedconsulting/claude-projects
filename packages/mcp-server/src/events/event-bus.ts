/**
 * Event Bus for Real-Time Notifications
 *
 * Implements EventEmitter pattern for broadcasting state change notifications
 * to connected clients. Supports event filtering by project number and
 * handles subscriber lifecycle management.
 */

import { EventEmitter } from 'events';

/**
 * Valid event types for state change notifications
 */
export type EventType =
  | 'project.updated'
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'phase.updated';

/**
 * State change event payload
 */
export interface StateChangeEvent {
  /** Event type (project.updated, issue.created, etc.) */
  type: EventType;

  /** ISO 8601 timestamp when event occurred */
  timestamp: string;

  /** GitHub Project number */
  projectNumber: number;

  /** GitHub issue number (optional, issue-specific events only) */
  issueNumber?: number;

  /** Type-specific payload data */
  data: unknown;
}

/**
 * Subscription options for filtering events
 */
export interface SubscriptionOptions {
  /** Filter events by project number (optional) */
  projectNumber?: number;

  /** Filter events by type (optional) */
  eventTypes?: EventType[];
}

/**
 * Event handler callback function
 */
export type EventHandler = (event: StateChangeEvent) => void | Promise<void>;

/**
 * Subscriber metadata
 */
interface Subscriber {
  /** Unique subscriber ID */
  id: string;

  /** Event handler callback */
  handler: EventHandler;

  /** Subscription filtering options */
  options: SubscriptionOptions;

  /** Timestamp when subscriber was added */
  subscribedAt: string;
}

/**
 * Event Bus for broadcasting state change notifications
 *
 * Implements in-memory event bus using Node.js EventEmitter.
 * Supports subscribe/unsubscribe/emit operations with event filtering.
 * Designed for 100+ concurrent subscribers with <100ms event delivery.
 */
export class EventBus {
  private readonly emitter: EventEmitter;
  private readonly subscribers: Map<string, Subscriber>;
  private eventCount: number = 0;

  constructor() {
    this.emitter = new EventEmitter();
    this.subscribers = new Map();

    // Increase max listeners to support 100+ concurrent subscribers
    // Default is 10, set to 500 to support growth beyond requirements
    this.emitter.setMaxListeners(500);
  }

  /**
   * Subscribe to state change events
   *
   * Adds a new subscriber with optional filtering by project number and event types.
   * Returns a unique subscriber ID for later unsubscribe.
   *
   * @param handler - Callback function to receive events
   * @param options - Optional filtering by project number and/or event types
   * @returns Unique subscriber ID (UUID-like string)
   *
   * @example
   * ```typescript
   * const subscriberId = eventBus.subscribe(
   *   (event) => console.log('Event received:', event),
   *   { projectNumber: 72 }
   * );
   * ```
   */
  subscribe(handler: EventHandler, options: SubscriptionOptions = {}): string {
    // Generate unique subscriber ID (timestamp + random)
    const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create subscriber metadata
    const subscriber: Subscriber = {
      id: subscriberId,
      handler,
      options,
      subscribedAt: new Date().toISOString(),
    };

    // Store subscriber
    this.subscribers.set(subscriberId, subscriber);

    // Create wrapped handler with filtering logic
    const wrappedHandler = async (event: StateChangeEvent) => {
      // Apply project number filter
      if (options.projectNumber !== undefined && event.projectNumber !== options.projectNumber) {
        return; // Skip event - doesn't match filter
      }

      // Apply event type filter
      if (options.eventTypes && !options.eventTypes.includes(event.type)) {
        return; // Skip event - doesn't match filter
      }

      // Invoke handler with error isolation
      try {
        await handler(event);
      } catch (error) {
        // Log error but don't propagate to other subscribers
        this.logError(`Subscriber ${subscriberId} handler error:`, error);
      }
    };

    // Register handler with EventEmitter (use internal event name)
    this.emitter.on('state_change', wrappedHandler);

    // Store wrapped handler for cleanup during unsubscribe
    (subscriber as any).wrappedHandler = wrappedHandler;

    this.log(`Subscriber ${subscriberId} added (filters: ${JSON.stringify(options)})`);

    return subscriberId;
  }

  /**
   * Unsubscribe from state change events
   *
   * Removes a subscriber by ID. Safe to call multiple times.
   *
   * @param subscriberId - Subscriber ID returned from subscribe()
   * @returns True if subscriber was found and removed, false otherwise
   *
   * @example
   * ```typescript
   * const success = eventBus.unsubscribe(subscriberId);
   * ```
   */
  unsubscribe(subscriberId: string): boolean {
    const subscriber = this.subscribers.get(subscriberId);

    if (!subscriber) {
      this.log(`Unsubscribe failed: subscriber ${subscriberId} not found`);
      return false;
    }

    // Remove EventEmitter listener
    const wrappedHandler = (subscriber as any).wrappedHandler;
    if (wrappedHandler) {
      this.emitter.off('state_change', wrappedHandler);
    }

    // Remove from subscribers map
    this.subscribers.delete(subscriberId);

    this.log(`Subscriber ${subscriberId} removed`);

    return true;
  }

  /**
   * Emit a state change event to all subscribers
   *
   * Broadcasts event to all active subscribers. Subscribers with filters
   * that don't match the event will not receive it.
   *
   * Events are delivered asynchronously with error isolation - if one
   * subscriber's handler fails, others continue to receive the event.
   *
   * @param type - Event type (project.updated, issue.created, etc.)
   * @param projectNumber - GitHub Project number
   * @param data - Type-specific payload data
   * @param issueNumber - GitHub issue number (optional, for issue events)
   *
   * @example
   * ```typescript
   * eventBus.emit('issue.created', 72, { title: 'New issue', status: 'todo' }, 123);
   * ```
   */
  emit(
    type: EventType,
    projectNumber: number,
    data: unknown,
    issueNumber?: number
  ): void {
    // Create event payload
    const event: StateChangeEvent = {
      type,
      timestamp: new Date().toISOString(),
      projectNumber,
      issueNumber,
      data,
    };

    // Increment event counter for stats
    this.eventCount++;

    // Log event emission
    this.log(
      `Emitting event: ${type} (project: ${projectNumber}, issue: ${issueNumber || 'N/A'}) to ${this.subscribers.size} subscribers`
    );

    // Emit to EventEmitter (all wrapped handlers will be invoked)
    this.emitter.emit('state_change', event);
  }

  /**
   * Get current subscriber count
   *
   * @returns Number of active subscribers
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get subscriber details (for testing/debugging)
   *
   * @returns Array of subscriber metadata (without handler functions)
   */
  getSubscribers(): Array<Omit<Subscriber, 'handler'>> {
    return Array.from(this.subscribers.values()).map(({ id, options, subscribedAt }) => ({
      id,
      options,
      subscribedAt,
    }));
  }

  /**
   * Get total event count (for testing/debugging)
   *
   * @returns Total number of events emitted since creation
   */
  getEventCount(): number {
    return this.eventCount;
  }

  /**
   * Clear all subscribers (for testing/cleanup)
   */
  clearAllSubscribers(): void {
    // Remove all EventEmitter listeners
    this.emitter.removeAllListeners('state_change');

    // Clear subscribers map
    this.subscribers.clear();

    this.log('All subscribers cleared');
  }

  /**
   * Log message to stderr (don't pollute stdout for MCP)
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [EventBus] ${message}`);
  }

  /**
   * Log error to stderr
   */
  private logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [EventBus] ERROR: ${message}`, error);
  }
}

/**
 * Singleton event bus instance
 *
 * Use this shared instance across the application to ensure
 * all components use the same event bus.
 */
export const eventBus = new EventBus();
