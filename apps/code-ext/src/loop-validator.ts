import * as fs from 'fs';
import * as path from 'path';
import { AgentSessionManager, AgentSession, AgentStatus } from './agent-session-manager';
import { ProjectQueueManager } from './project-queue-manager';
import { ReviewQueueManager } from './review-queue-manager';
import { getCategoryUsageStats } from './category-selector';

/**
 * State transition record for tracking agent movement through the loop
 */
export interface StateTransition {
    agentId: string;
    fromState: AgentStatus;
    toState: AgentStatus;
    timestamp: string;
    projectNumber?: number;
}

/**
 * Cycle metrics for a specific agent
 */
export interface CycleMetrics {
    agentId: string;
    lastCycleTime: number;  // minutes
    averageCycleTime: number;  // minutes
    cyclesCompleted: number;
    lastStateTransition: string;
}

/**
 * Information about a stuck agent
 */
export interface StuckAgentInfo {
    agentId: string;
    currentStatus: string;
    stuckDuration: number;  // minutes
    lastHeartbeat: string;
}

/**
 * Category usage report for loop health monitoring
 */
export interface CategoryUsageReport {
    categoriesUsed: string[];
    categoriesNotUsed: string[];
    coveragePercent: number;
    lastUsedDates: Record<string, string>;
}

/**
 * Queue depth information
 */
export interface QueueDepthInfo {
    projectQueueDepth: number;
    reviewQueueDepth: number;
    timestamp: string;
}

/**
 * Overall loop health status
 */
export interface LoopHealthStatus {
    healthy: boolean;
    projectQueueDepth: number;
    reviewQueueDepth: number;
    activeAgents: number;
    idleAgents: number;
    ideatingAgents: number;
    stuckAgents: StuckAgentInfo[];
    averageCycleTime: number;  // minutes
    recommendations: string[];
}

/**
 * Internal storage for state transitions
 */
interface StateTransitionStorage {
    transitions: StateTransition[];
}

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
export class LoopValidator {
    private readonly SESSIONS_DIR = '.claude-sessions';
    private readonly TRANSITIONS_FILE = 'state-transitions.json';
    private readonly MAX_TRANSITIONS_PER_AGENT = 1000;
    private readonly STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
    private readonly TARGET_CYCLE_TIME_MS = 4 * 60 * 60 * 1000; // 4 hours
    private readonly CATEGORY_COVERAGE_DAYS = 30;

    private workspaceRoot: string;
    private sessionManager: AgentSessionManager;
    private projectQueueManager: ProjectQueueManager;
    private reviewQueueManager: ReviewQueueManager;

    constructor(
        workspaceRoot: string,
        sessionManager: AgentSessionManager,
        projectQueueManager: ProjectQueueManager,
        reviewQueueManager: ReviewQueueManager
    ) {
        this.workspaceRoot = workspaceRoot;
        this.sessionManager = sessionManager;
        this.projectQueueManager = projectQueueManager;
        this.reviewQueueManager = reviewQueueManager;
    }

    /**
     * Get the full path to the sessions directory
     */
    private getSessionsDirectory(): string {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
    }

    /**
     * Get the full path to the state transitions file
     */
    private getTransitionsFilePath(): string {
        return path.join(this.getSessionsDirectory(), this.TRANSITIONS_FILE);
    }

    /**
     * Ensure the sessions directory exists
     */
    private ensureSessionsDirectory(): void {
        const sessionsPath = this.getSessionsDirectory();
        if (!fs.existsSync(sessionsPath)) {
            fs.mkdirSync(sessionsPath, { recursive: true });
        }
    }

    /**
     * Read state transitions file
     * Returns empty storage if file doesn't exist
     */
    private readTransitionsFile(): StateTransitionStorage {
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

            return parsed as StateTransitionStorage;
        } catch (error) {
            console.error('[LoopValidator] Error reading transitions file:', error);
            return { transitions: [] };
        }
    }

    /**
     * Write state transitions file atomically
     */
    private writeTransitionsFileAtomic(storage: StateTransitionStorage): void {
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
    private trimTransitions(transitions: StateTransition[]): StateTransition[] {
        const byAgent = new Map<string, StateTransition[]>();

        // Group by agent
        for (const transition of transitions) {
            if (!byAgent.has(transition.agentId)) {
                byAgent.set(transition.agentId, []);
            }
            byAgent.get(transition.agentId)!.push(transition);
        }

        // Keep only last N per agent
        const trimmed: StateTransition[] = [];
        for (const [agentId, agentTransitions] of byAgent.entries()) {
            const sorted = agentTransitions.sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
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
    public async logStateTransition(
        agentId: string,
        fromState: AgentStatus,
        toState: AgentStatus,
        projectNumber?: number
    ): Promise<void> {
        const storage = this.readTransitionsFile();

        const transition: StateTransition = {
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

        console.log(
            `[LoopValidator] State transition: ${agentId} ${fromState} → ${toState}`,
            projectNumber ? `(project ${projectNumber})` : ''
        );
    }

    /**
     * Get transitions for a specific agent
     */
    private getAgentTransitions(agentId: string): StateTransition[] {
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
    public async measureCycleTime(agentId: string): Promise<CycleMetrics> {
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
        const cycles: number[] = [];
        let cycleStart: Date | null = null;

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
    public async detectStuckAgents(): Promise<StuckAgentInfo[]> {
        const sessions = await this.sessionManager.listAgentSessions();
        const stuckAgents: StuckAgentInfo[] = [];
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

                console.warn(
                    `[LoopValidator] Stuck agent detected: ${session.agentId} in ${session.status} for ${Math.round(timeSinceHeartbeat / (1000 * 60))} minutes`
                );
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
    public async getCategoryUsageReport(): Promise<CategoryUsageReport> {
        const stats = await getCategoryUsageStats();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.CATEGORY_COVERAGE_DAYS);
        const cutoffTime = cutoffDate.getTime();

        const categoriesUsed: string[] = [];
        const categoriesNotUsed: string[] = [];
        const lastUsedDates: Record<string, string> = {};

        for (const categoryUsage of stats.categories) {
            if (categoryUsage.lastUsedAt) {
                const lastUsed = new Date(categoryUsage.lastUsedAt);

                if (lastUsed.getTime() >= cutoffTime) {
                    categoriesUsed.push(categoryUsage.category);
                    lastUsedDates[categoryUsage.category] = categoryUsage.lastUsedAt;
                } else {
                    categoriesNotUsed.push(categoryUsage.category);
                }
            } else {
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
    public async getQueueDepth(): Promise<QueueDepthInfo> {
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
    public async shouldPrioritizeIdeation(): Promise<boolean> {
        const queueDepth = await this.getQueueDepth();
        return queueDepth.projectQueueDepth < 3;
    }

    /**
     * Check if ideation should be paused
     * Returns true when queue depth > 10
     */
    public async shouldPauseIdeation(): Promise<boolean> {
        const queueDepth = await this.getQueueDepth();
        return queueDepth.projectQueueDepth > 10;
    }

    /**
     * Validate overall loop health
     * AC-4.5.a through AC-4.5.f: Comprehensive health check
     *
     * @returns Loop health status with recommendations
     */
    public async validateLoopHealth(): Promise<LoopHealthStatus> {
        const sessions = await this.sessionManager.listAgentSessions();
        const queueDepth = await this.getQueueDepth();
        const stuckAgents = await this.detectStuckAgents();
        const recommendations: string[] = [];

        // Count agents by status
        let activeAgents = 0;
        let idleAgents = 0;
        let ideatingAgents = 0;

        for (const session of sessions) {
            if (session.status === 'working' || session.status === 'reviewing') {
                activeAgents++;
            } else if (session.status === 'idle') {
                idleAgents++;
            } else if (session.status === 'ideating') {
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
            recommendations.push(
                `${stuckAgents.length} agent(s) stuck for > 30 minutes. Consider manual intervention.`
            );
        }

        if (queueDepth.projectQueueDepth < 3) {
            recommendations.push(
                'Project queue depth low (< 3). Prioritize ideation to maintain work pipeline.'
            );
        }

        if (queueDepth.projectQueueDepth > 10) {
            recommendations.push(
                'Project queue depth high (> 10). Pause ideation and focus on execution.'
            );
        }

        if (averageCycleTime > (this.TARGET_CYCLE_TIME_MS / (1000 * 60))) {
            recommendations.push(
                `Average cycle time (${Math.round(averageCycleTime)} min) exceeds target (${this.TARGET_CYCLE_TIME_MS / (1000 * 60)} min). Review agent efficiency.`
            );
        }

        if (idleAgents > activeAgents && queueDepth.projectQueueDepth === 0 && queueDepth.reviewQueueDepth === 0) {
            recommendations.push(
                'Multiple idle agents with empty queues. Trigger ideation to generate new work.'
            );
        }

        // Category coverage check
        const categoryReport = await this.getCategoryUsageReport();
        if (categoryReport.coveragePercent < 80) {
            recommendations.push(
                `Category coverage low (${categoryReport.coveragePercent}%). ${categoryReport.categoriesNotUsed.length} categories unused in last 30 days.`
            );
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
    public async clearAllTransitions(): Promise<void> {
        this.writeTransitionsFileAtomic({ transitions: [] });
        console.log('[LoopValidator] Cleared all state transitions');
    }
}
