/**
 * Event Bus Tests
 *
 * Comprehensive test suite covering all acceptance criteria:
 * - AC-4.1.a: Event emission with correct type and payload
 * - AC-4.1.b: Client subscription
 * - AC-4.1.c: Client unsubscription
 * - AC-4.1.d: Event delivery to all subscribers within 100ms
 * - AC-4.1.e: Error isolation - failed subscriber doesn't affect others
 */

import { EventBus, EventType, StateChangeEvent } from './event-bus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clearAllSubscribers();
  });

  describe('AC-4.1.b: Client subscription', () => {
    it('should add subscriber to subscriber list', () => {
      const handler = jest.fn();

      const subscriberId = eventBus.subscribe(handler);

      expect(subscriberId).toBeTruthy();
      expect(subscriberId).toMatch(/^sub_\d+_[a-z0-9]+$/);
      expect(eventBus.getSubscriberCount()).toBe(1);
    });

    it('should support multiple subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);
      eventBus.subscribe(handler3);

      expect(eventBus.getSubscriberCount()).toBe(3);
    });

    it('should store subscription options', () => {
      const handler = jest.fn();
      const options = { projectNumber: 72 };

      const subscriberId = eventBus.subscribe(handler, options);

      const subscribers = eventBus.getSubscribers();
      const subscriber = subscribers.find(s => s.id === subscriberId);

      expect(subscriber).toBeDefined();
      expect(subscriber?.options).toEqual(options);
    });

    it('should generate unique subscriber IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const subscriberId = eventBus.subscribe(jest.fn());
        ids.add(subscriberId);
      }

      expect(ids.size).toBe(10); // All IDs should be unique
    });

    it('should support 100+ concurrent subscribers', () => {
      const handlers = Array.from({ length: 150 }, () => jest.fn());

      handlers.forEach(handler => {
        eventBus.subscribe(handler);
      });

      expect(eventBus.getSubscriberCount()).toBe(150);
    });

    it('should store subscribedAt timestamp', () => {
      const handler = jest.fn();
      const beforeSubscribe = new Date().toISOString();

      const subscriberId = eventBus.subscribe(handler);

      const afterSubscribe = new Date().toISOString();
      const subscribers = eventBus.getSubscribers();
      const subscriber = subscribers.find(s => s.id === subscriberId);

      expect(subscriber?.subscribedAt).toBeTruthy();
      expect(subscriber?.subscribedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Timestamp should be between before and after
      expect(subscriber!.subscribedAt >= beforeSubscribe).toBe(true);
      expect(subscriber!.subscribedAt <= afterSubscribe).toBe(true);
    });
  });

  describe('AC-4.1.c: Client unsubscription', () => {
    it('should remove subscriber from subscriber list', () => {
      const handler = jest.fn();
      const subscriberId = eventBus.subscribe(handler);

      expect(eventBus.getSubscriberCount()).toBe(1);

      const result = eventBus.unsubscribe(subscriberId);

      expect(result).toBe(true);
      expect(eventBus.getSubscriberCount()).toBe(0);
    });

    it('should return false when unsubscribing non-existent subscriber', () => {
      const result = eventBus.unsubscribe('non_existent_id');

      expect(result).toBe(false);
    });

    it('should be safe to unsubscribe multiple times', () => {
      const handler = jest.fn();
      const subscriberId = eventBus.subscribe(handler);

      const result1 = eventBus.unsubscribe(subscriberId);
      const result2 = eventBus.unsubscribe(subscriberId);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(eventBus.getSubscriberCount()).toBe(0);
    });

    it('should not affect other subscribers when one unsubscribes', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      const id1 = eventBus.subscribe(handler1);
      const id2 = eventBus.subscribe(handler2);
      const id3 = eventBus.subscribe(handler3);

      expect(eventBus.getSubscriberCount()).toBe(3);

      eventBus.unsubscribe(id2);

      expect(eventBus.getSubscriberCount()).toBe(2);

      // Emit event and verify remaining subscribers receive it
      eventBus.emit('issue.created', 72, { title: 'Test' }, 123);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled(); // Unsubscribed
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC-4.1.a: Event emission with correct type and payload', () => {
    it('should emit event with correct type', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      eventBus.emit('issue.created', 72, { title: 'Test Issue' }, 123);

      expect(handler).toHaveBeenCalledTimes(1);
      const event: StateChangeEvent = handler.mock.calls[0][0];
      expect(event.type).toBe('issue.created');
    });

    it('should emit event with correct projectNumber', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      eventBus.emit('issue.created', 72, { title: 'Test Issue' }, 123);

      const event: StateChangeEvent = handler.mock.calls[0][0];
      expect(event.projectNumber).toBe(72);
    });

    it('should emit event with correct issueNumber', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      eventBus.emit('issue.created', 72, { title: 'Test Issue' }, 123);

      const event: StateChangeEvent = handler.mock.calls[0][0];
      expect(event.issueNumber).toBe(123);
    });

    it('should emit event with issueNumber undefined for non-issue events', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      eventBus.emit('project.updated', 72, { name: 'Updated Project' });

      const event: StateChangeEvent = handler.mock.calls[0][0];
      expect(event.issueNumber).toBeUndefined();
    });

    it('should emit event with correct data payload', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      const payload = { title: 'Test Issue', status: 'todo', labels: ['bug'] };
      eventBus.emit('issue.created', 72, payload, 123);

      const event: StateChangeEvent = handler.mock.calls[0][0];
      expect(event.data).toEqual(payload);
    });

    it('should emit event with ISO 8601 timestamp', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      const beforeEmit = new Date().toISOString();
      eventBus.emit('issue.created', 72, { title: 'Test' }, 123);
      const afterEmit = new Date().toISOString();

      const event: StateChangeEvent = handler.mock.calls[0][0];
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Timestamp should be between before and after
      expect(event.timestamp >= beforeEmit).toBe(true);
      expect(event.timestamp <= afterEmit).toBe(true);
    });

    it('should support all event types', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      const eventTypes: EventType[] = [
        'project.updated',
        'issue.created',
        'issue.updated',
        'issue.deleted',
        'phase.updated',
      ];

      eventTypes.forEach(type => {
        eventBus.emit(type, 72, { test: 'data' }, 123);
      });

      expect(handler).toHaveBeenCalledTimes(eventTypes.length);

      const receivedTypes = handler.mock.calls.map(call => call[0].type);
      expect(receivedTypes).toEqual(eventTypes);
    });

    it('should increment event count', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      expect(eventBus.getEventCount()).toBe(0);

      eventBus.emit('issue.created', 72, {}, 123);
      expect(eventBus.getEventCount()).toBe(1);

      eventBus.emit('issue.updated', 72, {}, 123);
      expect(eventBus.getEventCount()).toBe(2);

      eventBus.emit('project.updated', 72, {});
      expect(eventBus.getEventCount()).toBe(3);
    });
  });

  describe('AC-4.1.d: Event delivery to all subscribers within 100ms', () => {
    it('should deliver event to all active subscribers', () => {
      const handlers = Array.from({ length: 10 }, () => jest.fn());

      handlers.forEach(handler => {
        eventBus.subscribe(handler);
      });

      eventBus.emit('issue.created', 72, { title: 'Test' }, 123);

      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should deliver event within 100ms to 100+ subscribers', async () => {
      const handlers = Array.from({ length: 150 }, () => jest.fn());

      handlers.forEach(handler => {
        eventBus.subscribe(handler);
      });

      const startTime = Date.now();
      eventBus.emit('issue.created', 72, { title: 'Performance Test' }, 123);

      // Wait a tick to ensure all async handlers complete
      await new Promise(resolve => setImmediate(resolve));

      const endTime = Date.now();
      const deliveryTime = endTime - startTime;

      // Verify all handlers were called
      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      // Verify delivery time is under 100ms
      expect(deliveryTime).toBeLessThan(100);
    });

    it('should filter events by projectNumber', () => {
      const handler72 = jest.fn();
      const handler99 = jest.fn();
      const handlerAll = jest.fn();

      eventBus.subscribe(handler72, { projectNumber: 72 });
      eventBus.subscribe(handler99, { projectNumber: 99 });
      eventBus.subscribe(handlerAll); // No filter

      eventBus.emit('issue.created', 72, { title: 'Project 72 Issue' }, 123);
      eventBus.emit('issue.created', 99, { title: 'Project 99 Issue' }, 456);

      expect(handler72).toHaveBeenCalledTimes(1);
      expect(handler99).toHaveBeenCalledTimes(1);
      expect(handlerAll).toHaveBeenCalledTimes(2);

      // Verify correct project numbers
      expect(handler72.mock.calls[0][0].projectNumber).toBe(72);
      expect(handler99.mock.calls[0][0].projectNumber).toBe(99);
    });

    it('should filter events by event type', () => {
      const createHandler = jest.fn();
      const updateHandler = jest.fn();

      eventBus.subscribe(createHandler, { eventTypes: ['issue.created'] });
      eventBus.subscribe(updateHandler, { eventTypes: ['issue.updated', 'issue.deleted'] });

      eventBus.emit('issue.created', 72, {}, 123);
      eventBus.emit('issue.updated', 72, {}, 123);
      eventBus.emit('issue.deleted', 72, {}, 123);
      eventBus.emit('project.updated', 72, {});

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(updateHandler).toHaveBeenCalledTimes(2);

      expect(createHandler.mock.calls[0][0].type).toBe('issue.created');
      expect(updateHandler.mock.calls[0][0].type).toBe('issue.updated');
      expect(updateHandler.mock.calls[1][0].type).toBe('issue.deleted');
    });

    it('should filter events by both projectNumber and event type', () => {
      const handler = jest.fn();

      eventBus.subscribe(handler, {
        projectNumber: 72,
        eventTypes: ['issue.created', 'issue.updated'],
      });

      // Matches both filters
      eventBus.emit('issue.created', 72, {}, 123);

      // Matches project but not type
      eventBus.emit('issue.deleted', 72, {}, 123);

      // Matches type but not project
      eventBus.emit('issue.created', 99, {}, 456);

      // Matches neither
      eventBus.emit('project.updated', 99, {});

      // Should only receive the first event
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].projectNumber).toBe(72);
      expect(handler.mock.calls[0][0].type).toBe('issue.created');
    });
  });

  describe('AC-4.1.e: Error isolation - failed subscriber doesn\'t affect others', () => {
    it('should continue delivering to other subscribers when one handler fails', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn(() => {
        throw new Error('Handler 2 error');
      });
      const handler3 = jest.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);
      eventBus.subscribe(handler3);

      eventBus.emit('issue.created', 72, { title: 'Test' }, 123);

      // Wait a tick to ensure all async handlers complete
      await new Promise(resolve => setImmediate(resolve));

      // All handlers should be called despite handler2 throwing
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should continue delivering to other subscribers when async handler fails', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn(async () => {
        throw new Error('Async handler error');
      });
      const handler3 = jest.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);
      eventBus.subscribe(handler3);

      eventBus.emit('issue.created', 72, { title: 'Test' }, 123);

      // Wait for async handlers to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should allow failed subscriber to continue receiving future events', async () => {
      const handler = jest.fn()
        .mockImplementationOnce(() => {
          throw new Error('First call fails');
        })
        .mockImplementationOnce(() => {
          // Second call succeeds
        });

      eventBus.subscribe(handler);

      // First event - handler throws
      eventBus.emit('issue.created', 72, { title: 'Event 1' }, 123);
      await new Promise(resolve => setImmediate(resolve));

      // Second event - handler succeeds
      eventBus.emit('issue.updated', 72, { title: 'Event 2' }, 123);
      await new Promise(resolve => setImmediate(resolve));

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid event emission', () => {
      const handler = jest.fn();
      eventBus.subscribe(handler);

      // Emit 100 events rapidly
      for (let i = 0; i < 100; i++) {
        eventBus.emit('issue.created', 72, { index: i }, i);
      }

      expect(handler).toHaveBeenCalledTimes(100);
      expect(eventBus.getEventCount()).toBe(100);
    });

    it('should handle subscribe/unsubscribe during event emission', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const id1 = eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      eventBus.emit('issue.created', 72, {}, 123);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // Unsubscribe handler1
      eventBus.unsubscribe(id1);

      eventBus.emit('issue.updated', 72, {}, 123);

      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(2); // Now 2
    });

    it('should support async handlers', async () => {
      const results: string[] = [];

      const handler1 = jest.fn(async (event: StateChangeEvent) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(`handler1: ${event.type}`);
      });

      const handler2 = jest.fn(async (event: StateChangeEvent) => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push(`handler2: ${event.type}`);
      });

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      eventBus.emit('issue.created', 72, {}, 123);

      // Wait for async handlers
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(2);
    });

    it('should clear all subscribers', () => {
      const handlers = Array.from({ length: 10 }, () => jest.fn());

      handlers.forEach(handler => {
        eventBus.subscribe(handler);
      });

      expect(eventBus.getSubscriberCount()).toBe(10);

      eventBus.clearAllSubscribers();

      expect(eventBus.getSubscriberCount()).toBe(0);

      // Verify no handlers receive events after clear
      eventBus.emit('issue.created', 72, {}, 123);

      handlers.forEach(handler => {
        expect(handler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Singleton instance', () => {
    it('should export singleton eventBus instance', () => {
      // Import singleton instance
      const { eventBus: singleton } = require('./event-bus');

      expect(singleton).toBeInstanceOf(EventBus);
      expect(singleton).toBeTruthy();
    });
  });
});
