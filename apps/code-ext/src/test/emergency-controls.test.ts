import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EmergencyControls, EmergencyStopResult, RecoveryResult, PurgeResult } from '../emergency-controls';
import { AgentLifecycleManager } from '../agent-lifecycle';
import { AgentSessionManager, AgentSession } from '../agent-session-manager';
import { ProjectQueueManager, ProjectClaim } from '../project-queue-manager';
import { GitHubAPI } from '../github-api';

suite('EmergencyControls Test Suite', () => {
    let emergencyControls: EmergencyControls;
    let lifecycleManager: AgentLifecycleManager;
    let sessionManager: AgentSessionManager;
    let queueManager: ProjectQueueManager;
    let testWorkspaceRoot: string;
    let sessionsDir: string;

    setup(() => {
        // Create temporary test workspace
        testWorkspaceRoot = path.join(__dirname, '..', '..', 'test-workspace-emergency');

        // Clean up if exists
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }

        fs.mkdirSync(testWorkspaceRoot, { recursive: true });

        // Create sessions directory
        sessionsDir = path.join(testWorkspaceRoot, '.claude-sessions');
        fs.mkdirSync(sessionsDir, { recursive: true });

        // Initialize managers
        lifecycleManager = new AgentLifecycleManager(testWorkspaceRoot);
        sessionManager = new AgentSessionManager(testWorkspaceRoot);

        // Create mock GitHub API
        const mockGithubApi = {
            getProjectItems: async () => []
        } as unknown as GitHubAPI;

        queueManager = new ProjectQueueManager(testWorkspaceRoot, mockGithubApi);

        // Initialize emergency controls
        emergencyControls = new EmergencyControls(
            lifecycleManager,
            sessionManager,
            queueManager,
            testWorkspaceRoot
        );
    });

    teardown(() => {
        // Cleanup test workspace
        if (fs.existsSync(testWorkspaceRoot)) {
            try {
                fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
            } catch (error) {
                console.error('Failed to cleanup test workspace:', error);
            }
        }
    });

    /**
     * Helper: Create test session
     */
    async function createTestSession(agentId: number, status: AgentSession['status'] = 'idle'): Promise<void> {
        await sessionManager.createAgentSession(agentId);
        if (status !== 'idle') {
            await sessionManager.updateAgentSession(agentId, { status });
        }
    }

    /**
     * Helper: Create test claim
     */
    async function createTestClaim(agentId: number, projectNumber: number, issueNumber: number): Promise<void> {
        await queueManager.claimProject(projectNumber, issueNumber, `agent-${agentId}`);
    }

    /**
     * Helper: Create stale claim (> 8 hours old)
     */
    async function createStaleClaim(agentId: number, projectNumber: number, issueNumber: number): Promise<void> {
        const claimsPath = path.join(sessionsDir, 'claims.json');
        const claims: any = fs.existsSync(claimsPath)
            ? JSON.parse(fs.readFileSync(claimsPath, 'utf-8'))
            : {};

        const staleDate = new Date(Date.now() - (9 * 60 * 60 * 1000)); // 9 hours ago

        claims[`${projectNumber}-${issueNumber}`] = {
            agentId: `agent-${agentId}`,
            claimedAt: staleDate.toISOString(),
            projectNumber,
            issueNumber
        };

        fs.writeFileSync(claimsPath, JSON.stringify(claims, null, 2), 'utf-8');
    }

    test('AC-5.5.a: Emergency stop shows confirmation with affected agents/projects', async () => {
        // Create test agents and claims
        await createTestSession(1, 'working');
        await createTestSession(2, 'idle');
        await createTestClaim(1, 79, 1);

        // Mock confirmation dialog (simulate cancellation to test the dialog was shown)
        let confirmationShown = false;
        let confirmationMessage = '';

        const originalShowWarningMessage = vscode.window.showWarningMessage;
        (vscode.window as any).showWarningMessage = async (message: string) => {
            confirmationShown = true;
            confirmationMessage = message;
            return 'Cancel'; // Simulate cancellation
        };

        try {
            const result = await emergencyControls.emergencyStopAllAgents(false);

            // Verify confirmation was shown
            assert.strictEqual(confirmationShown, true, 'Confirmation dialog should be shown');
            assert.ok(confirmationMessage.includes('2 total agent(s)'), 'Should show total agents');
            assert.ok(confirmationMessage.includes('1 currently working agent(s)'), 'Should show working agents');
            assert.ok(confirmationMessage.includes('1 active claim(s)'), 'Should show active claims');

            // Result should indicate cancellation
            assert.strictEqual(result.success, false, 'Operation should be cancelled');
        } finally {
            // Restore original function
            (vscode.window as any).showWarningMessage = originalShowWarningMessage;
        }
    });

    test('AC-5.5.b: Emergency stop completes within 5 seconds', async () => {
        // Create test agents
        await createTestSession(1);
        await createTestSession(2);

        // Start agents
        await lifecycleManager.startAgent(1);
        await lifecycleManager.startAgent(2);

        const startTime = Date.now();

        // Execute emergency stop (skip confirmation)
        const result = await emergencyControls.emergencyStopAllAgents(true);

        const duration = Date.now() - startTime;

        // Verify completion within 5 seconds
        assert.ok(duration < 5000, `Emergency stop should complete within 5 seconds (took ${duration}ms)`);
        assert.strictEqual(result.success, true, 'Emergency stop should succeed');
        assert.strictEqual(result.agentsStopped, 2, 'Should stop 2 agents');
    });

    test('AC-5.5.b: All agents stopped after emergency stop', async () => {
        // Create test agents
        await createTestSession(1, 'working');
        await createTestSession(2, 'idle');

        // Start agents
        await lifecycleManager.startAgent(1);
        await lifecycleManager.startAgent(2);

        // Verify agents are running
        assert.strictEqual(lifecycleManager.isAgentRunning(1), true, 'Agent 1 should be running');
        assert.strictEqual(lifecycleManager.isAgentRunning(2), true, 'Agent 2 should be running');

        // Execute emergency stop
        await emergencyControls.emergencyStopAllAgents(true);

        // Verify agents are stopped
        assert.strictEqual(lifecycleManager.isAgentRunning(1), false, 'Agent 1 should be stopped');
        assert.strictEqual(lifecycleManager.isAgentRunning(2), false, 'Agent 2 should be stopped');
    });

    test('AC-5.5.b: All claims released after emergency stop', async () => {
        // Create test claims
        await createTestClaim(1, 79, 1);
        await createTestClaim(2, 79, 2);

        // Verify claims exist
        const claimsBefore = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsBefore.length, 2, 'Should have 2 claims');

        // Execute emergency stop
        const result = await emergencyControls.emergencyStopAllAgents(true);

        // Verify claims released
        const claimsAfter = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsAfter.length, 0, 'All claims should be released');
        assert.strictEqual(result.claimsReleased, 2, 'Should report 2 claims released');
    });

    test('AC-5.5.c: Restart agent clears error and restarts within 10 seconds', async () => {
        // Create agent with error
        await createTestSession(1, 'idle');
        await sessionManager.updateAgentSession(1, {
            lastError: 'Test error',
            errorCount: 3
        });

        // Start agent
        await lifecycleManager.startAgent(1);

        const startTime = Date.now();

        // Restart agent
        await emergencyControls.restartAgent(1);

        const duration = Date.now() - startTime;

        // Verify completion within 10 seconds
        assert.ok(duration < 10000, `Restart should complete within 10 seconds (took ${duration}ms)`);

        // Verify error cleared
        const session = await sessionManager.readAgentSession(1);
        assert.strictEqual(session?.lastError, null, 'Error should be cleared');
        assert.strictEqual(session?.errorCount, 0, 'Error count should be reset');

        // Verify agent restarted
        assert.strictEqual(lifecycleManager.isAgentRunning(1), true, 'Agent should be running');
    });

    test('AC-5.5.d: Reset agent state deletes session and restarts from idle', async () => {
        // Create agent with state
        await createTestSession(1, 'working');
        await sessionManager.updateAgentSession(1, {
            currentProjectNumber: 79,
            currentPhase: 'Phase 1',
            branchName: 'test-branch',
            tasksCompleted: 5,
            lastError: 'Test error',
            errorCount: 2
        });

        // Create claim for this agent
        await createTestClaim(1, 79, 1);

        // Start agent
        await lifecycleManager.startAgent(1);

        // Reset agent state
        await emergencyControls.resetAgentState(1);

        // Verify session recreated with default state
        const session = await sessionManager.readAgentSession(1);
        assert.strictEqual(session?.status, 'idle', 'Status should be idle');
        assert.strictEqual(session?.currentProjectNumber, null, 'Project should be null');
        assert.strictEqual(session?.currentPhase, null, 'Phase should be null');
        assert.strictEqual(session?.branchName, null, 'Branch should be null');
        assert.strictEqual(session?.tasksCompleted, 0, 'Tasks completed should be 0');
        assert.strictEqual(session?.lastError, null, 'Error should be cleared');
        assert.strictEqual(session?.errorCount, 0, 'Error count should be 0');

        // Verify claims released
        const claims = await queueManager.getClaimedProjects('agent-1');
        assert.strictEqual(claims.length, 0, 'Claims should be released');

        // Verify agent restarted
        assert.strictEqual(lifecycleManager.isAgentRunning(1), true, 'Agent should be running');
    });

    test('AC-5.5.e: Stale claims are released automatically', async () => {
        // Create stale claims (> 8 hours old)
        await createStaleClaim(1, 79, 1);
        await createStaleClaim(2, 79, 2);

        // Create fresh claim (< 8 hours old)
        await createTestClaim(3, 79, 3);

        // Verify initial state
        const claimsBefore = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsBefore.length, 3, 'Should have 3 claims');

        // Recover stuck projects
        const result = await emergencyControls.recoverStuckProjects();

        // Verify stale claims released
        assert.strictEqual(result.projectsRecovered, 2, 'Should recover 2 projects');
        assert.strictEqual(result.claimsReleased, 2, 'Should release 2 claims');
        assert.deepStrictEqual(result.issuesReturned.sort(), [1, 2], 'Should return correct issue numbers');

        // Verify fresh claim remains
        const claimsAfter = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsAfter.length, 1, 'Fresh claim should remain');
        assert.strictEqual(claimsAfter[0].issueNumber, 3, 'Fresh claim should be for issue 3');
    });

    test('AC-5.5.f: Emergency operations are logged with timestamp', async () => {
        // Execute various emergency operations
        await emergencyControls.logEmergencyAction('test_action', { foo: 'bar' }, 'success');

        // Read actions log
        const logPath = path.join(sessionsDir, 'emergency-actions.json');
        assert.strictEqual(fs.existsSync(logPath), true, 'Actions log should exist');

        const logContent = fs.readFileSync(logPath, 'utf-8');
        const logEntries = JSON.parse(logContent);

        assert.strictEqual(Array.isArray(logEntries), true, 'Log should be an array');
        assert.strictEqual(logEntries.length, 1, 'Should have 1 log entry');

        const entry = logEntries[0];
        assert.strictEqual(entry.action, 'test_action', 'Action should match');
        assert.ok(entry.timestamp, 'Should have timestamp');
        assert.strictEqual(entry.result, 'success', 'Result should match');
        assert.deepStrictEqual(entry.details, { foo: 'bar' }, 'Details should match');
    });

    test('Emergency stop with no agents returns success', async () => {
        const result = await emergencyControls.emergencyStopAllAgents(true);

        assert.strictEqual(result.success, true, 'Should succeed');
        assert.strictEqual(result.agentsStopped, 0, 'Should stop 0 agents');
        assert.strictEqual(result.claimsReleased, 0, 'Should release 0 claims');
    });

    test('Recover stuck projects with no stale claims', async () => {
        // Create fresh claim
        await createTestClaim(1, 79, 1);

        const result = await emergencyControls.recoverStuckProjects();

        assert.strictEqual(result.projectsRecovered, 0, 'Should recover 0 projects');
        assert.strictEqual(result.claimsReleased, 0, 'Should release 0 claims');
        assert.strictEqual(result.issuesReturned.length, 0, 'Should return 0 issues');
    });

    test('Purge queue clears all claims', async () => {
        // Create multiple claims
        await createTestClaim(1, 79, 1);
        await createTestClaim(2, 79, 2);
        await createTestClaim(3, 79, 3);

        // Verify claims exist
        const claimsBefore = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsBefore.length, 3, 'Should have 3 claims');

        // Purge queue
        const result = await emergencyControls.purgeQueue(true);

        // Verify all claims cleared
        assert.strictEqual(result.success, true, 'Should succeed');
        assert.strictEqual(result.projectsCleared, 3, 'Should clear 3 projects');

        const claimsAfter = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsAfter.length, 0, 'All claims should be cleared');
    });

    test('Get recovery options returns available actions', async () => {
        // Create test scenario
        await createTestSession(1, 'working');
        await createTestSession(2, 'idle');
        await sessionManager.updateAgentSession(2, {
            lastError: 'Test error',
            errorCount: 1
        });

        await createTestClaim(1, 79, 1);
        await createStaleClaim(2, 79, 2);

        // Start agents
        await lifecycleManager.startAgent(1);
        await lifecycleManager.startAgent(2);

        // Get recovery options
        const options = await emergencyControls.getRecoveryOptions();

        assert.ok(options.length > 0, 'Should have recovery options');

        // Verify emergency stop option exists
        const emergencyStop = options.find(o => o.action === 'emergency_stop_all');
        assert.ok(emergencyStop, 'Should have emergency stop option');
        assert.strictEqual(emergencyStop?.requiresConfirmation, true, 'Should require confirmation');

        // Verify restart error agents option exists
        const restartErrors = options.find(o => o.action === 'restart_error_agents');
        assert.ok(restartErrors, 'Should have restart error agents option');

        // Verify recover stuck projects option exists
        const recoverStuck = options.find(o => o.action === 'recover_stuck_projects');
        assert.ok(recoverStuck, 'Should have recover stuck projects option');

        // Verify purge queue option exists
        const purgeQueue = options.find(o => o.action === 'purge_queue');
        assert.ok(purgeQueue, 'Should have purge queue option');
        assert.strictEqual(purgeQueue?.requiresConfirmation, true, 'Should require confirmation');
    });

    test('Check for orphaned sessions detects agents without processes', async () => {
        // Create sessions without starting processes
        await createTestSession(1);
        await createTestSession(2);
        await createTestSession(3);

        // Start only one agent
        await lifecycleManager.startAgent(1);

        // Check for orphaned sessions
        const orphaned = await emergencyControls.checkForOrphanedSessions();

        assert.strictEqual(orphaned.length, 2, 'Should find 2 orphaned sessions');
        assert.ok(orphaned.includes(2), 'Should include agent 2');
        assert.ok(orphaned.includes(3), 'Should include agent 3');
        assert.ok(!orphaned.includes(1), 'Should not include running agent 1');
    });

    test('Cleanup orphaned sessions deletes files and releases claims', async () => {
        // Create orphaned sessions with claims
        await createTestSession(1);
        await createTestSession(2);
        await createTestClaim(1, 79, 1);
        await createTestClaim(2, 79, 2);

        // Verify initial state
        const sessionsBefore = await sessionManager.listAgentSessions();
        const claimsBefore = await queueManager.getAllActiveClaims();
        assert.strictEqual(sessionsBefore.length, 2, 'Should have 2 sessions');
        assert.strictEqual(claimsBefore.length, 2, 'Should have 2 claims');

        // Cleanup orphaned sessions
        const cleaned = await emergencyControls.cleanupOrphanedSessions();

        assert.strictEqual(cleaned, 2, 'Should clean up 2 sessions');

        // Verify sessions deleted
        const sessionsAfter = await sessionManager.listAgentSessions();
        assert.strictEqual(sessionsAfter.length, 0, 'All orphaned sessions should be deleted');

        // Verify claims released
        const claimsAfter = await queueManager.getAllActiveClaims();
        assert.strictEqual(claimsAfter.length, 0, 'All claims should be released');
    });

    test('Restart agent preserves current work', async () => {
        // Create agent with work in progress
        await createTestSession(1, 'working');
        await sessionManager.updateAgentSession(1, {
            currentProjectNumber: 79,
            currentPhase: 'Phase 1',
            branchName: 'test-branch',
            tasksCompleted: 3
        });

        await lifecycleManager.startAgent(1);

        // Restart agent
        await emergencyControls.restartAgent(1);

        // Verify work preserved
        const session = await sessionManager.readAgentSession(1);
        assert.strictEqual(session?.currentProjectNumber, 79, 'Project should be preserved');
        assert.strictEqual(session?.currentPhase, 'Phase 1', 'Phase should be preserved');
        assert.strictEqual(session?.branchName, 'test-branch', 'Branch should be preserved');
        assert.strictEqual(session?.tasksCompleted, 3, 'Tasks completed should be preserved');
    });

    test('Actions log is trimmed to last 100 entries', async () => {
        // Log more than 100 entries
        for (let i = 0; i < 110; i++) {
            await emergencyControls.logEmergencyAction(`test_action_${i}`, { index: i }, 'success');
        }

        // Read log
        const logPath = path.join(sessionsDir, 'emergency-actions.json');
        const logContent = fs.readFileSync(logPath, 'utf-8');
        const logEntries = JSON.parse(logContent);

        assert.strictEqual(logEntries.length, 100, 'Log should be trimmed to 100 entries');

        // Verify oldest entries removed
        const firstEntry = logEntries[0];
        assert.strictEqual(firstEntry.action, 'test_action_10', 'Should keep only last 100 entries');
    });
});
