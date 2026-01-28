import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    ConflictQueueManager,
    ConflictData,
    ConflictStatus,
    initializeConflictQueueManager,
    getConflictQueueManager,
    cleanupConflictQueueManager
} from '../conflict-queue-manager';

suite('ConflictQueueManager Test Suite', () => {
    let tempDir: string;
    let manager: ConflictQueueManager;
    let queueFilePath: string;

    setup(() => {
        // Create a temporary directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conflict-queue-test-'));
        manager = new ConflictQueueManager(tempDir);
        queueFilePath = path.join(tempDir, '.claude-sessions', 'conflict-queue.json');
    });

    teardown(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        cleanupConflictQueueManager();
    });

    test('should create .claude-sessions directory on initialization', () => {
        const sessionsDir = path.join(tempDir, '.claude-sessions');
        assert.strictEqual(fs.existsSync(sessionsDir), true);
    });

    test('should create conflict-queue.json file on initialization', () => {
        assert.strictEqual(fs.existsSync(queueFilePath), true);
    });

    test('should initialize with empty conflict list', async () => {
        const conflicts = await manager.getConflicts();
        assert.strictEqual(conflicts.length, 0);
    });

    test('AC-5.3.a: should add conflict to queue within 30 seconds', async () => {
        const startTime = Date.now();

        const conflictData: ConflictData = {
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['src/file1.ts', 'src/file2.ts'],
            agentId: 'agent-1'
        };

        const conflict = await manager.addConflict(conflictData);
        const elapsed = Date.now() - startTime;

        // Verify conflict was added within 30 seconds (should be much faster)
        assert.ok(elapsed < 30000, `Conflict addition took ${elapsed}ms, exceeding 30s threshold`);

        // Verify conflict properties
        assert.strictEqual(conflict.projectNumber, 79);
        assert.strictEqual(conflict.issueNumber, 42);
        assert.strictEqual(conflict.branchName, 'agent-1/project-42');
        assert.strictEqual(conflict.conflictingFiles.length, 2);
        assert.strictEqual(conflict.status, 'pending');
        assert.strictEqual(conflict.agentId, 'agent-1');
        assert.ok(conflict.conflictId);
        assert.ok(conflict.createdAt);
    });

    test('AC-5.3.b: should display all pending conflicts with file counts', async () => {
        // Add multiple conflicts
        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 1,
            branchName: 'agent-1/project-1',
            conflictingFiles: ['file1.ts', 'file2.ts'],
            agentId: 'agent-1'
        });

        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 2,
            branchName: 'agent-2/project-2',
            conflictingFiles: ['file3.ts'],
            agentId: 'agent-2'
        });

        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 3,
            branchName: 'agent-3/project-3',
            conflictingFiles: ['file4.ts', 'file5.ts', 'file6.ts'],
            agentId: 'agent-3'
        });

        // Get all conflicts
        const conflicts = await manager.getConflicts();

        // Verify all conflicts are returned with correct file counts
        assert.strictEqual(conflicts.length, 3);
        assert.strictEqual(conflicts[0].conflictingFiles.length, 2);
        assert.strictEqual(conflicts[1].conflictingFiles.length, 1);
        assert.strictEqual(conflicts[2].conflictingFiles.length, 3);
    });

    test('AC-5.3.d: should remove conflict when marked as resolved', async () => {
        // Add a conflict
        const conflict = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        // Verify conflict exists
        let conflicts = await manager.getConflicts();
        assert.strictEqual(conflicts.length, 1);

        // Mark as resolved and remove
        await manager.removeConflict(conflict.conflictId);

        // Verify conflict is removed
        conflicts = await manager.getConflicts();
        assert.strictEqual(conflicts.length, 0);
    });

    test('should get conflict by ID', async () => {
        // Add a conflict
        const addedConflict = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        // Retrieve by ID
        const conflict = await manager.getConflictById(addedConflict.conflictId);

        // Verify retrieval
        assert.ok(conflict);
        assert.strictEqual(conflict.conflictId, addedConflict.conflictId);
        assert.strictEqual(conflict.issueNumber, 42);
    });

    test('should return null when conflict ID not found', async () => {
        const conflict = await manager.getConflictById('nonexistent-id');
        assert.strictEqual(conflict, null);
    });

    test('should update conflict status', async () => {
        // Add a conflict
        const conflict = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        // Verify initial status
        assert.strictEqual(conflict.status, 'pending');

        // Update status to resolving
        await manager.updateConflictStatus(conflict.conflictId, 'resolving');

        // Verify status updated
        const updatedConflict = await manager.getConflictById(conflict.conflictId);
        assert.ok(updatedConflict);
        assert.strictEqual(updatedConflict.status, 'resolving');

        // Update status to resolved
        await manager.updateConflictStatus(conflict.conflictId, 'resolved');

        // Verify status updated again
        const resolvedConflict = await manager.getConflictById(conflict.conflictId);
        assert.ok(resolvedConflict);
        assert.strictEqual(resolvedConflict.status, 'resolved');
    });

    test('should throw error when updating nonexistent conflict', async () => {
        await assert.rejects(
            async () => {
                await manager.updateConflictStatus('nonexistent-id', 'resolved');
            },
            /Conflict nonexistent-id not found/
        );
    });

    test('should throw error when removing nonexistent conflict', async () => {
        await assert.rejects(
            async () => {
                await manager.removeConflict('nonexistent-id');
            },
            /Conflict nonexistent-id not found/
        );
    });

    test('should get conflict count', async () => {
        // Initially zero
        let count = await manager.getConflictCount();
        assert.strictEqual(count, 0);

        // Add conflicts
        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 1,
            branchName: 'agent-1/project-1',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 2,
            branchName: 'agent-2/project-2',
            conflictingFiles: ['file2.ts'],
            agentId: 'agent-2'
        });

        // Verify count
        count = await manager.getConflictCount();
        assert.strictEqual(count, 2);
    });

    test('should get conflicts by status', async () => {
        // Add conflicts with different statuses
        const conflict1 = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 1,
            branchName: 'agent-1/project-1',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        const conflict2 = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 2,
            branchName: 'agent-2/project-2',
            conflictingFiles: ['file2.ts'],
            agentId: 'agent-2'
        });

        const conflict3 = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 3,
            branchName: 'agent-3/project-3',
            conflictingFiles: ['file3.ts'],
            agentId: 'agent-3'
        });

        // Update statuses
        await manager.updateConflictStatus(conflict2.conflictId, 'resolving');
        await manager.updateConflictStatus(conflict3.conflictId, 'resolved');

        // Get by status
        const pending = await manager.getConflictsByStatus('pending');
        const resolving = await manager.getConflictsByStatus('resolving');
        const resolved = await manager.getConflictsByStatus('resolved');

        // Verify filtering
        assert.strictEqual(pending.length, 1);
        assert.strictEqual(pending[0].conflictId, conflict1.conflictId);

        assert.strictEqual(resolving.length, 1);
        assert.strictEqual(resolving[0].conflictId, conflict2.conflictId);

        assert.strictEqual(resolved.length, 1);
        assert.strictEqual(resolved[0].conflictId, conflict3.conflictId);
    });

    test('should get conflicts by agent', async () => {
        // Add conflicts for different agents
        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 1,
            branchName: 'agent-1/project-1',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 2,
            branchName: 'agent-1/project-2',
            conflictingFiles: ['file2.ts'],
            agentId: 'agent-1'
        });

        await manager.addConflict({
            projectNumber: 79,
            issueNumber: 3,
            branchName: 'agent-2/project-3',
            conflictingFiles: ['file3.ts'],
            agentId: 'agent-2'
        });

        // Get by agent
        const agent1Conflicts = await manager.getConflictsByAgent('agent-1');
        const agent2Conflicts = await manager.getConflictsByAgent('agent-2');

        // Verify filtering
        assert.strictEqual(agent1Conflicts.length, 2);
        assert.strictEqual(agent2Conflicts.length, 1);
    });

    test('should clear resolved conflicts', async () => {
        // Add conflicts
        const conflict1 = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 1,
            branchName: 'agent-1/project-1',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        const conflict2 = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 2,
            branchName: 'agent-2/project-2',
            conflictingFiles: ['file2.ts'],
            agentId: 'agent-2'
        });

        const conflict3 = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 3,
            branchName: 'agent-3/project-3',
            conflictingFiles: ['file3.ts'],
            agentId: 'agent-3'
        });

        // Mark some as resolved
        await manager.updateConflictStatus(conflict1.conflictId, 'resolved');
        await manager.updateConflictStatus(conflict3.conflictId, 'resolved');

        // Clear resolved
        const removedCount = await manager.clearResolvedConflicts();

        // Verify cleared
        assert.strictEqual(removedCount, 2);

        const remaining = await manager.getConflicts();
        assert.strictEqual(remaining.length, 1);
        assert.strictEqual(remaining[0].conflictId, conflict2.conflictId);
    });

    test('should persist conflicts across manager instances', async () => {
        // Add conflict with first instance
        const conflict = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        // Create new instance
        const newManager = new ConflictQueueManager(tempDir);

        // Verify conflict persisted
        const conflicts = await newManager.getConflicts();
        assert.strictEqual(conflicts.length, 1);
        assert.strictEqual(conflicts[0].conflictId, conflict.conflictId);
        assert.strictEqual(conflicts[0].issueNumber, 42);
    });

    test('should handle global singleton pattern', () => {
        // Initialize global instance
        const globalManager = initializeConflictQueueManager(tempDir);
        assert.ok(globalManager);

        // Get global instance
        const retrievedManager = getConflictQueueManager();
        assert.strictEqual(retrievedManager, globalManager);

        // Cleanup
        cleanupConflictQueueManager();

        // Should throw after cleanup
        assert.throws(() => {
            getConflictQueueManager();
        }, /ConflictQueueManager has not been initialized/);
    });

    test('should handle corrupted queue file gracefully', async () => {
        // Write corrupted JSON to queue file
        fs.writeFileSync(queueFilePath, 'invalid json content', 'utf-8');

        // Create new manager (should handle corruption)
        const newManager = new ConflictQueueManager(tempDir);

        // Should return empty array
        const conflicts = await newManager.getConflicts();
        assert.strictEqual(conflicts.length, 0);
    });

    test('AC-5.3.e: should support abort workflow releasing claim', async () => {
        // This test verifies the conflict queue supports the abort workflow
        // Actual claim release is handled by ProjectQueueManager integration

        // Add conflict
        const conflict = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        // Verify conflict exists
        let conflicts = await manager.getConflicts();
        assert.strictEqual(conflicts.length, 1);

        // Simulate abort: remove conflict (claim release would be handled by provider)
        await manager.removeConflict(conflict.conflictId);

        // Verify conflict removed
        conflicts = await manager.getConflicts();
        assert.strictEqual(conflicts.length, 0);
    });

    test('should generate unique conflict IDs', async () => {
        const conflictIds = new Set<string>();

        // Add multiple conflicts
        for (let i = 0; i < 10; i++) {
            const conflict = await manager.addConflict({
                projectNumber: 79,
                issueNumber: i,
                branchName: `agent-1/project-${i}`,
                conflictingFiles: ['file.ts'],
                agentId: 'agent-1'
            });

            conflictIds.add(conflict.conflictId);
        }

        // Verify all IDs are unique
        assert.strictEqual(conflictIds.size, 10);
    });

    test('should store conflict timestamps', async () => {
        const beforeTime = new Date().toISOString();

        const conflict = await manager.addConflict({
            projectNumber: 79,
            issueNumber: 42,
            branchName: 'agent-1/project-42',
            conflictingFiles: ['file1.ts'],
            agentId: 'agent-1'
        });

        const afterTime = new Date().toISOString();

        // Verify timestamp is within expected range
        assert.ok(conflict.createdAt >= beforeTime);
        assert.ok(conflict.createdAt <= afterTime);
    });
});
