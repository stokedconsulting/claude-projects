# Event Bus - Real-Time Notifications

Event bus module for broadcasting state change notifications to connected clients (Phase 4.1).

## Overview

The Event Bus implements an in-memory EventEmitter pattern for real-time notifications when project state changes occur. It supports:

- **Event Types**: `project.updated`, `issue.created`, `issue.updated`, `issue.deleted`, `phase.updated`
- **Filtering**: Subscribe to specific projects and/or event types
- **Performance**: Supports 100+ concurrent subscribers with <100ms event delivery
- **Error Isolation**: Failed subscriber handlers don't affect other subscribers

## Usage

### Basic Subscription

```typescript
import { eventBus } from './events/event-bus';

// Subscribe to all events
const subscriberId = eventBus.subscribe((event) => {
  console.log('Event received:', event.type);
  console.log('Project:', event.projectNumber);
  console.log('Data:', event.data);
});

// Later: unsubscribe
eventBus.unsubscribe(subscriberId);
```

### Filtered Subscription

```typescript
// Subscribe to specific project
const subscriberId = eventBus.subscribe(
  (event) => {
    console.log('Project 72 event:', event.type);
  },
  { projectNumber: 72 }
);

// Subscribe to specific event types
const updateSubId = eventBus.subscribe(
  (event) => {
    console.log('Issue update:', event.data);
  },
  { eventTypes: ['issue.updated', 'issue.deleted'] }
);

// Combine filters
const combinedSubId = eventBus.subscribe(
  (event) => {
    console.log('Project 72 issue updates:', event.data);
  },
  {
    projectNumber: 72,
    eventTypes: ['issue.updated'],
  }
);
```

### Event Types

```typescript
type EventType =
  | 'project.updated'   // Project metadata changed
  | 'issue.created'     // New issue created
  | 'issue.updated'     // Issue details updated
  | 'issue.deleted'     // Issue deleted
  | 'phase.updated';    // Issue moved to different phase

interface StateChangeEvent {
  type: EventType;           // Event type
  timestamp: string;         // ISO 8601 timestamp
  projectNumber: number;     // GitHub Project number
  issueNumber?: number;      // GitHub issue number (optional)
  data: unknown;             // Type-specific payload
}
```

### Async Handlers

Event handlers can be async:

```typescript
eventBus.subscribe(async (event) => {
  // Async operations are supported
  await sendWebSocketMessage(event);
  await logToDatabase(event);
});
```

### Error Handling

Failed handlers are isolated - they don't affect other subscribers:

```typescript
// Handler 1 - throws error
eventBus.subscribe((event) => {
  throw new Error('Handler 1 failed');
});

// Handler 2 - still receives events
eventBus.subscribe((event) => {
  console.log('Handler 2 received:', event.type);
});

// Both handlers are called, Handler 1's error is logged but doesn't propagate
```

## Integration with Tool Handlers

Tool handlers automatically emit events after successful operations:

### create_issue

```typescript
// Emits: issue.created
const tool = createCreateIssueTool(apiClient);
await tool.handler({
  projectNumber: 72,
  title: 'New Feature',
});

// Event emitted:
// {
//   type: 'issue.created',
//   projectNumber: 72,
//   issueNumber: 123,
//   timestamp: '2026-01-20T12:00:00.000Z',
//   data: { id, title, status, labels, ... }
// }
```

### update_issue_status

```typescript
// Emits: issue.updated
const tool = createUpdateIssueStatusTool(apiClient);
await tool.handler({
  projectNumber: 72,
  issueNumber: 123,
  status: 'in_progress',
});

// Event emitted:
// {
//   type: 'issue.updated',
//   projectNumber: 72,
//   issueNumber: 123,
//   data: { ...issue, updatedField: 'status' }
// }
```

### update_issue_phase

```typescript
// Emits: phase.updated
const tool = createUpdateIssuePhaseTool(apiClient);
await tool.handler({
  projectNumber: 72,
  issueNumber: 123,
  phaseName: 'Core Features',
});

// Event emitted:
// {
//   type: 'phase.updated',
//   projectNumber: 72,
//   issueNumber: 123,
//   data: { ...issue, phaseName: 'Core Features' }
// }
```

### update_issue

```typescript
// Emits: issue.updated
const tool = createUpdateIssueTool(apiClient);
await tool.handler({
  projectNumber: 72,
  issueNumber: 123,
  title: 'Updated Title',
  labels: ['bug', 'high-priority'],
});

// Event emitted:
// {
//   type: 'issue.updated',
//   projectNumber: 72,
//   issueNumber: 123,
//   data: { ...issue, updatedFields: ['title', 'labels'] }
// }
```

## WebSocket Integration (Phase 4.2)

In Phase 4.2, the event bus will be connected to WebSocket subscriptions:

```typescript
// Example (Phase 4.2 implementation)
wss.on('connection', (ws, request) => {
  const projectNumber = parseProjectFromRequest(request);

  // Subscribe to project-specific events
  const subscriberId = eventBus.subscribe(
    async (event) => {
      // Send event to WebSocket client
      ws.send(JSON.stringify(event));
    },
    { projectNumber }
  );

  // Cleanup on disconnect
  ws.on('close', () => {
    eventBus.unsubscribe(subscriberId);
  });
});
```

## Monitoring & Debugging

```typescript
// Get current subscriber count
const count = eventBus.getSubscriberCount();
console.log(`Active subscribers: ${count}`);

// Get total events emitted
const eventCount = eventBus.getEventCount();
console.log(`Total events: ${eventCount}`);

// Get subscriber details (for debugging)
const subscribers = eventBus.getSubscribers();
console.log('Subscribers:', subscribers);
// [
//   { id: 'sub_123_abc', options: { projectNumber: 72 }, subscribedAt: '...' },
//   { id: 'sub_456_def', options: {}, subscribedAt: '...' }
// ]
```

## Testing

See `event-bus.test.ts` for comprehensive test coverage including:

- Subscription management (add/remove)
- Event emission and delivery
- Event filtering (by project and type)
- Performance testing (100+ subscribers, <100ms delivery)
- Error isolation
- Async handler support

See `integration.test.ts` for integration tests with tool handlers.

## Performance Characteristics

- **Subscriber Limit**: Supports 500+ concurrent subscribers (configurable)
- **Event Delivery**: <100ms to all subscribers (tested with 150 subscribers)
- **Memory**: In-memory only, no persistence
- **Scalability**: Single-process only (no cross-process events)

## Next Steps (Phase 4.2)

Phase 4.2 will add WebSocket endpoint for real-time notifications:

1. Create WebSocket server endpoint
2. Handle client subscriptions with project filtering
3. Push events from event bus to connected clients
4. Handle reconnection and subscription recovery
