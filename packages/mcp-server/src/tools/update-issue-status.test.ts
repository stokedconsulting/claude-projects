import {
  createUpdateIssueStatusTool,
  UpdatedIssue,
  UpdateIssueStatusParams,
  IssueStatus,
  ConflictError,
} from './update-issue-status';
import { APIClient, NotFoundError } from '../api-client';

/**
 * Mock API client for testing update-issue-status tool
 */
class MockAPIClient extends APIClient {
  private mockGetResponses: Map<string, any> = new Map();
  private mockPutResponses: Map<string, any> = new Map();
  private mockGetErrors: Map<string, Error> = new Map();
  private mockPutErrors: Map<string, Error> = new Map();

  constructor() {
    // Override parent constructor to avoid requiring API key
    super({ apiKey: 'test-key', baseUrl: 'https://test.example.com' });
  }

  /**
   * Set mock response for a specific GET path
   */
  setGetResponse(path: string, response: any) {
    this.mockGetResponses.set(path, response);
    this.mockGetErrors.delete(path);
  }

  /**
   * Set mock response for a specific PUT path
   */
  setPutResponse(path: string, response: any) {
    this.mockPutResponses.set(path, response);
    this.mockPutErrors.delete(path);
  }

  /**
   * Set mock error for a specific GET path
   */
  setGetError(path: string, error: Error) {
    this.mockGetErrors.set(path, error);
    this.mockGetResponses.delete(path);
  }

  /**
   * Set mock error for a specific PUT path
   */
  setPutError(path: string, error: Error) {
    this.mockPutErrors.set(path, error);
    this.mockPutResponses.delete(path);
  }

  /**
   * Override get method to return mock data
   */
  async get<T>(path: string): Promise<T> {
    // Check if error should be thrown
    if (this.mockGetErrors.has(path)) {
      throw this.mockGetErrors.get(path);
    }

    // Check if mock response exists
    if (this.mockGetResponses.has(path)) {
      return this.mockGetResponses.get(path) as T;
    }

    // Default: throw NotFoundError
    throw new NotFoundError(`No mock configured for GET path: ${path}`);
  }

  /**
   * Override put method to return mock data
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    // Check if error should be thrown
    if (this.mockPutErrors.has(path)) {
      throw this.mockPutErrors.get(path);
    }

    // Check if mock response exists
    if (this.mockPutResponses.has(path)) {
      return this.mockPutResponses.get(path) as T;
    }

    // Default: throw error
    throw new Error(`No mock configured for PUT path: ${path}`);
  }

  /**
   * Clear all mock data
   */
  clear() {
    this.mockGetResponses.clear();
    this.mockPutResponses.clear();
    this.mockGetErrors.clear();
    this.mockPutErrors.clear();
  }
}

describe('Update Issue Status Tool', () => {
  let mockClient: MockAPIClient;

  beforeEach(() => {
    mockClient = new MockAPIClient();
  });

  /**
   * Helper function to extract UpdatedIssue from tool result
   */
  function extractUpdatedIssue(result: any): UpdatedIssue {
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const textContent = result.content[0];
    if (textContent.type !== 'text') throw new Error('Expected text content');
    return JSON.parse(textContent.text || '{}');
  }

  /**
   * Helper function to extract error from tool result
   */
  function extractError(result: any): any {
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const textContent = result.content[0];
    if (textContent.type !== 'text') throw new Error('Expected text content');
    return JSON.parse(textContent.text || '{}');
  }

  describe('AC-3.1.a: Valid parameters returns updated Issue object', () => {
    it('should update issue status successfully with valid parameters', async () => {
      // Setup: Mock successful GET and PUT responses
      const existingIssue: UpdatedIssue = {
        id: 'issue-123',
        projectId: 'project-72',
        number: 42,
        title: 'Implement update_issue_status tool',
        description: 'Add MCP tool for updating issue status',
        status: 'todo',
        labels: ['mcp', 'phase-3', 'enhancement'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'in_progress',
        updatedAt: '2024-01-20T15:00:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/42', existingIssue);
      mockClient.setPutResponse('/api/projects/72/issues/42/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const params: UpdateIssueStatusParams = {
        projectNumber: 72,
        issueNumber: 42,
        status: 'in_progress',
      };
      const result = await tool.handler(params);

      const issue = extractUpdatedIssue(result);

      // Verify status was updated
      expect(issue.status).toBe('in_progress');
      expect(issue.id).toBe('issue-123');
      expect(issue.title).toBe('Implement update_issue_status tool');

      // Verify result is not an error
      expect(result.isError).toBeUndefined();
    });

    it('should update issue status to "done"', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'issue-456',
        projectId: 'project-72',
        title: 'Test Issue',
        status: 'in_progress',
        labels: ['test'],
        createdAt: '2024-01-10T08:00:00Z',
        updatedAt: '2024-01-18T16:45:00Z',
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'done',
        updatedAt: '2024-01-20T17:00:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/456', existingIssue);
      mockClient.setPutResponse('/api/projects/72/issues/456/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 456,
        status: 'done',
      });

      const issue = extractUpdatedIssue(result);
      expect(issue.status).toBe('done');
      expect(issue.updatedAt).toBe('2024-01-20T17:00:00Z');
    });

    it('should update issue status to "backlog"', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'issue-789',
        projectId: 'project-72',
        title: 'Backlog Issue',
        status: 'todo',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'backlog',
        updatedAt: '2024-01-20T18:00:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/789', existingIssue);
      mockClient.setPutResponse('/api/projects/72/issues/789/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 789,
        status: 'backlog',
      });

      const issue = extractUpdatedIssue(result);
      expect(issue.status).toBe('backlog');
    });
  });

  describe('AC-3.1.b: Status changes reflected in GitHub Projects', () => {
    it('should change status from "todo" to "in_progress"', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'issue-100',
        projectId: 'project-72',
        title: 'Issue to start',
        status: 'todo',
        labels: ['feature'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T10:00:00Z',
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'in_progress',
        updatedAt: '2024-01-20T15:30:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/100', existingIssue);
      mockClient.setPutResponse('/api/projects/72/issues/100/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 100,
        status: 'in_progress',
      });

      const issue = extractUpdatedIssue(result);

      // Verify the status transition
      expect(issue.status).toBe('in_progress');
      // Verify updatedAt timestamp changed
      expect(issue.updatedAt).not.toBe(existingIssue.updatedAt);
    });
  });

  describe('AC-3.1.c: Invalid status value returns validation error', () => {
    it('should reject invalid status value through schema validation', async () => {
      const tool = createUpdateIssueStatusTool(mockClient);

      // Note: This will be caught by the registry's validation layer
      // We're testing that our schema correctly defines valid enum values
      expect(tool.inputSchema.properties.status.enum).toEqual([
        'backlog',
        'todo',
        'in_progress',
        'done',
      ]);
    });

    it('should have only valid status values in enum', () => {
      const tool = createUpdateIssueStatusTool(mockClient);
      const validStatuses = tool.inputSchema.properties.status.enum;

      expect(validStatuses).toHaveLength(4);
      expect(validStatuses).toContain('backlog');
      expect(validStatuses).toContain('todo');
      expect(validStatuses).toContain('in_progress');
      expect(validStatuses).toContain('done');

      // Ensure invalid values are NOT in enum
      expect(validStatuses).not.toContain('invalid');
      expect(validStatuses).not.toContain('open');
      expect(validStatuses).not.toContain('closed');
    });
  });

  describe('AC-3.1.d: Issue does not exist returns 404 error', () => {
    it('should return 404 error when issue does not exist', async () => {
      // Setup: Mock NotFoundError for GET request
      mockClient.setGetError(
        '/api/projects/72/issues/999',
        new NotFoundError('Issue not found')
      );

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 999,
        status: 'in_progress',
      });

      const errorResponse = extractError(result);

      // Verify error response
      expect(result.isError).toBe(true);
      expect(errorResponse.error).toContain('Issue #999 not found in Project #72');
      expect(errorResponse.projectNumber).toBe(72);
      expect(errorResponse.issueNumber).toBe(999);
    });

    it('should validate issue exists before attempting update', async () => {
      // Setup: Issue doesn't exist
      mockClient.setGetError(
        '/api/projects/50/issues/25',
        new NotFoundError('Issue #25 not found')
      );

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 50,
        issueNumber: 25,
        status: 'done',
      });

      // Should return 404 without attempting PUT
      expect(result.isError).toBe(true);
      const errorResponse = extractError(result);
      expect(errorResponse.error).toContain('#25');
      expect(errorResponse.error).toContain('#50');
    });
  });

  describe('AC-3.1.e: Concurrent update returns 409 conflict error', () => {
    it('should return 409 conflict error with retry suggestion', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'issue-conflict',
        projectId: 'project-72',
        title: 'Concurrent update test',
        status: 'todo',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/200', existingIssue);
      mockClient.setPutError(
        '/api/projects/72/issues/200/status',
        new Error('HTTP 409: Conflict - Concurrent update detected')
      );

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 200,
        status: 'in_progress',
      });

      const errorResponse = extractError(result) as ConflictError;

      // Verify conflict error response
      expect(result.isError).toBe(true);
      expect(errorResponse.error).toBe('Concurrent update conflict detected');
      expect(errorResponse.conflictType).toBe('concurrent_update');
      expect(errorResponse.suggestion).toContain('Retry');
      expect(errorResponse.projectNumber).toBe(72);
      expect(errorResponse.issueNumber).toBe(200);
      expect(errorResponse.attemptedStatus).toBe('in_progress');
    });

    it('should include helpful retry suggestion in conflict error', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'issue-retry',
        projectId: 'project-72',
        title: 'Retry test',
        status: 'backlog',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/300', existingIssue);
      mockClient.setPutError(
        '/api/projects/72/issues/300/status',
        new Error('409 Conflict')
      );

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 300,
        status: 'todo',
      });

      const errorResponse = extractError(result) as ConflictError;
      expect(errorResponse.suggestion).toContain('fetching the latest issue state');
    });
  });

  describe('AC-3.1.f: Update succeeds with updated timestamp', () => {
    it('should return updated Issue object with new status and timestamp', async () => {
      const oldTimestamp = '2024-01-20T10:00:00Z';
      const newTimestamp = '2024-01-20T16:00:00Z';

      const existingIssue: UpdatedIssue = {
        id: 'issue-timestamp',
        projectId: 'project-72',
        title: 'Timestamp test',
        status: 'todo',
        labels: ['test'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: oldTimestamp,
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'done',
        updatedAt: newTimestamp,
      };

      mockClient.setGetResponse('/api/projects/72/issues/400', existingIssue);
      mockClient.setPutResponse('/api/projects/72/issues/400/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 400,
        status: 'done',
      });

      const issue = extractUpdatedIssue(result);

      // Verify updated status and timestamp
      expect(issue.status).toBe('done');
      expect(issue.updatedAt).toBe(newTimestamp);
      expect(issue.updatedAt).not.toBe(oldTimestamp);

      // Verify all other fields are preserved
      expect(issue.id).toBe('issue-timestamp');
      expect(issue.title).toBe('Timestamp test');
      expect(issue.createdAt).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('Tool definition and schema validation', () => {
    it('should have correct tool name', () => {
      const tool = createUpdateIssueStatusTool(mockClient);
      expect(tool.name).toBe('update_issue_status');
    });

    it('should have descriptive description', () => {
      const tool = createUpdateIssueStatusTool(mockClient);
      expect(tool.description).toContain('Update the status');
      expect(tool.description).toContain('GitHub issue');
      expect(tool.description).toContain('project board');
      expect(tool.description).toContain('backlog, todo, in_progress, done');
    });

    it('should require projectNumber parameter', () => {
      const tool = createUpdateIssueStatusTool(mockClient);
      expect(tool.inputSchema.required).toContain('projectNumber');
      expect(tool.inputSchema.properties.projectNumber.type).toBe('number');
    });

    it('should require issueNumber parameter', () => {
      const tool = createUpdateIssueStatusTool(mockClient);
      expect(tool.inputSchema.required).toContain('issueNumber');
      expect(tool.inputSchema.properties.issueNumber.type).toBe('number');
    });

    it('should require status parameter', () => {
      const tool = createUpdateIssueStatusTool(mockClient);
      expect(tool.inputSchema.required).toContain('status');
      expect(tool.inputSchema.properties.status.type).toBe('string');
    });

    it('should return valid MCP tool result format', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'test',
        projectId: 'project-72',
        title: 'Test',
        status: 'todo',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T10:00:00Z',
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'done',
        updatedAt: '2024-01-20T15:00:00Z',
      };

      mockClient.setGetResponse('/api/projects/72/issues/1', existingIssue);
      mockClient.setPutResponse('/api/projects/72/issues/1/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 72,
        issueNumber: 1,
        status: 'done',
      });

      // Verify MCP ToolResult format
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle all valid status transitions', async () => {
      const statuses: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'done'];

      for (const status of statuses) {
        mockClient.clear();

        const existingIssue: UpdatedIssue = {
          id: 'issue-status-test',
          projectId: 'project-72',
          title: 'Status test',
          status: 'todo',
          labels: [],
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T10:00:00Z',
        };

        const updatedIssue: UpdatedIssue = {
          ...existingIssue,
          status,
          updatedAt: '2024-01-20T15:00:00Z',
        };

        mockClient.setGetResponse('/api/projects/72/issues/500', existingIssue);
        mockClient.setPutResponse('/api/projects/72/issues/500/status', updatedIssue);

        const tool = createUpdateIssueStatusTool(mockClient);
        const result = await tool.handler({
          projectNumber: 72,
          issueNumber: 500,
          status,
        });

        const issue = extractUpdatedIssue(result);
        expect(issue.status).toBe(status);
      }
    });

    it('should handle large project and issue numbers', async () => {
      const existingIssue: UpdatedIssue = {
        id: 'large-numbers',
        projectId: 'project-999999',
        title: 'Large numbers test',
        status: 'todo',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T10:00:00Z',
      };

      const updatedIssue: UpdatedIssue = {
        ...existingIssue,
        status: 'done',
        updatedAt: '2024-01-20T15:00:00Z',
      };

      mockClient.setGetResponse('/api/projects/999999/issues/888888', existingIssue);
      mockClient.setPutResponse('/api/projects/999999/issues/888888/status', updatedIssue);

      const tool = createUpdateIssueStatusTool(mockClient);
      const result = await tool.handler({
        projectNumber: 999999,
        issueNumber: 888888,
        status: 'done',
      });

      const issue = extractUpdatedIssue(result);
      expect(issue.status).toBe('done');
    });

    it('should return valid JSON in all error scenarios', async () => {
      const errorScenarios = [
        {
          getPath: '/api/projects/72/issues/404',
          getError: new NotFoundError('Issue not found'),
          params: { projectNumber: 72, issueNumber: 404, status: 'done' as IssueStatus },
        },
        {
          getPath: '/api/projects/72/issues/409',
          getError: null,
          putPath: '/api/projects/72/issues/409/status',
          putError: new Error('409 Conflict'),
          params: { projectNumber: 72, issueNumber: 409, status: 'in_progress' as IssueStatus },
        },
      ];

      for (const scenario of errorScenarios) {
        mockClient.clear();

        if (scenario.getError) {
          mockClient.setGetError(scenario.getPath, scenario.getError);
        } else {
          const mockIssue: UpdatedIssue = {
            id: 'test',
            projectId: 'project-72',
            title: 'Test',
            status: 'todo',
            labels: [],
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-20T10:00:00Z',
          };
          mockClient.setGetResponse(scenario.getPath, mockIssue);

          if (scenario.putPath && scenario.putError) {
            mockClient.setPutError(scenario.putPath, scenario.putError);
          }
        }

        const tool = createUpdateIssueStatusTool(mockClient);
        const result = await tool.handler(scenario.params);

        // Should always return valid JSON
        const textContent = result.content[0];
        if (textContent.type !== 'text') throw new Error('Expected text content');
        expect(() => JSON.parse(textContent.text || '{}')).not.toThrow();
        expect(result.isError).toBe(true);
      }
    });
  });
});
