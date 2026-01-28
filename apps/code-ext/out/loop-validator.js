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
exports.LoopValidator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const category_selector_1 = require("./category-selector");
/**
 * Loop Validator
 *
 * Validates continuous cycle: execute → review → ideate → create → execute
 * Monitors agent health, cycle times, queue depths, and category coverage.
 *
 * AC-4.5.a: When agent completes execution → agent transitions to idle within 60 seconds
 * AC-4.5.b: When review queue is empty and project queue is empty → agent transitions to ideation within 30 seconds
 * AC-4.5.c: When new project is created via ideation → project appears in queue within 2 minutes
 * AC-4.5.d: When loop completes full cycle → cycle time is tracked and < 4 hours average
 * AC-4.5.e: When all 21 categories are enabled → all should be exercised within 30 days
 * AC-4.5.f: When agent is stuck for > 30 minutes → user is notified and diagnostic info logged
 */
class LoopValidator {
    SESSIONS_DIR = '.claude-sessions';
    TRANSITIONS_FILE = 'state-transitions.json';
    MAX_TRANSITIONS_PER_AGENT = 1000;
    STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    TARGET_CYCLE_TIME_MS = 4 * 60 * 60 * 1000; // 4 hours
    CATEGORY_COVERAGE_DAYS = 30;
    workspaceRoot;
    sessionManager;
    projectQueueManager;
    reviewQueueManager;
    constructor(workspaceRoot, sessionManager, projectQueueManager, reviewQueueManager) {
        this.workspaceRoot = workspaceRoot;
        this.sessionManager = sessionManager;
        this.projectQueueManager = projectQueueManager;
        this.reviewQueueManager = reviewQueueManager;
    }
    /**
     * Get the full path to the sessions directory
     */
    getSessionsDirectory() {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
    }
    /**
     * Get the full path to the state transitions file
     */
    getTransitionsFilePath() {
        return path.join(this.getSessionsDirectory(), this.TRANSITIONS_FILE);
    }
    /**
     * Ensure the sessions directory exists
     */
    ensureSessionsDirectory() {
        const sessionsPath = this.getSessionsDirectory();
        if (!fs.existsSync(sessionsPath)) {
            fs.mkdirSync(sessionsPath, { recursive: true });
        }
    }
    /**
     * Read state transitions file
     * Returns empty storage if file doesn't exist
     */
    readTransitionsFile() {
        const filePath = this.getTransitionsFilePath();
        if (!fs.existsSync(filePath)) {
            return { transitions: [] };
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (!parsed || !Array.isArray(parsed.transitions)) {
                console.error('[LoopValidator] Invalid transitions file structure, resetting');
                return { transitions: [] };
            }
            return parsed;
        }
        catch (error) {
            console.error('[LoopValidator] Error reading transitions file:', error);
            return { transitions: [] };
        }
    }
    /**
     * Write state transitions file atomically
     */
    writeTransitionsFileAtomic(storage) {
        this.ensureSessionsDirectory();
        const filePath = this.getTransitionsFilePath();
        const tempPath = `${filePath}.tmp`;
        const content = JSON.stringify(storage, null, 2);
        // Write to temp file
        fs.writeFileSync(tempPath, content, 'utf-8');
        // Atomically rename temp file to target file
        fs.renameSync(tempPath, filePath);
    }
    /**
     * Trim transitions to keep only last N per agent
     */
    trimTransitions(transitions) {
        const byAgent = new Map();
        // Group by agent
        for (const transition of transitions) {
            if (!byAgent.has(transition.agentId)) {
                byAgent.set(transition.agentId, []);
            }
            byAgent.get(transition.agentId).push(transition);
        }
        // Keep only last N per agent
        const trimmed = [];
        for (const [agentId, agentTransitions] of byAgent.entries()) {
            const sorted = agentTransitions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            trimmed.push(...sorted.slice(0, this.MAX_TRANSITIONS_PER_AGENT));
        }
        return trimmed;
    }
    /**
     * Log a state transition for an agent
     * AC-4.5.a, AC-4.5.b: Track state transitions
     *
     * @param agentId - Agent identifier
     * @param fromState - Previous state
     * @param toState - New state
     * @param projectNumber - Optional project number
     */
    async logStateTransition(agentId, fromState, toState, projectNumber) {
        const storage = this.readTransitionsFile();
        const transition = {
            agentId,
            fromState,
            toState,
            timestamp: new Date().toISOString(),
            projectNumber
        };
        storage.transitions.push(transition);
        // Trim to keep only last N transitions per agent
        storage.transitions = this.trimTransitions(storage.transitions);
        this.writeTransitionsFileAtomic(storage);
        console.log(`[LoopValidator] State transition: ${agentId} ${fromState} → ${toState}`, projectNumber ? `(project ${projectNumber})` : '');
    }
    /**
     * Get transitions for a specific agent
     */
    getAgentTransitions(agentId) {
        const storage = this.readTransitionsFile();
        return storage.transitions
            .filter(t => t.agentId === agentId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    /**
     * Measure cycle time for an agent
     * A cycle is: working → idle → (reviewing OR ideating) → idle → working
     *
     * AC-4.5.d: Track cycle time and ensure < 4 hours average
     *
     * @param agentId - Agent identifier
     * @returns Cycle metrics for the agent
     */
    async measureCycleTime(agentId) {
        const transitions = this.getAgentTransitions(agentId);
        if (transitions.length === 0) {
            return {
                agentId,
                lastCycleTime: 0,
                averageCycleTime: 0,
                cyclesCompleted: 0,
                lastStateTransition: 'never'
            };
        }
        // Find complete cycles
        const cycles = [];
        let cycleStart = null;
        // Traverse transitions from oldest to newest
        const orderedTransitions = [...transitions].reverse();
        for (const transition of orderedTransitions) {
            // Cycle starts when transitioning to 'working'
            if (transition.toState === 'working' && cycleStart === null) {
                cycleStart = new Date(transition.timestamp);
            }
            // Cycle completes when transitioning back to 'working' after other states
            else if (transition.toState === 'working' && cycleStart !== null) {
                const cycleEnd = new Date(transition.timestamp);
                const cycleTime = (cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60); // minutes
                cycles.push(cycleTime);
                cycleStart = cycleEnd; // Start next cycle
            }
        }
        const lastCycleTime = cycles.length > 0 ? cycles[cycles.length - 1] : 0;
        const averageCycleTime = cycles.length > 0
            ? cycles.reduce((sum, time) => sum + time, 0) / cycles.length
            : 0;
        return {
            agentId,
            lastCycleTime,
            averageCycleTime,
            cyclesCompleted: cycles.length,
            lastStateTransition: transitions[0].timestamp
        };
    }
    /**
     * Detect agents stuck in the same state for > 30 minutes
     * AC-4.5.f: Detect stuck agents and notify user
     *
     * @returns Array of stuck agent information
     */
    async detectStuckAgents() {
        const sessions = await this.sessionManager.listAgentSessions();
        const stuckAgents = [];
        const now = Date.now();
        for (const session of sessions) {
            const lastHeartbeat = new Date(session.lastHeartbeat);
            const timeSinceHeartbeat = now - lastHeartbeat.getTime();
            // Check if stuck (no heartbeat update for > 30 minutes)
            if (timeSinceHeartbeat > this.STUCK_THRESHOLD_MS) {
                stuckAgents.push({
                    agentId: session.agentId,
                    currentStatus: session.status,
                    stuckDuration: Math.round(timeSinceHeartbeat / (1000 * 60)), // minutes
                    lastHeartbeat: session.lastHeartbeat
                });
                console.warn(`[LoopValidator] Stuck agent detected: ${session.agentId} in ${session.status} for ${Math.round(timeSinceHeartbeat / (1000 * 60))} minutes`);
            }
        }
        return stuckAgents;
    }
    /**
     * Get category usage report
     * AC-4.5.e: Ensure all categories are exercised within 30 days
     *
     * @returns Category usage report
     */
    async getCategoryUsageReport() {
        const stats = await (0, category_selector_1.getCategoryUsageStats)();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.CATEGORY_COVERAGE_DAYS);
        const cutoffTime = cutoffDate.getTime();
        const categoriesUsed = [];
        const categoriesNotUsed = [];
        const lastUsedDates = {};
        for (const categoryUsage of stats.categories) {
            if (categoryUsage.lastUsedAt) {
                const lastUsed = new Date(categoryUsage.lastUsedAt);
                if (lastUsed.getTime() >= cutoffTime) {
                    categoriesUsed.push(categoryUsage.category);
                    lastUsedDates[categoryUsage.category] = categoryUsage.lastUsedAt;
                }
                else {
                    categoriesNotUsed.push(categoryUsage.category);
                }
            }
            else {
                categoriesNotUsed.push(categoryUsage.category);
            }
        }
        const totalCategories = stats.categories.length;
        const coveragePercent = totalCategories > 0
            ? Math.round((categoriesUsed.length / totalCategories) * 100)
            : 0;
        return {
            categoriesUsed,
            categoriesNotUsed,
            coveragePercent,
            lastUsedDates
        };
    }
    /**
     * Get current queue depths
     *
     * @returns Queue depth information
     */
    async getQueueDepth() {
        const reviewQueueStats = await this.reviewQueueManager.getQueueStats();
        const projectClaims = await this.projectQueueManager.getAllActiveClaims();
        // Project queue depth is number of active claims
        // (assumes one claim = one active project)
        const projectQueueDepth = projectClaims.length;
        // Review queue depth is number of pending + in_review
        const reviewQueueDepth = reviewQueueStats.pending + reviewQueueStats.inReview;
        return {
            projectQueueDepth,
            reviewQueueDepth,
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Check if ideation should be prioritized
     * Returns true when queue depth < 3
     */
    async shouldPrioritizeIdeation() {
        const queueDepth = await this.getQueueDepth();
        return queueDepth.projectQueueDepth < 3;
    }
    /**
     * Check if ideation should be paused
     * Returns true when queue depth > 10
     */
    async shouldPauseIdeation() {
        const queueDepth = await this.getQueueDepth();
        return queueDepth.projectQueueDepth > 10;
    }
    /**
     * Validate overall loop health
     * AC-4.5.a through AC-4.5.f: Comprehensive health check
     *
     * @returns Loop health status with recommendations
     */
    async validateLoopHealth() {
        const sessions = await this.sessionManager.listAgentSessions();
        const queueDepth = await this.getQueueDepth();
        const stuckAgents = await this.detectStuckAgents();
        const recommendations = [];
        // Count agents by status
        let activeAgents = 0;
        let idleAgents = 0;
        let ideatingAgents = 0;
        for (const session of sessions) {
            if (session.status === 'working' || session.status === 'reviewing') {
                activeAgents++;
            }
            else if (session.status === 'idle') {
                idleAgents++;
            }
            else if (session.status === 'ideating') {
                ideatingAgents++;
            }
        }
        // Calculate average cycle time across all agents
        let totalCycleTime = 0;
        let agentsWithCycles = 0;
        for (const session of sessions) {
            const metrics = await this.measureCycleTime(session.agentId);
            if (metrics.cyclesCompleted > 0) {
                totalCycleTime += metrics.averageCycleTime;
                agentsWithCycles++;
            }
        }
        const averageCycleTime = agentsWithCycles > 0
            ? totalCycleTime / agentsWithCycles
            : 0;
        // Generate recommendations
        if (stuckAgents.length > 0) {
            recommendations.push(`${stuckAgents.length} agent(s) stuck for > 30 minutes. Consider manual intervention.`);
        }
        if (queueDepth.projectQueueDepth < 3) {
            recommendations.push('Project queue depth low (< 3). Prioritize ideation to maintain work pipeline.');
        }
        if (queueDepth.projectQueueDepth > 10) {
            recommendations.push('Project queue depth high (> 10). Pause ideation and focus on execution.');
        }
        if (averageCycleTime > (this.TARGET_CYCLE_TIME_MS / (1000 * 60))) {
            recommendations.push(`Average cycle time (${Math.round(averageCycleTime)} min) exceeds target (${this.TARGET_CYCLE_TIME_MS / (1000 * 60)} min). Review agent efficiency.`);
        }
        if (idleAgents > activeAgents && queueDepth.projectQueueDepth === 0 && queueDepth.reviewQueueDepth === 0) {
            recommendations.push('Multiple idle agents with empty queues. Trigger ideation to generate new work.');
        }
        // Category coverage check
        const categoryReport = await this.getCategoryUsageReport();
        if (categoryReport.coveragePercent < 80) {
            recommendations.push(`Category coverage low (${categoryReport.coveragePercent}%). ${categoryReport.categoriesNotUsed.length} categories unused in last 30 days.`);
        }
        // Determine overall health
        const healthy = stuckAgents.length === 0
            && queueDepth.projectQueueDepth >= 1
            && queueDepth.projectQueueDepth <= 15
            && averageCycleTime <= (this.TARGET_CYCLE_TIME_MS / (1000 * 60));
        return {
            healthy,
            projectQueueDepth: queueDepth.projectQueueDepth,
            reviewQueueDepth: queueDepth.reviewQueueDepth,
            activeAgents,
            idleAgents,
            ideatingAgents,
            stuckAgents,
            averageCycleTime,
            recommendations
        };
    }
    /**
     * Clear all state transitions (for testing)
     */
    async clearAllTransitions() {
        this.writeTransitionsFileAtomic({ transitions: [] });
        console.log('[LoopValidator] Cleared all state transitions');
    }
}
exports.LoopValidator = LoopValidator;
//# sourceMappingURL=loop-validator.js.map