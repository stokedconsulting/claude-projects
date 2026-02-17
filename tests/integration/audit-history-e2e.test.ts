/**
 * Audit History End-to-End Integration Tests
 *
 * Phase 4.5: End-to-End Integration Testing
 *
 * Comprehensive test suite validating the complete audit history system including:
 * - Audit interceptor write functionality
 * - Project event audit recording
 * - WebSocket broadcast integration
 * - Workspace filtering
 * - Pagination
 * - End-to-end latency
 *
 * These tests run against a live API + MongoDB instance but skip gracefully if unavailable.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_WORKSPACE_ID = `test-ws-${Date.now()}`;
const TEST_PROJECT_NUMBER = 999;

let apiAvailable = false;

beforeAll(async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    apiAvailable = response.ok;

    if (apiAvailable) {
      console.log('✅ API is available, running E2E tests');
    } else {
      console.log('⚠️  API returned non-OK status, skipping E2E tests');
    }
  } catch (error) {
    apiAvailable = false;
    console.log('⚠️  API not available, skipping E2E tests');
  }
}, 10000);

function skipIfNoApi() {
  if (!apiAvailable) {
    console.log('Skipping: API not available');
    return true;
  }
  return false;
}

/**
 * Test Suite 1: Audit Interceptor Write
 * Verify that API requests create audit records
 */
describe('Audit Interceptor Write Tests', () => {
  const testAuditIds: string[] = [];

  afterAll(async () => {
    if (!apiAvailable) return;

    // Cleanup: Delete test audit records
    // Note: Actual cleanup would require a DELETE endpoint or direct DB access
    console.log(`Test audit records created: ${testAuditIds.length}`);
  });

  it('should create audit record for POST request with workspace headers', async () => {
    if (skipIfNoApi()) return;

    const testWorktreePath = `/tmp/test-worktree-${Date.now()}`;

    // Make a POST request to create a project event with workspace headers
    const eventPayload = {
      type: 'task.completed',
      data: {
        projectNumber: TEST_PROJECT_NUMBER,
        taskId: 'test-task-1',
        workspaceId: TEST_WORKSPACE_ID,
        worktreePath: testWorktreePath,
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/api/events/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': TEST_WORKSPACE_ID,
        'X-Worktree-Path': testWorktreePath,
      },
      body: JSON.stringify(eventPayload),
    });

    expect(response.status).toBe(202);

    // Wait briefly for audit record to be written
    await new Promise(resolve => setTimeout(resolve, 500));

    // Query audit history to verify record was created
    const auditResponse = await fetch(
      `${API_BASE_URL}/audit-history?workspaceId=${TEST_WORKSPACE_ID}&limit=10`
    );

    expect(auditResponse.ok).toBe(true);

    const auditData = await auditResponse.json();

    expect(auditData).toHaveProperty('items');
    expect(Array.isArray(auditData.items)).toBe(true);
    expect(auditData.items.length).toBeGreaterThan(0);

    // Verify the audit record contains expected fields
    const auditRecord = auditData.items[0];
    expect(auditRecord).toHaveProperty('audit_id');
    expect(auditRecord).toHaveProperty('workspace_id', TEST_WORKSPACE_ID);
    expect(auditRecord).toHaveProperty('worktree_path', testWorktreePath);
    expect(auditRecord).toHaveProperty('api_endpoint', '/api/events/project');
    expect(auditRecord).toHaveProperty('http_method', 'POST');

    if (auditRecord.audit_id) {
      testAuditIds.push(auditRecord.audit_id);
    }
  }, 15000);

  it('should verify audit record exists when querying GET /api/audit-history', async () => {
    if (skipIfNoApi()) return;

    const response = await fetch(`${API_BASE_URL}/audit-history?limit=5`);

    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit', 5);
    expect(data).toHaveProperty('offset', 0);
    expect(Array.isArray(data.items)).toBe(true);
  });
});

/**
 * Test Suite 2: Project Event Audit
 * Verify that project events are audited correctly
 */
describe('Project Event Audit Tests', () => {
  it('should store task.completed event in audit history with correct operation_type', async () => {
    if (skipIfNoApi()) return;

    const eventPayload = {
      type: 'task.completed',
      data: {
        projectNumber: TEST_PROJECT_NUMBER,
        taskId: 'test-task-2',
        workspaceId: TEST_WORKSPACE_ID,
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/api/events/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    expect(response.status).toBe(202);

    // Wait for audit record
    await new Promise(resolve => setTimeout(resolve, 500));

    // Query audit history for this project
    const auditResponse = await fetch(
      `${API_BASE_URL}/audit-history?projectNumber=${TEST_PROJECT_NUMBER}&limit=10`
    );

    expect(auditResponse.ok).toBe(true);

    const auditData = await auditResponse.json();

    expect(auditData.items.length).toBeGreaterThan(0);

    // Find the task.completed event
    const taskCompletedAudit = auditData.items.find(
      (item: any) => item.operation_type === 'task.completed'
    );

    expect(taskCompletedAudit).toBeDefined();
    expect(taskCompletedAudit.project_number).toBe(TEST_PROJECT_NUMBER);
    expect(taskCompletedAudit.operation_type).toBe('task.completed');
  }, 15000);

  it('should store task.started event in audit history', async () => {
    if (skipIfNoApi()) return;

    const eventPayload = {
      type: 'task.started',
      data: {
        projectNumber: TEST_PROJECT_NUMBER,
        taskId: 'test-task-3',
        workspaceId: TEST_WORKSPACE_ID,
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/api/events/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    expect(response.status).toBe(202);

    // Wait for audit record
    await new Promise(resolve => setTimeout(resolve, 500));

    // Query by project
    const auditResponse = await fetch(
      `${API_BASE_URL}/audit-history/project/${TEST_PROJECT_NUMBER}?limit=10`
    );

    expect(auditResponse.ok).toBe(true);

    const auditData = await auditResponse.json();

    // Find the task.started event
    const taskStartedAudit = auditData.items.find(
      (item: any) => item.operation_type === 'task.started'
    );

    expect(taskStartedAudit).toBeDefined();
    expect(taskStartedAudit.operation_type).toBe('task.started');
  }, 15000);
});

/**
 * Test Suite 3: WebSocket Broadcast Integration
 * Verify that events are broadcast via WebSocket
 */
describe('WebSocket Broadcast Tests', () => {
  let socket: Socket | null = null;

  afterAll(() => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  });

  it('should broadcast project event to subscribed WebSocket clients', async () => {
    if (skipIfNoApi()) return;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (socket) socket.disconnect();
        reject(new Error('Test timeout: Did not receive WebSocket event'));
      }, 10000);

      // Connect to WebSocket
      socket = io(`${API_BASE_URL}`, {
        path: '/orchestration',
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('WebSocket connected');

        // Subscribe to project events
        socket!.emit('subscribeProjects', {
          projectNumbers: [TEST_PROJECT_NUMBER],
        });
      });

      socket.on('subscribedProjects', (data) => {
        console.log('Subscribed to projects:', data);

        // Send a task.started event via HTTP
        fetch(`${API_BASE_URL}/api/events/project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'task.started',
            data: {
              projectNumber: TEST_PROJECT_NUMBER,
              taskId: 'ws-test-task',
              workspaceId: TEST_WORKSPACE_ID,
            },
            timestamp: new Date().toISOString(),
          }),
        }).catch(reject);
      });

      socket.on('project.event', (event) => {
        console.log('Received project.event:', event);

        clearTimeout(timeout);

        // Verify event structure
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event.type).toBe('task.started');
        expect(event.data.projectNumber).toBe(TEST_PROJECT_NUMBER);

        if (socket) socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);
});

/**
 * Test Suite 4: Workspace Filtering
 * Verify that audit records can be filtered by workspace
 */
describe('Workspace Filtering Tests', () => {
  it('should filter audit records by workspace ID', async () => {
    if (skipIfNoApi()) return;

    const workspace1 = `test-ws-1-${Date.now()}`;
    const workspace2 = `test-ws-2-${Date.now()}`;

    // Create audit records for workspace 1
    await fetch(`${API_BASE_URL}/api/events/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace1,
      },
      body: JSON.stringify({
        type: 'task.completed',
        data: {
          projectNumber: TEST_PROJECT_NUMBER,
          taskId: 'ws1-task',
          workspaceId: workspace1,
        },
      }),
    });

    // Create audit records for workspace 2
    await fetch(`${API_BASE_URL}/api/events/project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': workspace2,
      },
      body: JSON.stringify({
        type: 'task.completed',
        data: {
          projectNumber: TEST_PROJECT_NUMBER,
          taskId: 'ws2-task',
          workspaceId: workspace2,
        },
      }),
    });

    // Wait for audit records to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Query workspace 1 records
    const ws1Response = await fetch(
      `${API_BASE_URL}/audit-history/workspace/${workspace1}?limit=20`
    );

    expect(ws1Response.ok).toBe(true);

    const ws1Data = await ws1Response.json();

    // All records should be from workspace 1
    expect(ws1Data.items.length).toBeGreaterThan(0);
    ws1Data.items.forEach((item: any) => {
      expect(item.workspace_id).toBe(workspace1);
    });

    // Query workspace 2 records
    const ws2Response = await fetch(
      `${API_BASE_URL}/audit-history/workspace/${workspace2}?limit=20`
    );

    expect(ws2Response.ok).toBe(true);

    const ws2Data = await ws2Response.json();

    // All records should be from workspace 2
    expect(ws2Data.items.length).toBeGreaterThan(0);
    ws2Data.items.forEach((item: any) => {
      expect(item.workspace_id).toBe(workspace2);
    });
  }, 20000);
});

/**
 * Test Suite 5: Pagination
 * Verify that pagination works correctly
 */
describe('Pagination Tests', () => {
  beforeAll(async () => {
    if (!apiAvailable) return;

    // Create multiple audit records for pagination testing
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(
        fetch(`${API_BASE_URL}/api/events/project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'task.completed',
            data: {
              projectNumber: TEST_PROJECT_NUMBER,
              taskId: `pagination-test-${i}`,
              workspaceId: TEST_WORKSPACE_ID,
            },
          }),
        })
      );
    }

    await Promise.all(promises);

    // Wait for all audit records to be written
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 60000);

  it('should return correct pagination metadata with limit and offset', async () => {
    if (skipIfNoApi()) return;

    const limit = 10;
    const offset = 5;

    const response = await fetch(
      `${API_BASE_URL}/audit-history?limit=${limit}&offset=${offset}`
    );

    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('limit', limit);
    expect(data).toHaveProperty('offset', offset);

    // Should return at most 'limit' items
    expect(data.items.length).toBeLessThanOrEqual(limit);
  });

  it('should support pagination through large result sets', async () => {
    if (skipIfNoApi()) return;

    const limit = 10;

    // Fetch first page
    const page1Response = await fetch(
      `${API_BASE_URL}/audit-history?limit=${limit}&offset=0`
    );
    const page1Data = await page1Response.json();

    // Fetch second page
    const page2Response = await fetch(
      `${API_BASE_URL}/audit-history?limit=${limit}&offset=${limit}`
    );
    const page2Data = await page2Response.json();

    expect(page1Data.items.length).toBeLessThanOrEqual(limit);
    expect(page2Data.items.length).toBeLessThanOrEqual(limit);

    // Items should be different (assuming there are enough records)
    if (page1Data.items.length > 0 && page2Data.items.length > 0) {
      const page1Ids = page1Data.items.map((item: any) => item.audit_id);
      const page2Ids = page2Data.items.map((item: any) => item.audit_id);

      // Pages should not have overlapping records
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }
  });
});

/**
 * Test Suite 6: End-to-End Latency
 * Verify that the system meets performance requirements
 */
describe('End-to-End Latency Tests', () => {
  it('should deliver WebSocket event within 3 seconds of HTTP POST', async () => {
    if (skipIfNoApi()) return;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (socket) socket.disconnect();
        reject(new Error('Test timeout: Event not delivered within 10 seconds'));
      }, 10000);

      let socket: Socket | null = null;
      let postTime: number;

      // Connect to WebSocket
      socket = io(`${API_BASE_URL}`, {
        path: '/orchestration',
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        // Subscribe to project events
        socket!.emit('subscribeProjects', {
          projectNumbers: [TEST_PROJECT_NUMBER],
        });
      });

      socket.on('subscribedProjects', () => {
        // Record start time and send event
        postTime = Date.now();

        fetch(`${API_BASE_URL}/api/events/project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'task.completed',
            data: {
              projectNumber: TEST_PROJECT_NUMBER,
              taskId: 'latency-test',
              workspaceId: TEST_WORKSPACE_ID,
            },
            timestamp: new Date().toISOString(),
          }),
        }).catch(reject);
      });

      socket.on('project.event', (event) => {
        if (event.data.taskId === 'latency-test') {
          clearTimeout(timeout);

          const receiveTime = Date.now();
          const latency = receiveTime - postTime;

          console.log(`End-to-end latency: ${latency}ms`);

          // Verify latency is under 3 seconds
          expect(latency).toBeLessThan(3000);

          if (socket) socket.disconnect();
          resolve();
        }
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);
});

export {};
