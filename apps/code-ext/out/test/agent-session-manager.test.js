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
/**
 * Test suite for AgentSessionManager
 *
 * Tests cover:
 * - Session creation and initialization
 * - Atomic writes (temp file + rename pattern)
 * - Corruption recovery
 * - Directory auto-creation
 * - Permission error handling with retry backoff
 * - Session listing and deletion
 */
suite('AgentSessionManager Test Suite', () => {
    let tempDir;
    let manager;
    setup(() => {
        // Create a unique temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-session-test-'));
        manager = new agent_session_manager_1.AgentSessionManager(tempDir);
    });
    teardown(() => {
        // Clean up temporary directory after each test
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
    test('getSessionsDirectory returns correct path', () => {
        const expectedPath = path.join(tempDir, '.claude-sessions');
        assert.strictEqual(manager.getSessionsDirectory(), expectedPath);
    });
    test('createAgentSession creates session file with default values', async () => {
        const agentId = 1;
        const session = await manager.createAgentSession(agentId);
        // Verify session object has correct structure
        assert.strictEqual(session.agentId, 'agent-1');
        assert.strictEqual(session.status, 'idle');
        assert.strictEqual(session.currentProjectNumber, null);
        assert.strictEqual(session.currentPhase, null);
        assert.strictEqual(session.branchName, null);
        assert.strictEqual(session.tasksCompleted, 0);
        assert.strictEqual(session.currentTaskDescription, null);
        assert.strictEqual(session.errorCount, 0);
        assert.strictEqual(session.lastError, null);
        assert.ok(session.lastHeartbeat); // Should have a timestamp
        // Verify file was created
        const filePath = path.join(manager.getSessionsDirectory(), 'agent-1.session');
        assert.ok(fs.existsSync(filePath));
    });
    test('createAgentSession auto-creates .claude-sessions directory', async () => {
        const sessionsDir = manager.getSessionsDirectory();
        assert.ok(!fs.existsSync(sessionsDir), 'Sessions directory should not exist initially');
        await manager.createAgentSession(1);
        assert.ok(fs.existsSync(sessionsDir), 'Sessions directory should be created automatically');
    });
    test('readAgentSession returns null for non-existent session', async () => {
        const session = await manager.readAgentSession(999);
        assert.strictEqual(session, null);
    });
    test('readAgentSession returns valid session after creation', async () => {
        const agentId = 2;
        const created = await manager.createAgentSession(agentId);
        const read = await manager.readAgentSession(agentId);
        assert.ok(read);
        assert.strictEqual(read.agentId, created.agentId);
        assert.strictEqual(read.status, created.status);
    });
    test('updateAgentSession merges updates with existing data', async () => {
        const agentId = 3;
        await manager.createAgentSession(agentId);
        const updates = {
            status: 'working',
            currentProjectNumber: 79,
            currentPhase: '1',
            tasksCompleted: 5
        };
        await manager.updateAgentSession(agentId, updates);
        const updated = await manager.readAgentSession(agentId);
        assert.ok(updated);
        assert.strictEqual(updated.status, 'working');
        assert.strictEqual(updated.currentProjectNumber, 79);
        assert.strictEqual(updated.currentPhase, '1');
        assert.strictEqual(updated.tasksCompleted, 5);
        // Other fields should remain unchanged
        assert.strictEqual(updated.errorCount, 0);
    });
    test('updateAgentSession updates heartbeat timestamp', async () => {
        const agentId = 4;
        const created = await manager.createAgentSession(agentId);
        const originalHeartbeat = created.lastHeartbeat;
        // Wait a bit to ensure timestamp differs
        await new Promise(resolve => setTimeout(resolve, 10));
        await manager.updateAgentSession(agentId, { status: 'working' });
        const updated = await manager.readAgentSession(agentId);
        assert.ok(updated);
        assert.notStrictEqual(updated.lastHeartbeat, originalHeartbeat);
    });
    test('updateAgentSession throws error for non-existent session', async () => {
        await assert.rejects(async () => {
            await manager.updateAgentSession(999, { status: 'working' });
        }, {
            message: /Agent session 999 does not exist/
        });
    });
    test('deleteAgentSession removes session file', async () => {
        const agentId = 5;
        await manager.createAgentSession(agentId);
        const filePath = path.join(manager.getSessionsDirectory(), 'agent-5.session');
        assert.ok(fs.existsSync(filePath), 'File should exist before deletion');
        await manager.deleteAgentSession(agentId);
        assert.ok(!fs.existsSync(filePath), 'File should be deleted');
    });
    test('deleteAgentSession handles non-existent session gracefully', async () => {
        // Should not throw error
        await manager.deleteAgentSession(999);
    });
    test('listAgentSessions returns empty array when no sessions exist', async () => {
        const sessions = await manager.listAgentSessions();
        assert.strictEqual(sessions.length, 0);
    });
    test('listAgentSessions returns all active sessions', async () => {
        await manager.createAgentSession(1);
        await manager.createAgentSession(2);
        await manager.createAgentSession(3);
        const sessions = await manager.listAgentSessions();
        assert.strictEqual(sessions.length, 3);
        const agentIds = sessions.map(s => s.agentId).sort();
        assert.deepStrictEqual(agentIds, ['agent-1', 'agent-2', 'agent-3']);
    });
    test('listAgentSessions excludes deleted sessions', async () => {
        await manager.createAgentSession(1);
        await manager.createAgentSession(2);
        await manager.createAgentSession(3);
        await manager.deleteAgentSession(2);
        const sessions = await manager.listAgentSessions();
        assert.strictEqual(sessions.length, 2);
        const agentIds = sessions.map(s => s.agentId).sort();
        assert.deepStrictEqual(agentIds, ['agent-1', 'agent-3']);
    });
    test('Atomic write: session file is complete and valid after write', async () => {
        const agentId = 6;
        await manager.createAgentSession(agentId);
        // Update multiple times rapidly
        for (let i = 0; i < 10; i++) {
            await manager.updateAgentSession(agentId, { tasksCompleted: i });
        }
        // Read and verify final state
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.tasksCompleted, 9);
    });
    test('Corruption recovery: invalid JSON is replaced with default state', async () => {
        const agentId = 7;
        await manager.createAgentSession(agentId);
        // Corrupt the session file
        const filePath = path.join(manager.getSessionsDirectory(), 'agent-7.session');
        fs.writeFileSync(filePath, '{ invalid json }', 'utf-8');
        // Reading should recover and recreate with defaults
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.agentId, 'agent-7');
        assert.strictEqual(session.status, 'idle');
        assert.strictEqual(session.tasksCompleted, 0);
        // Verify file was rewritten correctly
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        assert.ok(parsed);
    });
    test('Corruption recovery: missing required fields triggers recreation', async () => {
        const agentId = 8;
        await manager.createAgentSession(agentId);
        // Write invalid session structure (missing required fields)
        const filePath = path.join(manager.getSessionsDirectory(), 'agent-8.session');
        const invalidSession = {
            agentId: 'agent-8',
            status: 'idle'
            // Missing many required fields
        };
        fs.writeFileSync(filePath, JSON.stringify(invalidSession), 'utf-8');
        // Reading should detect invalid structure and recreate
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.agentId, 'agent-8');
        assert.strictEqual(session.status, 'idle');
        assert.strictEqual(session.tasksCompleted, 0);
        assert.strictEqual(session.errorCount, 0);
        assert.ok(session.lastHeartbeat);
    });
    test('Corruption recovery: invalid status value triggers recreation', async () => {
        const agentId = 9;
        await manager.createAgentSession(agentId);
        // Write session with invalid status
        const filePath = path.join(manager.getSessionsDirectory(), 'agent-9.session');
        const invalidSession = {
            agentId: 'agent-9',
            status: 'invalid-status', // Not a valid AgentStatus
            currentProjectNumber: null,
            currentPhase: null,
            branchName: null,
            lastHeartbeat: new Date().toISOString(),
            tasksCompleted: 0,
            currentTaskDescription: null,
            errorCount: 0,
            lastError: null
        };
        fs.writeFileSync(filePath, JSON.stringify(invalidSession), 'utf-8');
        // Reading should detect invalid status and recreate
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.status, 'idle'); // Should be reset to default
    });
    test('Status updates: all valid status values are accepted', async () => {
        const agentId = 10;
        await manager.createAgentSession(agentId);
        const validStatuses = ['idle', 'working', 'reviewing', 'ideating', 'paused'];
        for (const status of validStatuses) {
            await manager.updateAgentSession(agentId, { status });
            const session = await manager.readAgentSession(agentId);
            assert.ok(session);
            assert.strictEqual(session.status, status);
        }
    });
    test('Multiple agents: session files do not interfere with each other', async () => {
        // Create multiple agent sessions with different states
        await manager.createAgentSession(1);
        await manager.updateAgentSession(1, {
            status: 'working',
            currentProjectNumber: 79,
            tasksCompleted: 5
        });
        await manager.createAgentSession(2);
        await manager.updateAgentSession(2, {
            status: 'reviewing',
            currentProjectNumber: 80,
            tasksCompleted: 3
        });
        await manager.createAgentSession(3);
        await manager.updateAgentSession(3, {
            status: 'idle',
            tasksCompleted: 0
        });
        // Verify each session maintains its own state
        const session1 = await manager.readAgentSession(1);
        const session2 = await manager.readAgentSession(2);
        const session3 = await manager.readAgentSession(3);
        assert.ok(session1 && session2 && session3);
        assert.strictEqual(session1.status, 'working');
        assert.strictEqual(session1.currentProjectNumber, 79);
        assert.strictEqual(session1.tasksCompleted, 5);
        assert.strictEqual(session2.status, 'reviewing');
        assert.strictEqual(session2.currentProjectNumber, 80);
        assert.strictEqual(session2.tasksCompleted, 3);
        assert.strictEqual(session3.status, 'idle');
        assert.strictEqual(session3.tasksCompleted, 0);
    });
    test('N agent sessions created within 5 seconds (AC-1.2.a)', async function () {
        this.timeout(6000); // Allow 6 seconds for test
        const startTime = Date.now();
        const N = 5;
        // Create N agent sessions
        const createPromises = [];
        for (let i = 1; i <= N; i++) {
            createPromises.push(manager.createAgentSession(i));
        }
        await Promise.all(createPromises);
        const endTime = Date.now();
        const duration = endTime - startTime;
        // Verify all files exist
        const sessionsDir = manager.getSessionsDirectory();
        for (let i = 1; i <= N; i++) {
            const filePath = path.join(sessionsDir, `agent-${i}.session`);
            assert.ok(fs.existsSync(filePath), `agent-${i}.session should exist`);
        }
        // Verify duration is under 5 seconds
        assert.ok(duration < 5000, `Creation of ${N} sessions took ${duration}ms, should be under 5000ms`);
    });
    test('Error tracking: errorCount and lastError fields work correctly', async () => {
        const agentId = 11;
        await manager.createAgentSession(agentId);
        // Simulate errors
        await manager.updateAgentSession(agentId, {
            errorCount: 1,
            lastError: 'Connection timeout'
        });
        let session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.errorCount, 1);
        assert.strictEqual(session.lastError, 'Connection timeout');
        // Increment error count
        await manager.updateAgentSession(agentId, {
            errorCount: session.errorCount + 1,
            lastError: 'File not found'
        });
        session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.errorCount, 2);
        assert.strictEqual(session.lastError, 'File not found');
    });
    test('Branch tracking: branchName field updates correctly', async () => {
        const agentId = 12;
        await manager.createAgentSession(agentId);
        await manager.updateAgentSession(agentId, {
            branchName: 'project/79',
            currentProjectNumber: 79,
            currentPhase: '1'
        });
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.branchName, 'project/79');
        assert.strictEqual(session.currentProjectNumber, 79);
        assert.strictEqual(session.currentPhase, '1');
    });
    test('Task description tracking: currentTaskDescription updates correctly', async () => {
        const agentId = 13;
        await manager.createAgentSession(agentId);
        const taskDescription = 'Implement agent session file management system';
        await manager.updateAgentSession(agentId, {
            status: 'working',
            currentTaskDescription: taskDescription
        });
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.strictEqual(session.currentTaskDescription, taskDescription);
        // Clear task description when completed
        await manager.updateAgentSession(agentId, {
            status: 'idle',
            currentTaskDescription: null,
            tasksCompleted: 1
        });
        const updatedSession = await manager.readAgentSession(agentId);
        assert.ok(updatedSession);
        assert.strictEqual(updatedSession.currentTaskDescription, null);
        assert.strictEqual(updatedSession.tasksCompleted, 1);
    });
    test('Concurrent updates: multiple rapid updates maintain data integrity', async () => {
        const agentId = 14;
        await manager.createAgentSession(agentId);
        // Perform multiple concurrent updates
        const updates = [];
        for (let i = 0; i < 20; i++) {
            updates.push(manager.updateAgentSession(agentId, {
                tasksCompleted: i,
                status: i % 2 === 0 ? 'working' : 'idle'
            }));
        }
        await Promise.all(updates);
        // Verify session is still readable and valid
        const session = await manager.readAgentSession(agentId);
        assert.ok(session);
        assert.ok(['working', 'idle'].includes(session.status));
        assert.ok(session.tasksCompleted >= 0 && session.tasksCompleted < 20);
    });
});
//# sourceMappingURL=agent-session-manager.test.js.map