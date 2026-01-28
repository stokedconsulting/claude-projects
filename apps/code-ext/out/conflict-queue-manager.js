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
exports.ConflictQueueManager = void 0;
exports.initializeConflictQueueManager = initializeConflictQueueManager;
exports.getConflictQueueManager = getConflictQueueManager;
exports.cleanupConflictQueueManager = cleanupConflictQueueManager;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
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
class ConflictQueueManager {
    workspaceRoot;
    queueFilePath;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
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
    loadQueue() {
        try {
            const content = fs.readFileSync(this.queueFilePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('[ConflictQueueManager] Failed to load queue:', error);
            return { conflicts: [] };
        }
    }
    /**
     * Save the conflict queue to disk
     * @param data - Queue data to save
     */
    saveQueue(data) {
        try {
            fs.writeFileSync(this.queueFilePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
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
    async addConflict(conflict) {
        const queue = this.loadQueue();
        const conflictItem = {
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
        console.log(`[ConflictQueueManager] Added conflict ${conflictItem.conflictId} for issue #${conflict.issueNumber}`);
        return conflictItem;
    }
    /**
     * Get all conflicts from the queue
     * @returns List of all conflicts
     *
     * AC-5.3.b: When user opens conflict resolver → all pending conflicts are displayed
     */
    async getConflicts() {
        const queue = this.loadQueue();
        return queue.conflicts;
    }
    /**
     * Get a specific conflict by ID
     * @param conflictId - ID of the conflict to retrieve
     * @returns Conflict item or null if not found
     */
    async getConflictById(conflictId) {
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
    async updateConflictStatus(conflictId, status) {
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
    async removeConflict(conflictId) {
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
    async getConflictCount() {
        const queue = this.loadQueue();
        return queue.conflicts.length;
    }
    /**
     * Get conflicts filtered by status
     * @param status - Status to filter by
     * @returns List of conflicts with the specified status
     */
    async getConflictsByStatus(status) {
        const queue = this.loadQueue();
        return queue.conflicts.filter(c => c.status === status);
    }
    /**
     * Get conflicts for a specific agent
     * @param agentId - Agent ID to filter by
     * @returns List of conflicts for the specified agent
     */
    async getConflictsByAgent(agentId) {
        const queue = this.loadQueue();
        return queue.conflicts.filter(c => c.agentId === agentId);
    }
    /**
     * Clear all resolved conflicts from the queue
     * Useful for cleanup operations
     */
    async clearResolvedConflicts() {
        const queue = this.loadQueue();
        const initialLength = queue.conflicts.length;
        queue.conflicts = queue.conflicts.filter(c => c.status !== 'resolved');
        this.saveQueue(queue);
        const removedCount = initialLength - queue.conflicts.length;
        console.log(`[ConflictQueueManager] Cleared ${removedCount} resolved conflicts`);
        return removedCount;
    }
}
exports.ConflictQueueManager = ConflictQueueManager;
/**
 * Global conflict queue manager instance (singleton pattern)
 */
let globalConflictQueueManager = null;
/**
 * Initialize the global conflict queue manager instance
 * @param workspaceRoot - Root directory of the workspace
 */
function initializeConflictQueueManager(workspaceRoot) {
    globalConflictQueueManager = new ConflictQueueManager(workspaceRoot);
    return globalConflictQueueManager;
}
/**
 * Get the global conflict queue manager instance
 * @throws Error if manager has not been initialized
 */
function getConflictQueueManager() {
    if (!globalConflictQueueManager) {
        throw new Error('ConflictQueueManager has not been initialized. Call initializeConflictQueueManager() first.');
    }
    return globalConflictQueueManager;
}
/**
 * Cleanup the global conflict queue manager instance
 */
function cleanupConflictQueueManager() {
    globalConflictQueueManager = null;
}
//# sourceMappingURL=conflict-queue-manager.js.map