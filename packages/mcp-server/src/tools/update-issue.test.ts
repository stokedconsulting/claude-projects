import { createUpdateIssueTool, UpdateIssueParams } from './update-issue';
import { APIClient, Issue, NotFoundError } from '../api-client';

/**
 * Mock API client for testing update-issue tool
 */
class MockAPIClient extends APIClient {
  private mockResponses: Map<string, any> = new Map();
  private mockErrors: Map<string, Error> = new Map();
  private lastPatchBody: any = null;

  constructor() {
    // Override parent constructor to avoid requiring API key
    super({ apiKey: 'test-key', baseUrl: 'https://test.example.com' });
  }

  /**
   * Set mock response for a specific path
   */
  setResponse(path: string, response: any) {
    this.mockResponses.set(path, response);
    this.mockErrors.delete(path);
  }

  /**
   * Set mock error for a specific path
   */
  setError(path: string, error: Error) {
    this.mockErrors.set(path, error);
    this.mockResponses.delete(path);
  }

  /**
   * Override patch method to return mock data
   */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    // Store the request body for verification
    this.lastPatchBody = body;

    // Check if error should be thrown
    if (this.mockErrors.has(path)) {
      throw this.mockErrors.get(path);
    }

    // Check if mock response exists
    if (this.mockResponses.has(path)) {
      return this.mockResponses.get(path) as T;
    }

    // Default: throw NotFoundError
    throw new NotFoundError(`No mock configured for path: ${path}`);
  }

  /**
   * Get the last PATCH request body
   */
  getLastPatchBody(): any {
    return this.lastPatchBody;
  }

  /**
   * Clear all mock data
   */
  clear() {
    this.mockResponses.clear();
    this.mockErrors.clear();
    this.lastPatchBody = null;
  }
}

describe('Update Issue Tool', () => {
  let mockClient: MockAPIClient;

  beforeEach(() => {
    mockClient = new MockAPIClient();
  });

  /**
   * Helper function to extract Issue from tool result
   */
  function extractIssue(result: any): Issue {
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const textContent = result.content[0];
    if (textContent.type !== 'text') throw new Error('Expected text content');
    return JSON.parse(textContent.text || '{}');
  }

  /**
   * Helper function to extract error message from tool result
   */
  function extractError(result: any): { error: string; message?: string; projectNumber?: number; issueNumber?: number } {
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const textContent = result.content[0];
    if (textContent.type !== 'text') throw new Error('Expected text content');
    return JSON.parse(textContent.text || '{}');
  }

  describe('AC-3.4.a: Only title → Only title is updated, other fields unchanged', () => {
    it('should update only title when only title is provided', async () => {
      const originalIssue: Issue = {
        id: 'issue-123',
        projectId: 'project-72',
        title: 'Original Title',
        description: 'Original description',
        status: 'open',
        labels: ['bug', 'high-priority'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      };

      const updatedIssue: Issue = {
        ...originalIssue,
        title: 'Updated Title',
        updatedAt: '2024-01-20T15:00:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/42', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 42,
        title: 'Updated Title',
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Verify only title was updated
      expect(issue.title).toBe('Updated Title');
      expect(issue.description).toBe('Original description');
      expect(issue.status).toBe('open');
      expect(issue.labels).toEqual(['bug', 'high-priority']);

      // Verify PATCH body contains only title
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({ title: 'Updated Title' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('AC-3.4.b: assignee=null → Issue assignee is removed', () => {
    it('should remove assignee when assignee is null', async () => {
      const updatedIssue: Issue = {
        id: 'issue-456',
        projectId: 'project-72',
        title: 'Issue with no assignee',
        status: 'open',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T15:00:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/456', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 456,
        assignee: null,
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Verify assignee is not in response (removed)
      expect(issue).not.toHaveProperty('assignee');

      // Verify PATCH body contains null assignee
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({ assignee: null });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('AC-3.4.c: Labels provided → Labels are replaced (not merged) with provided array', () => {
    it('should replace labels with provided array', async () => {
      const updatedIssue: Issue = {
        id: 'issue-789',
        projectId: 'project-72',
        title: 'Issue with updated labels',
        status: 'open',
        labels: ['enhancement', 'frontend'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T15:30:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/789', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 789,
        labels: ['enhancement', 'frontend'],
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Verify labels are replaced
      expect(issue.labels).toEqual(['enhancement', 'frontend']);

      // Verify PATCH body contains labels array
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({ labels: ['enhancement', 'frontend'] });
      expect(result.isError).toBeUndefined();
    });

    it('should allow clearing all labels with empty array', async () => {
      const updatedIssue: Issue = {
        id: 'issue-clear-labels',
        projectId: 'project-72',
        title: 'Issue with no labels',
        status: 'open',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T15:45:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/100', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 100,
        labels: [],
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Verify all labels are cleared
      expect(issue.labels).toEqual([]);

      // Verify PATCH body contains empty labels array
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({ labels: [] });
    });
  });

  describe('AC-3.4.d: No update fields → Returns validation error "At least one field required"', () => {
    it('should return validation error when no fields are provided', async () => {
      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 42,
      };

      const result = await tool.handler(params);
      const errorResponse = extractError(result);

      // Verify validation error
      expect(result.isError).toBe(true);
      expect(errorResponse.error).toBe('At least one field required');
      expect(errorResponse.message).toContain('At least one of title, body, assignee, or labels must be provided');
      expect(errorResponse.projectNumber).toBe(72);
      expect(errorResponse.issueNumber).toBe(42);

      // Verify no PATCH request was made
      expect(mockClient.getLastPatchBody()).toBeNull();
    });
  });

  describe('AC-3.4.e: Issue does not exist → Returns 404 error', () => {
    it('should return 404 error when issue does not exist', async () => {
      mockClient.setError(
        '/api/projects/72/issues/999',
        new NotFoundError('Issue not found')
      );

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 999,
        title: 'New Title',
      };

      const result = await tool.handler(params);
      const errorResponse = extractError(result);

      // Verify 404 error response
      expect(result.isError).toBe(true);
      expect(errorResponse.error).toContain('Issue #999 not found in Project #72');
      expect(errorResponse.projectNumber).toBe(72);
      expect(errorResponse.issueNumber).toBe(999);
    });

    it('should detect project mismatch when issue not in project', async () => {
      mockClient.setError(
        '/api/projects/72/issues/123',
        new NotFoundError('Issue #123 not found in project #72')
      );

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 123,
        title: 'New Title',
      };

      const result = await tool.handler(params);
      const errorResponse = extractError(result);

      // Verify error clarifies issue-project mismatch
      expect(result.isError).toBe(true);
      expect(errorResponse.error).toContain('exists but is not part of Project #72');
      expect(errorResponse.error).toContain('Issue #123');
    });
  });

  describe('AC-3.4.f: Update succeeds → Returns updated Issue object with modification timestamp', () => {
    it('should return updated issue with modification timestamp', async () => {
      const updatedIssue: Issue = {
        id: 'issue-200',
        projectId: 'project-72',
        title: 'Fully Updated Issue',
        description: 'Updated description',
        status: 'in_progress',
        labels: ['feature', 'backend'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T16:00:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/200', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 200,
        title: 'Fully Updated Issue',
        body: 'Updated description',
        labels: ['feature', 'backend'],
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Verify all updated fields
      expect(issue.id).toBe('issue-200');
      expect(issue.title).toBe('Fully Updated Issue');
      expect(issue.description).toBe('Updated description');
      expect(issue.labels).toEqual(['feature', 'backend']);

      // Verify modification timestamp is present
      expect(issue.updatedAt).toBeDefined();
      expect(issue.updatedAt).toBe('2024-01-20T16:00:00Z');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Partial update semantics', () => {
    it('should support updating multiple fields simultaneously', async () => {
      const updatedIssue: Issue = {
        id: 'issue-multi',
        projectId: 'project-72',
        title: 'New Title',
        description: 'New description',
        status: 'open',
        labels: ['updated'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T16:15:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/300', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 300,
        title: 'New Title',
        body: 'New description',
        labels: ['updated'],
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Verify all provided fields were updated
      expect(issue.title).toBe('New Title');
      expect(issue.description).toBe('New description');
      expect(issue.labels).toEqual(['updated']);

      // Verify PATCH body contains all provided fields
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({
        title: 'New Title',
        body: 'New description',
        labels: ['updated'],
      });
    });

    it('should support updating only body field', async () => {
      const updatedIssue: Issue = {
        id: 'issue-body',
        projectId: 'project-72',
        title: 'Unchanged Title',
        description: 'Updated description only',
        status: 'open',
        labels: ['original'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T16:30:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/400', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 400,
        body: 'Updated description only',
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      expect(issue.description).toBe('Updated description only');

      // Verify PATCH body contains only body
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({ body: 'Updated description only' });
    });

    it('should support updating only assignee field', async () => {
      const updatedIssue: Issue = {
        id: 'issue-assignee',
        projectId: 'project-72',
        title: 'Unchanged Title',
        status: 'open',
        labels: ['original'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T16:45:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/500', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 500,
        assignee: 'johndoe',
      };

      const result = await tool.handler(params);

      // Verify PATCH body contains only assignee
      const patchBody = mockClient.getLastPatchBody();
      expect(patchBody).toEqual({ assignee: 'johndoe' });
    });
  });

  describe('Tool definition and schema validation', () => {
    it('should have correct tool name', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.name).toBe('update_issue');
    });

    it('should have descriptive description', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.description).toContain('Update issue details');
      expect(tool.description).toContain('partial update');
      expect(tool.description).toContain('title, description, assignee, or labels');
    });

    it('should require projectNumber parameter', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.inputSchema.required).toContain('projectNumber');
      expect(tool.inputSchema.properties.projectNumber.type).toBe('number');
    });

    it('should require issueNumber parameter', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.inputSchema.required).toContain('issueNumber');
      expect(tool.inputSchema.properties.issueNumber.type).toBe('number');
    });

    it('should have optional title parameter', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.inputSchema.required).not.toContain('title');
      expect(tool.inputSchema.properties.title.type).toBe('string');
      expect(tool.inputSchema.properties.title.nullable).toBe(true);
    });

    it('should have optional body parameter', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.inputSchema.required).not.toContain('body');
      expect(tool.inputSchema.properties.body.type).toBe('string');
      expect(tool.inputSchema.properties.body.nullable).toBe(true);
    });

    it('should have optional assignee parameter', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.inputSchema.required).not.toContain('assignee');
      expect(tool.inputSchema.properties.assignee.type).toBe('string');
      expect(tool.inputSchema.properties.assignee.nullable).toBe(true);
    });

    it('should have optional labels parameter', () => {
      const tool = createUpdateIssueTool(mockClient);
      expect(tool.inputSchema.required).not.toContain('labels');
      expect(tool.inputSchema.properties.labels.type).toBe('array');
      expect(tool.inputSchema.properties.labels.nullable).toBe(true);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty string values', async () => {
      const updatedIssue: Issue = {
        id: 'issue-empty',
        projectId: 'project-72',
        title: '',
        description: '',
        status: 'open',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T17:00:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/600', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const params: UpdateIssueParams = {
        projectNumber: 72,
        issueNumber: 600,
        title: '',
        body: '',
      };

      const result = await tool.handler(params);
      const issue = extractIssue(result);

      // Empty strings are valid updates
      expect(issue.title).toBe('');
      expect(issue.description).toBe('');
    });

    it('should return valid JSON in all error scenarios', async () => {
      const errorScenarios = [
        {
          path: '/api/projects/72/issues/404',
          error: new NotFoundError('Issue not found'),
        },
        {
          path: '/api/projects/72/issues/500',
          error: new NotFoundError('Issue not found in project'),
        },
      ];

      for (const scenario of errorScenarios) {
        mockClient.clear();
        mockClient.setError(scenario.path, scenario.error);

        const tool = createUpdateIssueTool(mockClient);
        const issueNumber = parseInt(scenario.path.split('/').pop() || '0', 10);
        const result = await tool.handler({ projectNumber: 72, issueNumber, title: 'Test' });

        // Should always return valid JSON
        const textContent = result.content[0];
        if (textContent.type !== 'text') throw new Error('Expected text content');
        expect(() => JSON.parse(textContent.text || '{}')).not.toThrow();
      }
    });

    it('should handle large project and issue numbers', async () => {
      const updatedIssue: Issue = {
        id: 'large-numbers',
        projectId: 'project-999999',
        title: 'Large numbers test',
        status: 'open',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T17:15:00Z',
      };

      mockClient.setResponse('/api/projects/999999/issues/888888', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const result = await tool.handler({
        projectNumber: 999999,
        issueNumber: 888888,
        title: 'Large numbers test',
      });

      const issue = extractIssue(result);
      expect(issue.id).toBe('large-numbers');
    });

    it('should return valid MCP tool result format', async () => {
      const updatedIssue: Issue = {
        id: 'test',
        projectId: 'project-72',
        title: 'Test',
        status: 'open',
        labels: [],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T17:30:00Z',
      };

      mockClient.setResponse('/api/projects/72/issues/1', updatedIssue);

      const tool = createUpdateIssueTool(mockClient);
      const result = await tool.handler({ projectNumber: 72, issueNumber: 1, title: 'Test' });

      // Verify MCP ToolResult format
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
    });
  });
});
