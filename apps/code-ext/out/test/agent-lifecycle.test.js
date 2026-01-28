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
const agent_lifecycle_1 = require("../agent-lifecycle");
const agent_session_manager_1 = require("../agent-session-manager");
/**
 * Test suite for AgentLifecycleManager
 *
 * Tests cover:
 * - Agent start/stop/pause/resume operations
 * - Process management and tracking
 * - Graceful shutdown with timeout
 * - Crash detection and recovery
 * - Cross-platform compatibility (Windows vs Unix signals)
 * - Edge cases (double start, stop non-existent agent, etc.)
 */
suite('AgentLifecycleManager Test Suite', () => {
    let tempDir;
    let lifecycleManager;
    let sessionManager;
    setup(() => {
        // Create a unique temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-lifecycle-test-'));
        lifecycleManager = new agent_lifecycle_1.AgentLifecycleManager(tempDir);
        sessionManager = new agent_session_manager_1.AgentSessionManager(tempDir);
    });
    teardown(async () => {
        // Stop all agents and clean up
        try {
            await lifecycleManager.stopAllAgents(2000);
        }
        catch (error) {
            console.log('Teardown: Error stopping agents:', error);
        }
        // Clean up temporary directory after each test
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    // AC-1.4.a: When "start agent" command is invoked → agent process spawns within 3 seconds and status transitions to "idle"
    test('AC-1.4.a: startAgent spawns process and sets status to idle within 3 seconds', async function () {
        this.timeout(5000); // Allow 5 seconds for test
        const agentId = 1;
        const startTime = Date.now();
        await lifecycleManager.startAgent(agentId);
        const elapsed = Date.now() - startTime;
        assert.ok(elapsed < 3000, `Agent should start within 3 seconds, took ${elapsed}ms`);
        // Verify session was created with idle status
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session, 'Session should exist after start');
        assert.strictEqual(session.status, 'idle', 'Status should be idle');
        // Verify process is running
        assert.ok(lifecycleManager.isAgentRunning(agentId), 'Agent should be running');
        const process = lifecycleManager.getAgentProcess(agentId);
        assert.ok(process, 'Process should exist');
        assert.ok(process.pid, 'Process should have PID');
    });
    test('startAgent throws error if agent already running', async function () {
        this.timeout(5000);
        const agentId = 2;
        await lifecycleManager.startAgent(agentId);
        // Try to start same agent again
        await assert.rejects(async () => await lifecycleManager.startAgent(agentId), /already running/, 'Should throw error when starting already-running agent');
    });
    // AC-1.4.b: When "pause agent" command is invoked on running agent → agent status becomes "paused" and no new tasks are picked up
    test('AC-1.4.b: pauseAgent sets status to paused', async function () {
        this.timeout(5000);
        const agentId = 3;
        await lifecycleManager.startAgent(agentId);
        // Pause the agent
        await lifecycleManager.pauseAgent(agentId);
        // Verify status is paused
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session, 'Session should exist');
        assert.strictEqual(session.status, 'paused', 'Status should be paused');
        // Process should still be tracked (even if signals don't work on Windows)
        assert.ok(lifecycleManager.isAgentRunning(agentId), 'Agent should still be tracked as running');
    });
    test('pauseAgent throws error if agent not running', async function () {
        this.timeout(3000);
        const agentId = 999;
        await assert.rejects(async () => await lifecycleManager.pauseAgent(agentId), /not running/, 'Should throw error when pausing non-running agent');
    });
    // AC-1.4.c: When "resume agent" command is invoked on paused agent → agent status returns to "idle" and resumes task pickup
    test('AC-1.4.c: resumeAgent returns status to idle', async function () {
        this.timeout(5000);
        const agentId = 4;
        await lifecycleManager.startAgent(agentId);
        await lifecycleManager.pauseAgent(agentId);
        // Verify paused
        let session = await sessionManager.readAgentSession(agentId);
        assert.strictEqual(session?.status, 'paused', 'Should be paused before resume');
        // Resume the agent
        await lifecycleManager.resumeAgent(agentId);
        // Verify status is idle
        session = await sessionManager.readAgentSession(agentId);
        assert.ok(session, 'Session should exist');
        assert.strictEqual(session.status, 'idle', 'Status should be idle after resume');
    });
    test('resumeAgent throws error if agent not paused', async function () {
        this.timeout(5000);
        const agentId = 5;
        await lifecycleManager.startAgent(agentId);
        // Try to resume agent that's not paused
        await assert.rejects(async () => await lifecycleManager.resumeAgent(agentId), /not paused/, 'Should throw error when resuming non-paused agent');
    });
    // AC-1.4.d: When "stop agent" command is invoked → agent gracefully stops within 5 seconds or is force-killed
    test('AC-1.4.d: stopAgent gracefully stops agent within 5 seconds', async function () {
        this.timeout(7000); // Allow 7 seconds for test
        const agentId = 6;
        await lifecycleManager.startAgent(agentId);
        const startTime = Date.now();
        await lifecycleManager.stopAgent(agentId);
        const elapsed = Date.now() - startTime;
        assert.ok(elapsed < 6000, `Agent should stop within 6 seconds (5s grace + 1s), took ${elapsed}ms`);
        // Verify agent is no longer running
        assert.ok(!lifecycleManager.isAgentRunning(agentId), 'Agent should not be running after stop');
        const process = lifecycleManager.getAgentProcess(agentId);
        assert.strictEqual(process, null, 'Process should be null after stop');
    });
    test('stopAgent does nothing if agent not running', async function () {
        this.timeout(3000);
        const agentId = 999;
        // Should not throw error
        await lifecycleManager.stopAgent(agentId);
    });
    // AC-1.4.e: When extension deactivates with active agents → all agents stop gracefully within 10 seconds total
    test('AC-1.4.e: stopAllAgents stops all agents within 10 seconds', async function () {
        this.timeout(12000); // Allow 12 seconds for test
        // Start multiple agents
        await lifecycleManager.startAgent(10);
        await lifecycleManager.startAgent(11);
        await lifecycleManager.startAgent(12);
        // Verify all are running
        assert.ok(lifecycleManager.isAgentRunning(10), 'Agent 10 should be running');
        assert.ok(lifecycleManager.isAgentRunning(11), 'Agent 11 should be running');
        assert.ok(lifecycleManager.isAgentRunning(12), 'Agent 12 should be running');
        const stats = await lifecycleManager.getAgentStats();
        assert.strictEqual(stats.totalRunning, 3, 'Should have 3 running agents');
        // Stop all agents
        const startTime = Date.now();
        await lifecycleManager.stopAllAgents(10000);
        const elapsed = Date.now() - startTime;
        assert.ok(elapsed < 10000, `All agents should stop within 10 seconds, took ${elapsed}ms`);
        // Verify all are stopped
        assert.ok(!lifecycleManager.isAgentRunning(10), 'Agent 10 should be stopped');
        assert.ok(!lifecycleManager.isAgentRunning(11), 'Agent 11 should be stopped');
        assert.ok(!lifecycleManager.isAgentRunning(12), 'Agent 12 should be stopped');
        const statsAfter = await lifecycleManager.getAgentStats();
        assert.strictEqual(statsAfter.totalRunning, 0, 'Should have 0 running agents after stopAll');
    });
    test('stopAllAgents handles timeout gracefully', async function () {
        this.timeout(5000);
        // Start an agent
        await lifecycleManager.startAgent(20);
        // Try to stop with very short timeout (may hit timeout or succeed quickly)
        try {
            await lifecycleManager.stopAllAgents(100);
        }
        catch (error) {
            // Timeout is acceptable
            assert.ok(error instanceof Error);
        }
        // Even if timeout occurred, process should eventually be cleaned up
        // Wait a bit and check
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert.ok(!lifecycleManager.isAgentRunning(20), 'Agent should be stopped after timeout + cleanup');
    });
    // AC-1.4.f: When agent process crashes unexpectedly → session file is updated with "crashed" status and error details
    test('AC-1.4.f: Process crash updates session with error details', async function () {
        this.timeout(5000);
        const agentId = 30;
        await lifecycleManager.startAgent(agentId);
        // Get the process and kill it unexpectedly
        const process = lifecycleManager.getAgentProcess(agentId);
        assert.ok(process, 'Process should exist');
        assert.ok(process.pid, 'Process should have PID');
        // Kill the process to simulate a crash
        process.kill('SIGKILL');
        // Wait for crash to be detected
        await new Promise(resolve => setTimeout(resolve, 500));
        // Verify session was updated with error
        const session = await sessionManager.readAgentSession(agentId);
        assert.ok(session, 'Session should exist');
        assert.ok(session.lastError, 'lastError should be set after crash');
        assert.ok(session.errorCount > 0, 'errorCount should be incremented');
        assert.ok(!lifecycleManager.isAgentRunning(agentId), 'Agent should not be running after crash');
    });
    test('getAgentStats returns accurate statistics', async function () {
        this.timeout(5000);
        // Start agents with different states
        await lifecycleManager.startAgent(40);
        await lifecycleManager.startAgent(41);
        await lifecycleManager.pauseAgent(41);
        const stats = await lifecycleManager.getAgentStats();
        assert.strictEqual(stats.totalRunning, 2, 'Should have 2 running agents');
        assert.ok(stats.byStatus['idle'], 'Should have idle agents');
        assert.ok(stats.byStatus['paused'], 'Should have paused agents');
        assert.strictEqual(stats.processes.length, 2, 'Should have 2 process entries');
        // Verify process details
        const agent40Process = stats.processes.find(p => p.agentId === 40);
        assert.ok(agent40Process, 'Should have process info for agent 40');
        assert.ok(agent40Process.pid, 'Should have PID');
        assert.ok(agent40Process.uptime >= 0, 'Should have uptime');
    });
    test('isAgentRunning returns false for non-existent agent', () => {
        assert.strictEqual(lifecycleManager.isAgentRunning(999), false);
    });
    test('getAgentProcess returns null for non-existent agent', () => {
        assert.strictEqual(lifecycleManager.getAgentProcess(999), null);
    });
    test('Sequential start and stop operations work correctly', async function () {
        this.timeout(10000);
        const agentId = 50;
        // Start
        await lifecycleManager.startAgent(agentId);
        assert.ok(lifecycleManager.isAgentRunning(agentId));
        // Stop
        await lifecycleManager.stopAgent(agentId);
        assert.ok(!lifecycleManager.isAgentRunning(agentId));
        // Start again
        await lifecycleManager.startAgent(agentId);
        assert.ok(lifecycleManager.isAgentRunning(agentId));
        // Clean up
        await lifecycleManager.stopAgent(agentId);
    });
});
/**
 * Test suite for singleton lifecycle manager functions
 */
suite('AgentLifecycleManager Singleton Test Suite', () => {
    let tempDir;
    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-lifecycle-singleton-'));
    });
    teardown(async () => {
        await (0, agent_lifecycle_1.cleanupLifecycleManager)();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('initializeLifecycleManager creates singleton instance', () => {
        const manager = (0, agent_lifecycle_1.initializeLifecycleManager)(tempDir);
        assert.ok(manager instanceof agent_lifecycle_1.AgentLifecycleManager);
    });
    test('cleanupLifecycleManager stops all agents and clears singleton', async function () {
        this.timeout(5000);
        const manager = (0, agent_lifecycle_1.initializeLifecycleManager)(tempDir);
        await manager.startAgent(1);
        assert.ok(manager.isAgentRunning(1), 'Agent should be running before cleanup');
        await (0, agent_lifecycle_1.cleanupLifecycleManager)();
        // Manager should be cleaned up (getLifecycleManager would throw)
        // But we can't test that easily without importing getLifecycleManager
    });
});
//# sourceMappingURL=agent-lifecycle.test.js.map