/**
 * Integration Tests - Event Bus + Tool Handlers
 *
 * Verifies that tool handlers correctly emit events to the event bus
 * after successful operations (AC-4.1.a).
 */

import { eventBus, StateChangeEvent } from './event-bus';
import { createCreateIssueTool } from '../tools/create-issue';
import { createUpdateIssueStatusTool } from '../tools/update-issue-status';
import { createUpdateIssuePhaseTool } from '../tools/update-issue-phase';
import { createUpdateIssueTool } from '../tools/update-issue';
import { APIClient } from '../api-client';

// Mock fetch globally
global.fetch = jest.fn();

describe('Event Bus Integration with Tool Handlers', () => {
  let apiClient: APIClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    // Create API client with mock credentials
    apiClient = new APIClient({
      baseUrl: 'https://claude-projects.truapi.com',
      apiKey: 'test-api-key',
    });

    // Setup fetch mock
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  afterEach(() => {
    // Clear all subscribers from singleton instance
    eventBus.clearAllSubscribers();
    jest.clearAllMocks();
  });

  describe('create_issue tool', () => {
    it('should emit issue.created event after successful creation', async () => {
      const createdIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'New Feature',
        description: 'Add new feature',
        status: 'todo',
        labels: ['enhancement'],
        createdAt: '2026-01-20T12:00:00Z',
        updatedAt: '2026-01-20T12:00:00Z',
        number: 456,
        url: 'https://github.com/org/repo/issues/456',
      };

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdIssue,
        headers: new Headers(),
      } as Response);

      // Setup event listener
      const eventHandler = jest.fn();
      eventBus.subscribe(eventHandler);

      // Execute tool
      const tool = createCreateIssueTool(apiClient);
      const result = await tool.handler({
        projectNumber: 72,
        title: 'New Feature',
        body: 'Add new feature',
        status: 'todo',
        labels: ['enhancement'],
      });

      // Verify tool succeeded
      expect(result.isError).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify event was emitted
      expect(eventHandler).toHaveBeenCalledTimes(1);

      const event: StateChangeEvent = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('issue.created');
      expect(event.projectNumber).toBe(72);
      expect(event.issueNumber).toBe(456);
      expect(event.data).toEqual(createdIssue);
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should NOT emit event when creation fails', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Project not found' }),
        headers: new Headers(),
      } as Response);

      // Setup event listener
      const eventHandler = jest.fn();
      eventBus.subscribe(eventHandler);

      // Execute tool
      const tool = createCreateIssueTool(apiClient);
      const result = await tool.handler({
        projectNumber: 999,
        title: 'New Feature',
      });

      // Verify tool failed
      expect(result.isError).toBe(true);

      // Verify NO event was emitted
      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('update_issue_status tool', () => {
    it('should emit issue.updated event after successful status update', async () => {
      const existingIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'Test Issue',
        status: 'todo' as const,
        labels: [],
        createdAt: '2026-01-20T12:00:00Z',
        updatedAt: '2026-01-20T12:00:00Z',
        number: 123,
      };

      const updatedIssue = {
        ...existingIssue,
        status: 'in_progress' as const,
        updatedAt: '2026-01-20T12:30:00Z',
      };

      // Mock GET request (validation) and PUT request (update)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => existingIssue,
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedIssue,
          headers: new Headers(),
        } as Response);

      // Setup event listener
      const eventHandler = jest.fn();
      eventBus.subscribe(eventHandler);

      // Execute tool
      const tool = createUpdateIssueStatusTool(apiClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 123,
        status: 'in_progress',
      });

      // Verify tool succeeded
      expect(result.isError).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify event was emitted
      expect(eventHandler).toHaveBeenCalledTimes(1);

      const event: StateChangeEvent = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('issue.updated');
      expect(event.projectNumber).toBe(72);
      expect(event.issueNumber).toBe(123);
      expect((event.data as any).status).toBe('in_progress');
      expect((event.data as any).updatedField).toBe('status');
    });
  });

  describe('update_issue_phase tool', () => {
    it('should emit phase.updated event after successful phase update', async () => {
      const phases = [
        {
          id: 'phase-1',
          projectId: 'project-72',
          name: 'Foundation',
          order: 1,
          status: 'completed' as const,
          createdAt: '2026-01-20T12:00:00Z',
          updatedAt: '2026-01-20T12:00:00Z',
        },
        {
          id: 'phase-2',
          projectId: 'project-72',
          name: 'Core Features',
          order: 2,
          status: 'in_progress' as const,
          createdAt: '2026-01-20T12:00:00Z',
          updatedAt: '2026-01-20T12:00:00Z',
        },
      ];

      const updatedIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'Test Issue',
        status: 'in_progress' as const,
        labels: [],
        createdAt: '2026-01-20T12:00:00Z',
        updatedAt: '2026-01-20T12:30:00Z',
        number: 123,
        phase: 'Core Features',
      };

      // Mock GET phases and PUT update
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => phases,
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedIssue,
          headers: new Headers(),
        } as Response);

      // Setup event listener
      const eventHandler = jest.fn();
      eventBus.subscribe(eventHandler);

      // Execute tool
      const tool = createUpdateIssuePhaseTool(apiClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 123,
        phaseName: 'Core Features',
      });

      // Verify tool succeeded
      expect(result.isError).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify event was emitted
      expect(eventHandler).toHaveBeenCalledTimes(1);

      const event: StateChangeEvent = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('phase.updated');
      expect(event.projectNumber).toBe(72);
      expect(event.issueNumber).toBe(123);
      expect((event.data as any).phase).toBe('Core Features');
      expect((event.data as any).phaseName).toBe('Core Features');
    });
  });

  describe('update_issue tool', () => {
    it('should emit issue.updated event after successful update', async () => {
      const updatedIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'Updated Title',
        description: 'Updated description',
        status: 'in_progress' as const,
        labels: ['bug', 'high-priority'],
        createdAt: '2026-01-20T12:00:00Z',
        updatedAt: '2026-01-20T12:30:00Z',
      };

      // Mock PATCH request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => updatedIssue,
        headers: new Headers(),
      } as Response);

      // Setup event listener
      const eventHandler = jest.fn();
      eventBus.subscribe(eventHandler);

      // Execute tool
      const tool = createUpdateIssueTool(apiClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 123,
        title: 'Updated Title',
        body: 'Updated description',
        labels: ['bug', 'high-priority'],
      });

      // Verify tool succeeded
      expect(result.isError).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify event was emitted
      expect(eventHandler).toHaveBeenCalledTimes(1);

      const event: StateChangeEvent = eventHandler.mock.calls[0][0];
      expect(event.type).toBe('issue.updated');
      expect(event.projectNumber).toBe(72);
      expect(event.issueNumber).toBe(123);
      expect((event.data as any).title).toBe('Updated Title');
      expect((event.data as any).updatedFields).toEqual(['title', 'body', 'labels']);
    });
  });

  describe('Event filtering', () => {
    it('should only notify subscribers interested in specific project', async () => {
      const createdIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'Test Issue',
        status: 'todo' as const,
        labels: [],
        createdAt: '2026-01-20T12:00:00Z',
        updatedAt: '2026-01-20T12:00:00Z',
        number: 123,
      };

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdIssue,
        headers: new Headers(),
      } as Response);

      // Setup event listeners with filters
      const project72Handler = jest.fn();
      const project99Handler = jest.fn();
      const allProjectsHandler = jest.fn();

      eventBus.subscribe(project72Handler, { projectNumber: 72 });
      eventBus.subscribe(project99Handler, { projectNumber: 99 });
      eventBus.subscribe(allProjectsHandler); // No filter

      // Execute tool
      const tool = createCreateIssueTool(apiClient);
      await tool.handler({
        projectNumber: 72,
        title: 'Test Issue',
      });

      // Verify only project 72 and all-projects handlers were called
      expect(project72Handler).toHaveBeenCalledTimes(1);
      expect(project99Handler).not.toHaveBeenCalled(); // Filtered out
      expect(allProjectsHandler).toHaveBeenCalledTimes(1);
    });

    it('should only notify subscribers interested in specific event types', async () => {
      const createdIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'Test Issue',
        status: 'todo' as const,
        labels: [],
        createdAt: '2026-01-20T12:00:00Z',
        updatedAt: '2026-01-20T12:00:00Z',
        number: 123,
      };

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdIssue,
        headers: new Headers(),
      } as Response);

      // Setup event listeners with type filters
      const createHandler = jest.fn();
      const updateHandler = jest.fn();
      const allHandler = jest.fn();

      eventBus.subscribe(createHandler, { eventTypes: ['issue.created'] });
      eventBus.subscribe(updateHandler, { eventTypes: ['issue.updated'] });
      eventBus.subscribe(allHandler); // No filter

      // Execute tool
      const tool = createCreateIssueTool(apiClient);
      await tool.handler({
        projectNumber: 72,
        title: 'Test Issue',
      });

      // Verify only create and all handlers were called
      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(updateHandler).not.toHaveBeenCalled(); // Filtered out
      expect(allHandler).toHaveBeenCalledTimes(1);
    });
  });
});
