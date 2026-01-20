/**
 * Load Test Suite for Claude Projects State Tracking API
 *
 * This script uses k6 (https://k6.io/) to perform load testing on the API.
 *
 * Installation:
 *   brew install k6  (macOS)
 *   choco install k6 (Windows)
 *   Or download from https://k6.io/docs/get-started/installation/
 *
 * Usage:
 *   k6 run tests/load/load-test.js
 *   k6 run --vus 50 --duration 60s tests/load/load-test.js
 *
 * Environment Variables:
 *   API_BASE_URL - Base URL of the API (default: http://localhost:3000)
 *   API_KEY - API key for authentication
 *   LOAD_TEST_DURATION - Test duration (default: 5m)
 *   LOAD_TEST_VUS - Virtual users (default: 10)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key-for-load-testing';
const DURATION = __ENV.LOAD_TEST_DURATION || '5m';
const VUS = parseInt(__ENV.LOAD_TEST_VUS) || 10;

// ============================================================================
// Custom Metrics
// ============================================================================

const errorRate = new Rate('errors');
const readOperationTrend = new Trend('read_operation_duration');
const writeOperationTrend = new Trend('write_operation_duration');
const heartbeatTrend = new Trend('heartbeat_duration');
const sessionOperations = new Counter('session_operations');
const taskOperations = new Counter('task_operations');

// ============================================================================
// Load Test Configuration
// ============================================================================

export const options = {
  // Test scenarios
  stages: [
    { duration: '30s', target: VUS / 2 }, // Ramp up to 50% of VUS
    { duration: '1m', target: VUS },      // Ramp up to full VUS
    { duration: DURATION, target: VUS },  // Sustained load
    { duration: '30s', target: 0 },       // Ramp down
  ],

  // Thresholds - Production Requirements
  thresholds: {
    // Response time requirements
    'read_operation_duration': ['p95<500'],  // Read operations < 500ms
    'write_operation_duration': ['p95<2000'], // Write operations < 2s
    'heartbeat_duration': ['p95<1000'],       // Heartbeat < 1s

    // Error rate requirements
    'errors': ['rate<0.01'],  // Error rate < 1%
    'http_req_failed': ['rate<0.01'],

    // Overall performance
    'http_req_duration': ['p95<2000'],

    // Success rate requirements
    'checks': ['rate>0.99'],  // 99% success rate
  },

  // Tear down timeout
  teardownTimeout: '30s',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };
}

function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateMachineId() {
  return `machine-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Test Scenarios
// ============================================================================

export function setup() {
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);

  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('Load test setup complete - API is healthy');

  return {
    startTime: new Date().toISOString(),
  };
}

export default function (data) {
  const sessionId = generateSessionId();
  const machineId = generateMachineId();
  const projectId = `project-${Math.floor(Math.random() * 100)}`;

  // -------------------------------------------------------------------------
  // Scenario 1: Health Check (Lightweight)
  // -------------------------------------------------------------------------
  group('Health Checks', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/health`);
    const duration = Date.now() - start;

    check(res, {
      'health check status 200': (r) => r.status === 200,
      'health check < 200ms': () => duration < 200,
    });

    readOperationTrend.add(duration);
    errorRate.add(res.status !== 200);
  });

  sleep(1);

  // -------------------------------------------------------------------------
  // Scenario 2: Session Lifecycle (Primary Use Case)
  // -------------------------------------------------------------------------
  group('Session Lifecycle', () => {
    // Create session
    let createStart = Date.now();
    const createRes = http.post(
      `${BASE_URL}/api/sessions`,
      JSON.stringify({
        session_id: sessionId,
        project_id: projectId,
        machine_id: machineId,
        status: 'active',
        metadata: {
          vscode_version: '1.85.0',
          extension_version: '0.1.0',
        },
      }),
      { headers: getHeaders() }
    );
    const createDuration = Date.now() - createStart;

    check(createRes, {
      'create session status 201': (r) => r.status === 201,
      'create session has id': (r) => r.json('session_id') !== undefined,
      'create session < 2s': () => createDuration < 2000,
    });

    writeOperationTrend.add(createDuration);
    sessionOperations.add(1);
    errorRate.add(createRes.status !== 201);

    if (createRes.status !== 201) {
      return; // Skip rest of scenario if creation failed
    }

    sleep(0.5);

    // Send heartbeat
    const heartbeatStart = Date.now();
    const heartbeatRes = http.post(
      `${BASE_URL}/api/sessions/${sessionId}/heartbeat`,
      JSON.stringify({
        current_task_id: 'task-1',
      }),
      { headers: getHeaders() }
    );
    const heartbeatDuration = Date.now() - heartbeatStart;

    check(heartbeatRes, {
      'heartbeat status 200': (r) => r.status === 200,
      'heartbeat < 1s': () => heartbeatDuration < 1000,
    });

    heartbeatTrend.add(heartbeatDuration);
    errorRate.add(heartbeatRes.status !== 200);

    sleep(0.5);

    // Get session details
    const getStart = Date.now();
    const getRes = http.get(
      `${BASE_URL}/api/sessions/${sessionId}`,
      { headers: getHeaders() }
    );
    const getDuration = Date.now() - getStart;

    check(getRes, {
      'get session status 200': (r) => r.status === 200,
      'get session has data': (r) => r.json('session_id') === sessionId,
      'get session < 500ms': () => getDuration < 500,
    });

    readOperationTrend.add(getDuration);
    errorRate.add(getRes.status !== 200);

    sleep(0.5);

    // Update session status
    const updateStart = Date.now();
    const updateRes = http.put(
      `${BASE_URL}/api/sessions/${sessionId}`,
      JSON.stringify({
        status: 'completed',
      }),
      { headers: getHeaders() }
    );
    const updateDuration = Date.now() - updateStart;

    check(updateRes, {
      'update session status 200': (r) => r.status === 200,
      'update session < 2s': () => updateDuration < 2000,
    });

    writeOperationTrend.add(updateDuration);
    errorRate.add(updateRes.status !== 200);
  });

  sleep(1);

  // -------------------------------------------------------------------------
  // Scenario 3: Task Operations
  // -------------------------------------------------------------------------
  group('Task Operations', () => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create task
    const createStart = Date.now();
    const createRes = http.post(
      `${BASE_URL}/api/tasks`,
      JSON.stringify({
        task_id: taskId,
        session_id: sessionId,
        project_id: projectId,
        task_name: 'Load test task',
        status: 'in_progress',
      }),
      { headers: getHeaders() }
    );
    const createDuration = Date.now() - createStart;

    check(createRes, {
      'create task status 201': (r) => r.status === 201,
      'create task < 2s': () => createDuration < 2000,
    });

    writeOperationTrend.add(createDuration);
    taskOperations.add(1);
    errorRate.add(createRes.status !== 201);

    sleep(0.5);

    // Get task
    const getStart = Date.now();
    const getRes = http.get(
      `${BASE_URL}/api/tasks/${taskId}`,
      { headers: getHeaders() }
    );
    const getDuration = Date.now() - getStart;

    check(getRes, {
      'get task status 200': (r) => r.status === 200,
      'get task < 500ms': () => getDuration < 500,
    });

    readOperationTrend.add(getDuration);
    errorRate.add(getRes.status !== 200);
  });

  sleep(1);

  // -------------------------------------------------------------------------
  // Scenario 4: List Operations (Pagination)
  // -------------------------------------------------------------------------
  group('List Operations', () => {
    // List sessions
    const listStart = Date.now();
    const listRes = http.get(
      `${BASE_URL}/api/sessions?status=active&limit=20`,
      { headers: getHeaders() }
    );
    const listDuration = Date.now() - listStart;

    check(listRes, {
      'list sessions status 200': (r) => r.status === 200,
      'list sessions has data': (r) => Array.isArray(r.json()),
      'list sessions < 500ms': () => listDuration < 500,
    });

    readOperationTrend.add(listDuration);
    errorRate.add(listRes.status !== 200);
  });

  sleep(2);
}

export function teardown(data) {
  console.log('Load test completed');
  console.log(`Start time: ${data.startTime}`);
  console.log(`End time: ${new Date().toISOString()}`);
}

// ============================================================================
// Additional Test Scenarios (Run Separately)
// ============================================================================

/**
 * Stress Test - Push system beyond normal limits
 * Usage: k6 run --vus 100 --duration 10m tests/load/load-test.js
 */
export function stressTest() {
  // Increase VUS significantly
  // Increase duration
  // Monitor for breaking point
}

/**
 * Spike Test - Sudden traffic spike
 * Usage: k6 run tests/load/load-test.js --stage 0s:100,1m:100,1m:0
 */
export function spikeTest() {
  // Rapid ramp up
  // Brief sustained load
  // Rapid ramp down
}

/**
 * Soak Test - Extended duration test
 * Usage: k6 run --vus 50 --duration 24h tests/load/load-test.js
 */
export function soakTest() {
  // Run for extended period (hours)
  // Monitor for memory leaks
  // Monitor for degradation over time
}
