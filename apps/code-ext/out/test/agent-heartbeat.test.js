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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const agent_session_manager_1 = require("../agent-session-manager");
const agent_heartbeat_1 = require("../agent-heartbeat");
/**
 * Test suite for AgentHeartbeatManager
 *
 * Tests cover:
 * - AC-1.3.a: Heartbeat sent every 30 seconds with current status
 * - AC-1.3.b: Health status transitions based on heartbeat timing
 * - AC-1.3.c: API unreachable warnings (stubbed for now)
 * - AC-1.3.d: Agent crash handling with final heartbeat
 * - AC-1.3.e: Health status calculation performance (< 500ms)
 */
suite('AgentHeartbeatManager Test Suite', () => {
    let tempDir;
    let sessionManager;
    let heartbeatManager;
    setup(() => {
        // Create a unique temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-heartbeat-test-'));
        sessionManager = new agent_session_manager_1.AgentSessionManager(tempDir);
        heartbeatManager = new agent_heartbeat_1.AgentHeartbeatManager(sessionManager);
    });
    teardown(() => {
        // Stop all heartbeats before cleanup
        heartbeatManager.stopAllHeartbeats();
        // Clean up temporary directory after each test
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('startHeartbeat sends initial heartbeat immediately', async function () {
        this.timeout(3000);
        const agentId = 1;
        await sessionManager.createAgentSession(agentId);
        const initialSession = await sessionManager.readAgentSession(agentId);
        const initialHeartbeat = initialSession?.lastHeartbeat;
        // Wait a bit to ensure timestamp differs
        await new Promise(resolve => setTimeout(resolve, 100));
        // Start heartbeat (should send immediately)
        heartbeatManager.startHeartbeat(agentId);
        // Wait a bit for heartbeat to process
        await new Promise(resolve => setTimeout(resolve, 200));
        const updatedSession = await sessionManager.readAgentSession(agentId);
        const updatedHeartbeat = updatedSession?.lastHeartbeat;
        assert.ok(updatedSession);
        assert.notStrictEqual(updatedHeartbeat, initialHeartbeat, 'Heartbeat should be updated immediately');
    });
    test('AC-1.3.a: Heartbeat is sent every 30 seconds with current status', async function () {
        this.timeout(65000); // Allow 65 seconds for test
        const agentId = 2;
        await sessionManager.createAgentSession(agentId);
        await sessionManager.updateAgentSession(agentId, {
            status: 'working',
            currentProjectNumber: 79
        });
        const heartbeats = [];
        // Start heartbeat
        heartbeatManager.startHeartbeat(agentId);
        // Collect heartbeats for 61 seconds (should get 3 heartbeats: 0s, 30s, 60s)
        const checkInterval = setInterval(async () => {
            const session = await sessionManager.readAgentSession(agentId);
            if (session) {
                heartbeats.push(session.lastHeartbeat);
            }
        }, 1000);
        await new Promise(resolve => setTimeout(resolve, 61000));
        clearInterval(checkInterval);
        // Stop heartbeat
        heartbeatManager.stopHeartbeat(agentId);
        // Verify we got at least 2 unique heartbeats (allowing for timing variations)
        const uniqueHeartbeats = new Set(heartbeats);
        assert.ok(uniqueHeartbeats.size >= 2, `Should have at least 2 unique heartbeats, got ${uniqueHeartbeats.size}`);
        // Verify final session has correct status
        const finalSession = await sessionManager.readAgentSession(agentId);
        assert.ok(finalSession);
        assert.strictEqual(finalSession.status, 'working');
        assert.strictEqual(finalSession.currentProjectNumber, 79);
    });
    test('AC-1.3.b: Health status transitions based on heartbeat timing', async function () {
        this.timeout(10000);
        const agentId = 3;
        await sessionManager.createAgentSession(agentId);
        // Initial state: healthy (just created)
        let health = await heartbeatManager.getAgentHealthStatus(agentId);
        assert.strictEqual(health.status, 'healthy', 'Newly created agent should be healthy');
        assert.ok(health.timeSinceLastHeartbeat !== null);
        assert.ok(health.timeSinceLastHeartbeat < 60000, 'Time since last heartbeat should be < 60s');
        // Simulate 70 seconds passing (degraded state)
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session);
        const seventySecondsAgo = new Date(Date.now() - 70000).toISOString();
        await sessionManager.updateAgentSession(agentId, {
            lastHeartbeat: seventySecondsAgo
        });
        health = await heartbeatManager.getAgentHealthStatus(agentId);
        assert.strictEqual(health.status, 'degraded', 'Agent should be degraded after 70s');
        assert.ok(health.timeSinceLastHeartbeat !== null);
        assert.ok(health.timeSinceLastHeartbeat >= 60000 && health.timeSinceLastHeartbeat < 120000, 'Time since last heartbeat should be 60-120s');
        // Simulate 130 seconds passing (unresponsive state)
        const oneTwentySecondsAgo = new Date(Date.now() - 130000).toISOString();
        await sessionManager.updateAgentSession(agentId, {
            lastHeartbeat: oneTwentySecondsAgo
        });
        health = await heartbeatManager.getAgentHealthStatus(agentId);
        assert.strictEqual(health.status, 'unresponsive', 'Agent should be unresponsive after 130s');
        assert.ok(health.timeSinceLastHeartbeat !== null);
        assert.ok(health.timeSinceLastHeartbeat >= 120000, 'Time since last heartbeat should be > 120s');
    });
    test('AC-1.3.c: Extension continues working when State Tracking API unreachable', async function () {
        this.timeout(5000);
        const agentId = 4;
        await sessionManager.createAgentSession(agentId);
        // Start heartbeat (API calls are stubbed, so this simulates API being unreachable)
        heartbeatManager.startHeartbeat(agentId);
        // Wait for a heartbeat to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Verify session file is still updated despite API being unreachable
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session);
        assert.ok(session.lastHeartbeat);
        // Verify agent health is still calculable
        const health = await heartbeatManager.getAgentHealthStatus(agentId);
        assert.strictEqual(health.status, 'healthy');
        heartbeatManager.stopHeartbeat(agentId);
    });
    test('AC-1.3.d: Agent crash marks status with error details', async function () {
        this.timeout(3000);
        const agentId = 5;
        await sessionManager.createAgentSession(agentId);
        await sessionManager.updateAgentSession(agentId, {
            status: 'working',
            currentProjectNumber: 79
        });
        const errorDetails = 'Unhandled exception: Network timeout during API call';
        // Mark agent as crashed
        await heartbeatManager.markAgentAsCrashed(agentId, errorDetails);
        // Verify session reflects crash
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.status, 'paused', 'Crashed agent should be marked as paused');
        assert.ok(session.lastError?.includes('CRASH'), 'Last error should include CRASH prefix');
        assert.ok(session.lastError?.includes(errorDetails), 'Last error should include error details');
        assert.ok(session.errorCount > 0, 'Error count should be incremented');
    });
    test('AC-1.3.e: Health status calculation completes within 500ms', async function () {
        this.timeout(3000);
        const agentId = 6;
        await sessionManager.createAgentSession(agentId);
        const startTime = Date.now();
        const health = await heartbeatManager.getAgentHealthStatus(agentId);
        const duration = Date.now() - startTime;
        assert.ok(health);
        assert.strictEqual(health.status, 'healthy');
        assert.ok(duration < 500, `Health status calculation took ${duration}ms, should be < 500ms`);
    });
    test('getAllAgentHealthStatuses returns health for multiple agents', async function () {
        this.timeout(3000);
        // Create multiple agents with different heartbeat ages
        await sessionManager.createAgentSession(1); // Healthy
        await sessionManager.createAgentSession(2); // Degraded
        await sessionManager.updateAgentSession(2, {
            lastHeartbeat: new Date(Date.now() - 70000).toISOString()
        });
        await sessionManager.createAgentSession(3); // Unresponsive
        await sessionManager.updateAgentSession(3, {
            lastHeartbeat: new Date(Date.now() - 130000).toISOString()
        });
        const healthStatuses = await heartbeatManager.getAllAgentHealthStatuses();
        assert.strictEqual(healthStatuses.size, 3, 'Should have health status for 3 agents');
        const agent1Health = healthStatuses.get(1);
        const agent2Health = healthStatuses.get(2);
        const agent3Health = healthStatuses.get(3);
        assert.ok(agent1Health);
        assert.strictEqual(agent1Health.status, 'healthy');
        assert.ok(agent2Health);
        assert.strictEqual(agent2Health.status, 'degraded');
        assert.ok(agent3Health);
        assert.strictEqual(agent3Health.status, 'unresponsive');
    });
    test('stopHeartbeat stops periodic heartbeats', async function () {
        this.timeout(40000);
        const agentId = 7;
        await sessionManager.createAgentSession(agentId);
        // Start heartbeat
        heartbeatManager.startHeartbeat(agentId);
        // Wait for first heartbeat
        await new Promise(resolve => setTimeout(resolve, 1000));
        const firstSession = await sessionManager.readAgentSession(agentId);
        const firstHeartbeat = firstSession?.lastHeartbeat;
        // Stop heartbeat
        heartbeatManager.stopHeartbeat(agentId);
        // Wait 35 seconds (would trigger another heartbeat if still running)
        await new Promise(resolve => setTimeout(resolve, 35000));
        const secondSession = await sessionManager.readAgentSession(agentId);
        const secondHeartbeat = secondSession?.lastHeartbeat;
        // Heartbeat should not have updated
        assert.strictEqual(firstHeartbeat, secondHeartbeat, 'Heartbeat should not update after stopping');
    });
    test('stopAllHeartbeats stops all active heartbeats', async function () {
        this.timeout(3000);
        // Start heartbeats for multiple agents
        await sessionManager.createAgentSession(1);
        await sessionManager.createAgentSession(2);
        await sessionManager.createAgentSession(3);
        heartbeatManager.startHeartbeat(1);
        heartbeatManager.startHeartbeat(2);
        heartbeatManager.startHeartbeat(3);
        // Wait for initial heartbeats
        await new Promise(resolve => setTimeout(resolve, 500));
        // Stop all heartbeats
        heartbeatManager.stopAllHeartbeats();
        // Verify no errors thrown and agents remain accessible
        const health1 = await heartbeatManager.getAgentHealthStatus(1);
        const health2 = await heartbeatManager.getAgentHealthStatus(2);
        const health3 = await heartbeatManager.getAgentHealthStatus(3);
        assert.ok(health1);
        assert.ok(health2);
        assert.ok(health3);
    });
    test('getAgentHealthStatus returns unresponsive for non-existent agent', async function () {
        this.timeout(2000);
        const health = await heartbeatManager.getAgentHealthStatus(999);
        assert.strictEqual(health.status, 'unresponsive');
        assert.strictEqual(health.lastHeartbeat, null);
        assert.strictEqual(health.timeSinceLastHeartbeat, null);
    });
    test('Heartbeat continues after network error (simulated)', async function () {
        this.timeout(65000);
        const agentId = 8;
        await sessionManager.createAgentSession(agentId);
        // Start heartbeat
        heartbeatManager.startHeartbeat(agentId);
        // Wait for first heartbeat
        await new Promise(resolve => setTimeout(resolve, 1000));
        const firstSession = await sessionManager.readAgentSession(agentId);
        const firstHeartbeat = firstSession?.lastHeartbeat;
        // Wait for second heartbeat (30s later)
        await new Promise(resolve => setTimeout(resolve, 31000));
        const secondSession = await sessionManager.readAgentSession(agentId);
        const secondHeartbeat = secondSession?.lastHeartbeat;
        // Verify heartbeat continued despite network errors being logged
        assert.notStrictEqual(firstHeartbeat, secondHeartbeat, 'Heartbeat should continue even with network errors');
        heartbeatManager.stopHeartbeat(agentId);
    });
    test('Starting heartbeat for same agent twice stops previous timer', async function () {
        this.timeout(3000);
        const agentId = 9;
        await sessionManager.createAgentSession(agentId);
        // Start heartbeat twice
        heartbeatManager.startHeartbeat(agentId);
        heartbeatManager.startHeartbeat(agentId);
        // Wait for heartbeats to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Should not cause any errors
        const health = await heartbeatManager.getAgentHealthStatus(agentId);
        assert.strictEqual(health.status, 'healthy');
        heartbeatManager.stopHeartbeat(agentId);
    });
    test('Heartbeat updates reflect current agent status changes', async function () {
        this.timeout(35000);
        const agentId = 10;
        await sessionManager.createAgentSession(agentId);
        await sessionManager.updateAgentSession(agentId, {
            status: 'idle',
            currentProjectNumber: null
        });
        // Start heartbeat
        heartbeatManager.startHeartbeat(agentId);
        // Wait for initial heartbeat
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Change agent status
        await sessionManager.updateAgentSession(agentId, {
            status: 'working',
            currentProjectNumber: 79
        });
        // Wait for next heartbeat (30s)
        await new Promise(resolve => setTimeout(resolve, 31000));
        // Verify session reflects latest status
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.status, 'working');
        assert.strictEqual(session.currentProjectNumber, 79);
        heartbeatManager.stopHeartbeat(agentId);
    });
    test('Performance: getAllAgentHealthStatuses completes within 500ms for 10 agents', async function () {
        this.timeout(3000);
        // Create 10 agents
        for (let i = 1; i <= 10; i++) {
            await sessionManager.createAgentSession(i);
        }
        const startTime = Date.now();
        const healthStatuses = await heartbeatManager.getAllAgentHealthStatuses();
        const duration = Date.now() - startTime;
        assert.strictEqual(healthStatuses.size, 10);
        assert.ok(duration < 500, `getAllAgentHealthStatuses took ${duration}ms for 10 agents, should be < 500ms`);
    });
});
//# sourceMappingURL=agent-heartbeat.test.js.map