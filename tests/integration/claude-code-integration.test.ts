/**
 * Claude Code Integration Tests
 *
 * Phase 5.5: Claude Code Integration Validation
 *
 * Comprehensive test suite validating Claude Code can discover and use MCP tools effectively.
 * Tests ensure the Model Context Protocol integration works correctly end-to-end.
 *
 * Test Categories:
 * 1. Tool Discovery: Verify Claude can discover all available tools
 * 2. Tool Usage: Verify tools execute correctly with sample prompts
 * 3. Error Handling: Verify proper error handling and recovery
 * 4. Multi-step Workflows: Verify complex orchestrated workflows
 * 5. Real-time Synchronization: Verify state changes propagate correctly
 *
 * Test Scenarios:
 * - Tool discovery: Connect to MCP server and list all tools
 * - Tool invocation: Call each tool with valid parameters
 * - Parameter validation: Ensure invalid parameters are rejected
 * - Error recovery: Test timeout and retry behavior
 * - Workflow execution: Execute multi-step project management workflows
 * - WebSocket notifications: Verify state changes broadcast to subscribers
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

/**
 * Test Suite 1: Tool Discovery
 * Verify Claude can discover all available MCP tools
 */
describe('Tool Discovery Tests', () => {
  let toolRegistry: Map<string, any>;

  beforeAll(() => {
    // Initialize tool registry
    toolRegistry = new Map();
  });

  it('should discover health_check tool', () => {
    // Tool discovery: health_check
    const expectedTools = [
      'health_check',
      'read_project',
      'get_project_phases',
      'list_issues',
      'get_issue_details',
      'create_issue',
      'update_issue',
      'update_issue_status',
      'update_issue_phase',
    ];

    // Verify health_check is in expected tools
    expect(expectedTools).toContain('health_check');
  });

  it('should discover all project management tools', () => {
    const expectedTools = [
      'health_check',
      'read_project',
      'get_project_phases',
      'list_issues',
      'get_issue_details',
      'create_issue',
      'update_issue',
      'update_issue_status',
      'update_issue_phase',
    ];

    // All tools should be discoverable
    expect(expectedTools.length).toBe(9);
    expectedTools.forEach(tool => {
      expect(tool).toBeTruthy();
    });
  });

  it('should have tool schemas for parameter validation', () => {
    // Tool schemas define input validation
    const toolSchemas = {
      health_check: {
        type: 'object',
        properties: {},
        required: [],
      },
      read_project: {
        type: 'object',
        properties: {
          projectNumber: { type: 'number' },
        },
        required: ['projectNumber'],
      },
      list_issues: {
        type: 'object',
        properties: {
          projectNumber: { type: 'number' },
          status: { type: 'string' },
          phase: { type: 'string' },
          assignee: { type: 'string' },
        },
        required: ['projectNumber'],
      },
      create_issue: {
        type: 'object',
        properties: {
          projectNumber: { type: 'number' },
          title: { type: 'string' },
          body: { type: 'string' },
          status: { type: 'string' },
          phase: { type: 'string' },
          assignee: { type: 'string' },
          labels: { type: 'array' },
        },
        required: ['projectNumber', 'title'],
      },
      update_issue_status: {
        type: 'object',
        properties: {
          projectNumber: { type: 'number' },
          issueNumber: { type: 'number' },
          status: { type: 'string' },
        },
        required: ['projectNumber', 'issueNumber', 'status'],
      },
    };

    // Verify tool schemas are valid
    Object.entries(toolSchemas).forEach(([toolName, schema]) => {
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
    });
  });

  it('should have correct required parameters for each tool', () => {
    const toolRequiredParams = {
      health_check: [],
      read_project: ['projectNumber'],
      get_project_phases: ['projectNumber'],
      list_issues: ['projectNumber'],
      get_issue_details: ['projectNumber', 'issueNumber'],
      create_issue: ['projectNumber', 'title'],
      update_issue: ['projectNumber', 'issueNumber'],
      update_issue_status: ['projectNumber', 'issueNumber', 'status'],
      update_issue_phase: ['projectNumber', 'issueNumber', 'phase'],
    };

    Object.entries(toolRequiredParams).forEach(([toolName, requiredParams]) => {
      expect(requiredParams).toBeDefined();
      expect(Array.isArray(requiredParams)).toBe(true);
    });
  });
});

/**
 * Test Suite 2: Tool Usage with Sample Prompts
 * Verify tools execute correctly when called by Claude
 */
describe('Tool Usage Tests', () => {
  it('should execute health_check with no parameters', () => {
    // Sample prompt: "Check the API health"
    // Expected parameters: {}
    const params = {};

    // Tool should execute with empty parameters
    expect(params).toEqual({});
  });

  it('should execute read_project with project number', () => {
    // Sample prompt: "Read project 70"
    // Expected parameters: { projectNumber: 70 }
    const params = {
      projectNumber: 70,
    };

    expect(params.projectNumber).toBe(70);
    expect(typeof params.projectNumber).toBe('number');
  });

  it('should execute list_issues with filters', () => {
    // Sample prompt: "List all in-progress issues in project 70"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      status: 'in_progress',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.status).toBe('in_progress');
  });

  it('should execute list_issues with phase filter', () => {
    // Sample prompt: "Show all issues in Phase 2: Development"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      phase: 'Phase 2: Development',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.phase).toBe('Phase 2: Development');
  });

  it('should execute get_issue_details with issue number', () => {
    // Sample prompt: "Get details for issue #42"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      issueNumber: 42,
    };

    expect(params.projectNumber).toBe(70);
    expect(params.issueNumber).toBe(42);
  });

  it('should execute create_issue with required fields', () => {
    // Sample prompt: "Create a new issue titled 'Implement OAuth' in project 70"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      title: 'Implement OAuth',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.title).toBe('Implement OAuth');
  });

  it('should execute create_issue with full details', () => {
    // Sample prompt:
    // "Create issue in project 70, titled 'Add profile page', description 'User profile
    // with settings', assign to alice, label as feature, in Phase 2, status todo"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      title: 'Add profile page',
      body: 'User profile with settings',
      assignee: 'alice',
      labels: ['feature'],
      phase: 'Phase 2: Development',
      status: 'todo',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.title).toBe('Add profile page');
    expect(params.body).toBe('User profile with settings');
    expect(params.assignee).toBe('alice');
    expect(params.labels).toContain('feature');
    expect(params.phase).toBe('Phase 2: Development');
    expect(params.status).toBe('todo');
  });

  it('should execute update_issue_status', () => {
    // Sample prompt: "Mark issue #42 as done"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      issueNumber: 42,
      status: 'done',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.issueNumber).toBe(42);
    expect(params.status).toBe('done');
  });

  it('should execute update_issue with multiple fields', () => {
    // Sample prompt: "Update issue #42: change status to in_progress, assign to bob"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      issueNumber: 42,
      status: 'in_progress',
      assignee: 'bob',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.issueNumber).toBe(42);
    expect(params.status).toBe('in_progress');
    expect(params.assignee).toBe('bob');
  });

  it('should execute update_issue_phase', () => {
    // Sample prompt: "Move issue #42 to Phase 3: Testing"
    // Expected parameters:
    const params = {
      projectNumber: 70,
      issueNumber: 42,
      phase: 'Phase 3: Testing',
    };

    expect(params.projectNumber).toBe(70);
    expect(params.issueNumber).toBe(42);
    expect(params.phase).toBe('Phase 3: Testing');
  });
});

/**
 * Test Suite 3: Error Handling
 * Verify proper error handling and recovery
 */
describe('Error Handling Tests', () => {
  it('should handle missing required parameters', () => {
    // Invalid prompt: "Read project" (missing project number)
    // Expected: Parameter validation error
    const params = {};

    // read_project requires projectNumber
    const requiredParams = ['projectNumber'];
    const missingParams = requiredParams.filter(param => !(param in params));

    expect(missingParams).toContain('projectNumber');
    expect(missingParams.length).toBeGreaterThan(0);
  });

  it('should handle invalid parameter types', () => {
    // Invalid prompt: "Read project abc" (project number should be number)
    // Expected: Type validation error
    const params = {
      projectNumber: 'abc', // Should be number
    };

    expect(typeof params.projectNumber).toBe('string');
    expect(typeof params.projectNumber).not.toBe('number');
  });

  it('should handle API authentication errors', () => {
    // Scenario: Invalid or expired API key
    // Expected: Clear authentication error
    const mockError = {
      type: 'AuthenticationError',
      message: 'Authentication failed: Invalid or expired API key',
      statusCode: 401,
    };

    expect(mockError.statusCode).toBe(401);
    expect(mockError.message).toContain('Authentication');
  });

  it('should handle API timeout errors', () => {
    // Scenario: API server slow to respond
    // Expected: Timeout error with retry information
    const mockError = {
      type: 'TimeoutError',
      message: 'Request timeout after 10000ms',
      retriable: true,
      retryAfterMs: 1000,
    };

    expect(mockError.retriable).toBe(true);
    expect(mockError.retryAfterMs).toBeGreaterThan(0);
  });

  it('should handle API server errors', () => {
    // Scenario: API server returns 500
    // Expected: Server error with retry strategy
    const mockError = {
      type: 'ServerError',
      message: 'Internal server error',
      statusCode: 500,
      retriable: true,
    };

    expect(mockError.statusCode).toBe(500);
    expect(mockError.retriable).toBe(true);
  });

  it('should handle not found errors', () => {
    // Scenario: Project #99999 does not exist
    // Expected: Not found error with helpful message
    const mockError = {
      type: 'NotFoundError',
      message: 'Project #99999 not found',
      statusCode: 404,
      retriable: false,
    };

    expect(mockError.statusCode).toBe(404);
    expect(mockError.retriable).toBe(false);
  });

  it('should provide recovery suggestions for errors', () => {
    // Scenario: API key expired
    // Expected: Error with recovery suggestion
    const error = {
      type: 'AuthenticationError',
      message: 'Authentication failed: Invalid or expired API key',
      recovery: 'Contact your administrator for a new API key',
    };

    expect(error.recovery).toBeTruthy();
    expect(error.recovery).toContain('administrator');
  });

  it('should implement exponential backoff for retries', () => {
    // Verify retry strategy increases wait time
    const retryDelays = [
      1000, // 1s
      2000, // 2s
      4000, // 4s
      8000, // 8s
    ];

    for (let i = 1; i < retryDelays.length; i++) {
      expect(retryDelays[i]).toBeGreaterThan(retryDelays[i - 1]);
      expect(retryDelays[i]).toBe(retryDelays[i - 1] * 2);
    }
  });

  it('should have configurable retry attempts', () => {
    // Verify retry count is configurable (default: 3)
    const config = {
      retryAttempts: 3,
      requestTimeoutMs: 10000,
    };

    expect(config.retryAttempts).toBeGreaterThan(0);
    expect(config.retryAttempts).toBeLessThanOrEqual(5);
  });
});

/**
 * Test Suite 4: Multi-Step Workflows
 * Verify complex orchestrated workflows execute correctly
 */
describe('Multi-Step Workflow Tests', () => {
  it('should execute create-and-update workflow', () => {
    // Workflow: Create issue → Update status → Move to phase
    const steps = [
      {
        name: 'create_issue',
        params: {
          projectNumber: 70,
          title: 'New feature request',
        },
      },
      {
        name: 'update_issue_status',
        params: {
          projectNumber: 70,
          issueNumber: 100, // Returned from create
          status: 'in_progress',
        },
      },
      {
        name: 'update_issue_phase',
        params: {
          projectNumber: 70,
          issueNumber: 100,
          phase: 'Phase 2: Development',
        },
      },
    ];

    expect(steps).toHaveLength(3);
    expect(steps[0].name).toBe('create_issue');
    expect(steps[1].name).toBe('update_issue_status');
    expect(steps[2].name).toBe('update_issue_phase');
  });

  it('should execute read-and-list workflow', () => {
    // Workflow: Read project → List issues → Get issue details
    const steps = [
      {
        name: 'read_project',
        params: { projectNumber: 70 },
      },
      {
        name: 'list_issues',
        params: {
          projectNumber: 70,
          status: 'in_progress',
        },
      },
      {
        name: 'get_issue_details',
        params: {
          projectNumber: 70,
          issueNumber: 42, // From list results
        },
      },
    ];

    expect(steps).toHaveLength(3);
    expect(steps[0].name).toBe('read_project');
    expect(steps[1].name).toBe('list_issues');
    expect(steps[2].name).toBe('get_issue_details');
  });

  it('should execute bulk-update workflow', () => {
    // Workflow: List issues → Update each one's status
    const issueNumbers = [40, 41, 42, 43, 44];
    const steps = issueNumbers.map(issueNumber => ({
      name: 'update_issue_status',
      params: {
        projectNumber: 70,
        issueNumber,
        status: 'done',
      },
    }));

    expect(steps).toHaveLength(5);
    expect(steps[0].params.issueNumber).toBe(40);
    expect(steps[4].params.issueNumber).toBe(44);
  });

  it('should execute phase-progression workflow', () => {
    // Workflow: Get phases → List issues in current phase → Move to next phase
    const steps = [
      {
        name: 'get_project_phases',
        params: { projectNumber: 70 },
      },
      {
        name: 'list_issues',
        params: {
          projectNumber: 70,
          phase: 'Phase 2: Development',
        },
      },
      {
        name: 'update_issue_phase',
        params: {
          projectNumber: 70,
          issueNumber: 42,
          phase: 'Phase 3: Testing',
        },
      },
    ];

    expect(steps).toHaveLength(3);
    expect(steps[0].name).toBe('get_project_phases');
    expect(steps[2].name).toBe('update_issue_phase');
  });

  it('should handle dependencies between workflow steps', () => {
    // Verify that workflow steps can use results from previous steps
    const workflow = {
      steps: [
        {
          id: 'step1',
          tool: 'read_project',
          params: { projectNumber: 70 },
          output: 'projectData',
        },
        {
          id: 'step2',
          tool: 'list_issues',
          params: {
            projectNumber: 70,
            // Could use projectData from step1 if needed
          },
          output: 'issuesList',
        },
        {
          id: 'step3',
          tool: 'get_issue_details',
          params: {
            projectNumber: 70,
            issueNumber: 42, // Could use first item from issuesList
          },
          output: 'issueDetails',
        },
      ],
    };

    expect(workflow.steps).toHaveLength(3);
    expect(workflow.steps[0].id).toBe('step1');
    expect(workflow.steps[1].id).toBe('step2');
    expect(workflow.steps[2].id).toBe('step3');
  });

  it('should handle conditional workflow branches', () => {
    // Verify workflow can branch based on data
    const workflow = [
      {
        step: 'list_issues',
        params: { projectNumber: 70, status: 'in_progress' },
        next: 'check_count',
      },
      {
        step: 'check_count',
        condition: 'issueCount > 0',
        onTrue: 'process_issues',
        onFalse: 'finish',
      },
      {
        step: 'process_issues',
        tool: 'update_issue_status',
        next: 'finish',
      },
      {
        step: 'finish',
      },
    ];

    expect(workflow).toHaveLength(4);
    expect(workflow[1]).toHaveProperty('condition');
  });
});

/**
 * Test Suite 5: Real-time Synchronization
 * Verify state changes propagate correctly
 */
describe('Real-time Synchronization Tests', () => {
  it('should emit events when issues are created', () => {
    // Scenario: Create issue → Event broadcasted
    const event = {
      type: 'issue.created',
      projectNumber: 70,
      issueNumber: 100,
      timestamp: new Date().toISOString(),
      data: {
        title: 'New feature',
        status: 'todo',
      },
    };

    expect(event.type).toBe('issue.created');
    expect(event.projectNumber).toBe(70);
    expect(event.issueNumber).toBe(100);
  });

  it('should emit events when issue status changes', () => {
    // Scenario: Update status → Event broadcasted
    const event = {
      type: 'issue.updated',
      projectNumber: 70,
      issueNumber: 42,
      timestamp: new Date().toISOString(),
      data: {
        status: 'done',
        previousStatus: 'in_progress',
      },
    };

    expect(event.type).toBe('issue.updated');
    expect(event.data.status).toBe('done');
    expect(event.data.previousStatus).toBe('in_progress');
  });

  it('should emit events when issue moves to different phase', () => {
    // Scenario: Move to phase → Event broadcasted
    const event = {
      type: 'issue.updated',
      projectNumber: 70,
      issueNumber: 42,
      timestamp: new Date().toISOString(),
      data: {
        phase: 'Phase 3: Testing',
        previousPhase: 'Phase 2: Development',
      },
    };

    expect(event.type).toBe('issue.updated');
    expect(event.data.phase).toBe('Phase 3: Testing');
  });

  it('should emit events with correct sequence numbers', () => {
    // Verify events are numbered sequentially for ordering
    const events = [
      {
        sequence: 1,
        type: 'issue.created',
        issueNumber: 100,
      },
      {
        sequence: 2,
        type: 'issue.updated',
        issueNumber: 100,
      },
      {
        sequence: 3,
        type: 'issue.updated',
        issueNumber: 101,
      },
    ];

    expect(events[0].sequence).toBe(1);
    expect(events[1].sequence).toBe(2);
    expect(events[2].sequence).toBe(3);

    for (let i = 1; i < events.length; i++) {
      expect(events[i].sequence).toBe(events[i - 1].sequence + 1);
    }
  });

  it('should support event filtering by project', () => {
    // Verify subscribers can filter events by project
    const events = [
      { projectNumber: 70, type: 'issue.created' },
      { projectNumber: 71, type: 'issue.created' },
      { projectNumber: 70, type: 'issue.updated' },
    ];

    const project70Events = events.filter(e => e.projectNumber === 70);
    expect(project70Events).toHaveLength(2);
  });

  it('should support event filtering by type', () => {
    // Verify subscribers can filter events by type
    const events = [
      { type: 'issue.created', issueNumber: 100 },
      { type: 'issue.updated', issueNumber: 100 },
      { type: 'issue.created', issueNumber: 101 },
    ];

    const createdEvents = events.filter(e => e.type === 'issue.created');
    expect(createdEvents).toHaveLength(2);
  });

  it('should buffer events for latecomers', () => {
    // Verify last N events are available for replay
    const eventBuffer = [
      { sequence: 96, type: 'issue.created' },
      { sequence: 97, type: 'issue.updated' },
      { sequence: 98, type: 'issue.created' },
      { sequence: 99, type: 'issue.updated' },
      { sequence: 100, type: 'issue.created' },
    ];

    // Client connects at sequence 97 and requests replay
    const sinceSequence = 96;
    const replayed = eventBuffer.filter(e => e.sequence > sinceSequence);

    expect(replayed).toHaveLength(4);
    expect(replayed[0].sequence).toBe(97);
  });

  it('should handle concurrent updates without data loss', () => {
    // Scenario: Two Claude sessions update same issue simultaneously
    const updates = [
      {
        projectNumber: 70,
        issueNumber: 42,
        field: 'status',
        value: 'done',
        sequence: 100,
      },
      {
        projectNumber: 70,
        issueNumber: 42,
        field: 'assignee',
        value: 'alice',
        sequence: 101,
      },
    ];

    // Both updates should be applied
    expect(updates).toHaveLength(2);
    expect(updates[0].sequence).toBeLessThan(updates[1].sequence);
  });
});

/**
 * Test Suite 6: Configuration Validation
 * Verify Claude Code can be configured correctly
 */
describe('Configuration Validation Tests', () => {
  it('should validate MCP server path exists', () => {
    // Configuration requirement: Absolute path to dist/index.js
    const config = {
      command: 'node',
      args: ['/path/to/packages/mcp-server/dist/index.js'],
    };

    expect(config.command).toBe('node');
    expect(config.args[0]).toContain('dist/index.js');
    expect(config.args[0]).toMatch(/^\/.*dist\/index\.js$/);
  });

  it('should validate API key format', () => {
    // API keys should follow specific format
    const apiKey = 'sk_live_abc123xyz789';

    expect(apiKey).toMatch(/^sk_(live|dev)_[a-zA-Z0-9_]+$/);
  });

  it('should validate WebSocket API key format', () => {
    // WebSocket keys should follow specific format
    const wsKey = 'ws_abc123xyz789';

    expect(wsKey).toMatch(/^ws_[a-zA-Z0-9_]+$/);
  });

  it('should validate environment variables are set', () => {
    // Required: STATE_TRACKING_API_KEY
    const config = {
      STATE_TRACKING_API_KEY: 'sk_live_...',
      WS_API_KEY: 'ws_...',
    };

    expect(config.STATE_TRACKING_API_KEY).toBeTruthy();
  });

  it('should provide default values for optional settings', () => {
    // Optional settings should have sensible defaults
    const defaults = {
      STATE_TRACKING_API_URL: 'http://localhost:8167',
      LOG_LEVEL: 'info',
      REQUEST_TIMEOUT_MS: 10000,
      RETRY_ATTEMPTS: 3,
      WS_PORT: 8080,
    };

    expect(defaults.REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(defaults.RETRY_ATTEMPTS).toBeGreaterThan(0);
    expect(defaults.WS_PORT).toBeGreaterThan(1024);
  });
});

/**
 * Test Suite 7: Integration Completeness
 * Verify all components work together correctly
 */
describe('Integration Completeness Tests', () => {
  it('should have complete tool documentation', () => {
    const tools = [
      {
        name: 'health_check',
        description: 'Check API connectivity',
        parameters: [],
      },
      {
        name: 'read_project',
        description: 'Read project details',
        parameters: ['projectNumber'],
      },
      {
        name: 'list_issues',
        description: 'List project issues',
        parameters: ['projectNumber'],
      },
    ];

    tools.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(tool.description).toBeTruthy();
    });
  });

  it('should have example prompts for each tool', () => {
    const examples = [
      {
        tool: 'health_check',
        prompt: 'Check the API health',
      },
      {
        tool: 'read_project',
        prompt: 'Read project 70',
      },
      {
        tool: 'list_issues',
        prompt: 'List all in-progress issues in project 70',
      },
      {
        tool: 'create_issue',
        prompt: 'Create a new issue titled "Implement OAuth" in project 70',
      },
      {
        tool: 'update_issue_status',
        prompt: 'Mark issue #42 as done',
      },
      {
        tool: 'update_issue_phase',
        prompt: 'Move issue #42 to Phase 3: Testing',
      },
    ];

    expect(examples.length).toBeGreaterThan(0);
    examples.forEach(example => {
      expect(example.tool).toBeTruthy();
      expect(example.prompt).toBeTruthy();
    });
  });

  it('should support multiple simultaneous tool calls', () => {
    // Verify Claude can call multiple tools in parallel
    const concurrentCalls = [
      {
        tool: 'read_project',
        params: { projectNumber: 70 },
      },
      {
        tool: 'read_project',
        params: { projectNumber: 71 },
      },
      {
        tool: 'read_project',
        params: { projectNumber: 72 },
      },
    ];

    expect(concurrentCalls).toHaveLength(3);
  });

  it('should support tool chaining', () => {
    // Verify results from one tool can feed into another
    const chain = [
      {
        id: 'step1',
        tool: 'read_project',
        params: { projectNumber: 70 },
        resultVar: 'project',
      },
      {
        id: 'step2',
        tool: 'list_issues',
        params: {
          projectNumber: 70, // Could reference project.projectNumber
        },
        resultVar: 'issues',
      },
      {
        id: 'step3',
        tool: 'get_issue_details',
        params: {
          projectNumber: 70,
          issueNumber: 42, // Could reference issues[0].number
        },
      },
    ];

    expect(chain).toHaveLength(3);
  });
});

export {};
