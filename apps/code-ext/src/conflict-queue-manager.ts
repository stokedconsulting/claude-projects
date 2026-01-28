import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Conflict status types
 */
export type ConflictStatus = 'pending' | 'resolving' | 'resolved';

/**
 * Data required to create a conflict entry
 */
export interface ConflictData {
    projectNumber: number;
    issueNumber: number;
    branchName: string;
    conflictingFiles: string[];
    agentId: string;
}

/**
 * Complete conflict item stored in queue
 */
export interface ConflictItem {
    conflictId: string;
    projectNumber: number;
    issueNumber: number;
    branchName: string;
    conflictingFiles: string[];
    status: ConflictStatus;
    createdAt: string;
    agentId: string;
}

/**
 * Structure of the conflict queue file
 */
interface ConflictQueueData {
    conflicts: ConflictItem[];
}

/**
 * Conflict Queue Manager
 *
 * Manages a persistent queue of merge conflicts that require manual resolution.
 * Stores conflicts in .claude-sessions/conflict-queue.json and provides CRUD operations.
 *
 * AC-5.3.a: Conflicts detected by agents appear in queue within 30 seconds
 * AC-5.3.d: Conflicts can be marked as resolved
 * AC-5.3.e: Conflicts can be aborted, releasing issue claims
 */
export class ConflictQueueManager {
    private queueFilePath: string;

    constructor(private workspaceRoot: string) {
        const sessionsDir = path.join(workspaceRoot, '.claude-sessions');

        // Ensure .claude-sessions directory exists
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }

        this.queueFilePath = path.join(sessionsDir, 'conflict-queue.json');

        // Initialize queue file if it doesn't exist
        if (!fs.existsSync(this.queueFilePath)) {
            this.saveQueue({ conflicts: [] });
        }
    }

    /**
     * Load the conflict queue from disk
     * @returns Conflict queue data
     */
    private loadQueue(): ConflictQueueData {
        try {
            const content = fs.readFileSync(this.queueFilePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error('[ConflictQueueManager] Failed to load queue:', error);
            return { conflicts: [] };
        }
    }

    /**
     * Save the conflict queue to disk
     * @param data - Queue data to save
     */
    private saveQueue(data: ConflictQueueData): void {
        try {
            fs.writeFileSync(
                this.queueFilePath,
                JSON.stringify(data, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('[ConflictQueueManager] Failed to save queue:', error);
            throw error;
        }
    }

    /**
     * Add a new conflict to the queue
     * @param conflict - Conflict data to add
     * @returns Created conflict item
     *
     * AC-5.3.a: When conflict is detected by agent → conflict appears in queue within 30 seconds
     */
    public async addConflict(conflict: ConflictData): Promise<ConflictItem> {
        const queue = this.loadQueue();

        const conflictItem: ConflictItem = {
            conflictId: crypto.randomUUID(),
            projectNumber: conflict.projectNumber,
            issueNumber: conflict.issueNumber,
            branchName: conflict.branchName,
            conflictingFiles: conflict.conflictingFiles,
            status: 'pending',
            createdAt: new Date().toISOString(),
            agentId: conflict.agentId
        };

        queue.conflicts.push(conflictItem);
        this.saveQueue(queue);

        console.log(
            `[ConflictQueueManager] Added conflict ${conflictItem.conflictId} for issue #${conflict.issueNumber}`
        );

        return conflictItem;
    }

    /**
     * Get all conflicts from the queue
     * @returns List of all conflicts
     *
     * AC-5.3.b: When user opens conflict resolver → all pending conflicts are displayed
     */
    public async getConflicts(): Promise<ConflictItem[]> {
        const queue = this.loadQueue();
        return queue.conflicts;
    }

    /**
     * Get a specific conflict by ID
     * @param conflictId - ID of the conflict to retrieve
     * @returns Conflict item or null if not found
     */
    public async getConflictById(conflictId: string): Promise<ConflictItem | null> {
        const queue = this.loadQueue();
        const conflict = queue.conflicts.find(c => c.conflictId === conflictId);
        return conflict || null;
    }

    /**
     * Update the status of a conflict
     * @param conflictId - ID of the conflict to update
     * @param status - New status
     *
     * AC-5.3.d: When "Mark Resolved" is clicked → conflict is removed from queue
     */
    public async updateConflictStatus(
        conflictId: string,
        status: ConflictStatus
    ): Promise<void> {
        const queue = this.loadQueue();
        const conflict = queue.conflicts.find(c => c.conflictId === conflictId);

        if (!conflict) {
            throw new Error(`Conflict ${conflictId} not found`);
        }

        conflict.status = status;
        this.saveQueue(queue);

        console.log(`[ConflictQueueManager] Updated conflict ${conflictId} status to ${status}`);
    }

    /**
     * Remove a conflict from the queue
     * @param conflictId - ID of the conflict to remove
     *
     * AC-5.3.d: When user clicks "Mark Resolved" → conflict is removed from queue
     */
    public async removeConflict(conflictId: string): Promise<void> {
        const queue = this.loadQueue();
        const initialLength = queue.conflicts.length;

        queue.conflicts = queue.conflicts.filter(c => c.conflictId !== conflictId);

        if (queue.conflicts.length === initialLength) {
            throw new Error(`Conflict ${conflictId} not found`);
        }

        this.saveQueue(queue);

        console.log(`[ConflictQueueManager] Removed conflict ${conflictId}`);
    }

    /**
     * Get the count of conflicts (useful for badge display)
     * @returns Total number of conflicts in queue
     */
    public async getConflictCount(): Promise<number> {
        const queue = this.loadQueue();
        return queue.conflicts.length;
    }

    /**
     * Get conflicts filtered by status
     * @param status - Status to filter by
     * @returns List of conflicts with the specified status
     */
    public async getConflictsByStatus(status: ConflictStatus): Promise<ConflictItem[]> {
        const queue = this.loadQueue();
        return queue.conflicts.filter(c => c.status === status);
    }

    /**
     * Get conflicts for a specific agent
     * @param agentId - Agent ID to filter by
     * @returns List of conflicts for the specified agent
     */
    public async getConflictsByAgent(agentId: string): Promise<ConflictItem[]> {
        const queue = this.loadQueue();
        return queue.conflicts.filter(c => c.agentId === agentId);
    }

    /**
     * Clear all resolved conflicts from the queue
     * Useful for cleanup operations
     */
    public async clearResolvedConflicts(): Promise<number> {
        const queue = this.loadQueue();
        const initialLength = queue.conflicts.length;

        queue.conflicts = queue.conflicts.filter(c => c.status !== 'resolved');
        this.saveQueue(queue);

        const removedCount = initialLength - queue.conflicts.length;
        console.log(`[ConflictQueueManager] Cleared ${removedCount} resolved conflicts`);

        return removedCount;
    }
}

/**
 * Global conflict queue manager instance (singleton pattern)
 */
let globalConflictQueueManager: ConflictQueueManager | null = null;

/**
 * Initialize the global conflict queue manager instance
 * @param workspaceRoot - Root directory of the workspace
 */
export function initializeConflictQueueManager(workspaceRoot: string): ConflictQueueManager {
    globalConflictQueueManager = new ConflictQueueManager(workspaceRoot);
    return globalConflictQueueManager;
}

/**
 * Get the global conflict queue manager instance
 * @throws Error if manager has not been initialized
 */
export function getConflictQueueManager(): ConflictQueueManager {
    if (!globalConflictQueueManager) {
        throw new Error('ConflictQueueManager has not been initialized. Call initializeConflictQueueManager() first.');
    }
    return globalConflictQueueManager;
}

/**
 * Cleanup the global conflict queue manager instance
 */
export function cleanupConflictQueueManager(): void {
    globalConflictQueueManager = null;
}
