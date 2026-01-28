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
exports.PerformanceMetrics = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Performance Metrics Module
 *
 * Tracks and calculates agent productivity metrics including:
 * - Tasks completed (total, 24-hour, 7-day rolling counts)
 * - Average cycle time (time from claim to completion)
 * - Review pass rate (% of projects approved on first review)
 * - Error rate (errors per project)
 * - Cost per project (average USD per completed project)
 * - Uptime (% of time in non-idle status)
 *
 * AC-5.4.a: When agent completes project → metrics are updated within 10 seconds
 * AC-5.4.b: When dashboard requests metrics → metrics are calculated within 1 second
 * AC-5.4.c: When metrics card is expanded → all tracked metrics are displayed
 * AC-5.4.d: When global metrics summary is displayed → values aggregate correctly
 * AC-5.4.e: When metrics calculation fails → last known values are displayed with stale indicator
 */
class PerformanceMetrics {
    SESSIONS_DIR = '.claude-sessions';
    METRICS_FILE = 'performance-metrics.json';
    VERSION = 1;
    MAX_COMPLETIONS_PER_AGENT = 500;
    MAX_REVIEWS_PER_AGENT = 500;
    workspaceRoot;
    sessionManager;
    cachedMetrics = null;
    cacheTimestamp = 0;
    CACHE_TTL_MS = 5000; // 5 seconds cache
    constructor(workspaceRoot, sessionManager) {
        this.workspaceRoot = workspaceRoot;
        this.sessionManager = sessionManager;
    }
    /**
     * Get the full path to the sessions directory
     */
    getSessionsDirectory() {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
    }
    /**
     * Get the full path to the metrics file
     */
    getMetricsFilePath() {
        return path.join(this.getSessionsDirectory(), this.METRICS_FILE);
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
     * Read the metrics storage file
     * Returns empty storage if file doesn't exist or is invalid
     */
    readMetricsFile() {
        const filePath = this.getMetricsFilePath();
        if (!fs.existsSync(filePath)) {
            return { version: this.VERSION, agents: {} };
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (!parsed || parsed.version !== this.VERSION) {
                console.warn('[PerformanceMetrics] Invalid version, resetting metrics');
                return { version: this.VERSION, agents: {} };
            }
            return parsed;
        }
        catch (error) {
            console.error('[PerformanceMetrics] Error reading metrics file:', error);
            return { version: this.VERSION, agents: {} };
        }
    }
    /**
     * Write metrics storage file atomically
     */
    writeMetricsFileAtomic(storage) {
        this.ensureSessionsDirectory();
        const filePath = this.getMetricsFilePath();
        const tempPath = `${filePath}.tmp`;
        const content = JSON.stringify(storage, null, 2);
        // Write to temp file
        fs.writeFileSync(tempPath, content, 'utf-8');
        // Atomically rename temp file to target file
        fs.renameSync(tempPath, filePath);
    }
    /**
     * Trim completions and reviews to keep only last N per agent
     */
    trimAgentData(data) {
        const sortedCompletions = data.completions
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, this.MAX_COMPLETIONS_PER_AGENT);
        const sortedReviews = data.reviews
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, this.MAX_REVIEWS_PER_AGENT);
        return {
            ...data,
            completions: sortedCompletions,
            reviews: sortedReviews
        };
    }
    /**
     * Record a task completion
     * AC-5.4.a: Updates metrics within 10 seconds
     *
     * @param agentId - Agent identifier
     * @param data - Task completion data
     */
    async recordTaskCompletion(agentId, data) {
        const storage = this.readMetricsFile();
        if (!storage.agents[agentId]) {
            storage.agents[agentId] = {
                agentId,
                completions: [],
                reviews: [],
                lastUpdated: new Date().toISOString()
            };
        }
        // Add completion
        storage.agents[agentId].completions.push(data);
        storage.agents[agentId].lastUpdated = new Date().toISOString();
        // Trim to max size
        storage.agents[agentId] = this.trimAgentData(storage.agents[agentId]);
        // Write to file
        this.writeMetricsFileAtomic(storage);
        // Invalidate cache
        this.cachedMetrics = null;
        console.log(`[PerformanceMetrics] Recorded task completion for ${agentId}, project #${data.projectNumber}`);
    }
    /**
     * Record a review result
     *
     * @param agentId - Agent identifier
     * @param projectNumber - Project number
     * @param approved - Whether the review was approved
     */
    async recordReviewResult(agentId, projectNumber, approved) {
        const storage = this.readMetricsFile();
        if (!storage.agents[agentId]) {
            storage.agents[agentId] = {
                agentId,
                completions: [],
                reviews: [],
                lastUpdated: new Date().toISOString()
            };
        }
        // Add review result
        const reviewResult = {
            projectNumber,
            approved,
            timestamp: new Date().toISOString()
        };
        storage.agents[agentId].reviews.push(reviewResult);
        storage.agents[agentId].lastUpdated = new Date().toISOString();
        // Trim to max size
        storage.agents[agentId] = this.trimAgentData(storage.agents[agentId]);
        // Write to file
        this.writeMetricsFileAtomic(storage);
        // Invalidate cache
        this.cachedMetrics = null;
        console.log(`[PerformanceMetrics] Recorded review result for ${agentId}, project #${projectNumber}: ${approved ? 'APPROVED' : 'REJECTED'}`);
    }
    /**
     * Calculate uptime percentage for an agent
     * Uptime = % of time in non-idle status (working/reviewing/ideating)
     *
     * @param agentId - Agent identifier
     * @param periodHours - Period to calculate uptime over (default 24 hours)
     * @returns Uptime percentage (0-100)
     */
    async calculateUptime(agentId, periodHours = 24) {
        try {
            const session = await this.sessionManager.readAgentSession(parseInt(agentId.replace('agent-', ''), 10));
            if (!session) {
                return 0;
            }
            const now = Date.now();
            const periodMs = periodHours * 60 * 60 * 1000;
            const lastHeartbeat = new Date(session.lastHeartbeat).getTime();
            const timeSinceHeartbeat = now - lastHeartbeat;
            // If last heartbeat is beyond period, agent hasn't been active
            if (timeSinceHeartbeat > periodMs) {
                return 0;
            }
            // Simple uptime calculation: if status is not idle, consider as uptime
            // More sophisticated tracking would require state transition history
            const isActive = session.status === 'working' ||
                session.status === 'reviewing' ||
                session.status === 'ideating';
            // Estimate uptime based on current status
            // This is simplified - in production would track state transitions over time
            return isActive ? 100 : 0;
        }
        catch (error) {
            console.error(`[PerformanceMetrics] Error calculating uptime for ${agentId}:`, error);
            return 0;
        }
    }
    /**
     * Get metrics for a specific agent
     * AC-5.4.b: Calculates metrics within 1 second
     *
     * @param agentId - Agent identifier
     * @returns Agent metrics
     */
    async getAgentMetrics(agentId) {
        // Check cache first
        const now = Date.now();
        if (this.cachedMetrics && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
            const cached = this.cachedMetrics.get(agentId);
            if (cached) {
                return cached;
            }
        }
        const storage = this.readMetricsFile();
        const agentData = storage.agents[agentId];
        if (!agentData) {
            // Return empty metrics for new agent
            return {
                agentId,
                tasksCompleted: {
                    total: 0,
                    last24Hours: 0,
                    last7Days: 0
                },
                averageCycleTime: 0,
                reviewPassRate: 0,
                errorRate: 0,
                averageCostPerProject: 0,
                uptimePercent: 0,
                lastUpdated: new Date().toISOString()
            };
        }
        const now24Hours = Date.now() - (24 * 60 * 60 * 1000);
        const now7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
        // Calculate task counts
        const total = agentData.completions.length;
        const last24Hours = agentData.completions.filter(c => new Date(c.timestamp).getTime() >= now24Hours).length;
        const last7Days = agentData.completions.filter(c => new Date(c.timestamp).getTime() >= now7Days).length;
        // Calculate average cycle time
        const averageCycleTime = total > 0
            ? agentData.completions.reduce((sum, c) => sum + c.cycleTimeMinutes, 0) / total
            : 0;
        // Calculate review pass rate
        const totalReviews = agentData.reviews.length;
        const approvedReviews = agentData.reviews.filter(r => r.approved).length;
        const reviewPassRate = totalReviews > 0
            ? (approvedReviews / totalReviews) * 100
            : 0;
        // Calculate error rate (get from session manager)
        let errorRate = 0;
        try {
            const session = await this.sessionManager.readAgentSession(parseInt(agentId.replace('agent-', ''), 10));
            if (session && total > 0) {
                errorRate = session.errorCount / total;
            }
        }
        catch (error) {
            console.error(`[PerformanceMetrics] Error getting error rate for ${agentId}:`, error);
        }
        // Calculate average cost per project
        const totalCost = agentData.completions.reduce((sum, c) => sum + c.costUSD, 0);
        const averageCostPerProject = total > 0 ? totalCost / total : 0;
        // Calculate uptime
        const uptimePercent = await this.calculateUptime(agentId, 24);
        const metrics = {
            agentId,
            tasksCompleted: {
                total,
                last24Hours,
                last7Days
            },
            averageCycleTime,
            reviewPassRate,
            errorRate,
            averageCostPerProject,
            uptimePercent,
            lastUpdated: agentData.lastUpdated
        };
        return metrics;
    }
    /**
     * Get metrics for all agents
     * AC-5.4.b: Calculates metrics within 1 second
     *
     * @returns Map of agent IDs to metrics
     */
    async getAllAgentMetrics() {
        // Check cache first
        const now = Date.now();
        if (this.cachedMetrics && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
            return this.cachedMetrics;
        }
        const storage = this.readMetricsFile();
        const metricsMap = new Map();
        // Get all agent sessions to ensure we include active agents without metrics yet
        const sessions = await this.sessionManager.listAgentSessions();
        for (const session of sessions) {
            const metrics = await this.getAgentMetrics(session.agentId);
            metricsMap.set(session.agentId, metrics);
        }
        // Cache the results
        this.cachedMetrics = metricsMap;
        this.cacheTimestamp = now;
        return metricsMap;
    }
    /**
     * Get global metrics aggregated across all agents
     * AC-5.4.d: Aggregates values correctly
     *
     * @returns Global metrics
     */
    async getGlobalMetrics() {
        const allMetrics = await this.getAllAgentMetrics();
        const sessions = await this.sessionManager.listAgentSessions();
        let totalProjectsCompleted = 0;
        let totalCycleTime = 0;
        let totalReviewPassRate = 0;
        let totalCostUSD = 0;
        let agentsWithCompletions = 0;
        let agentsWithReviews = 0;
        let activeAgents = 0;
        let idleAgents = 0;
        for (const [agentId, metrics] of allMetrics) {
            totalProjectsCompleted += metrics.tasksCompleted.total;
            if (metrics.tasksCompleted.total > 0) {
                totalCycleTime += metrics.averageCycleTime;
                agentsWithCompletions++;
            }
            if (metrics.reviewPassRate > 0) {
                totalReviewPassRate += metrics.reviewPassRate;
                agentsWithReviews++;
            }
            totalCostUSD += metrics.averageCostPerProject * metrics.tasksCompleted.total;
        }
        // Count active/idle agents from sessions
        for (const session of sessions) {
            if (session.status === 'working' || session.status === 'reviewing' || session.status === 'ideating') {
                activeAgents++;
            }
            else if (session.status === 'idle') {
                idleAgents++;
            }
        }
        const averageCycleTime = agentsWithCompletions > 0
            ? totalCycleTime / agentsWithCompletions
            : 0;
        const averageReviewPassRate = agentsWithReviews > 0
            ? totalReviewPassRate / agentsWithReviews
            : 0;
        return {
            totalProjectsCompleted,
            averageCycleTime,
            averageReviewPassRate,
            totalCostUSD,
            activeAgents,
            idleAgents
        };
    }
    /**
     * Clear all metrics (for testing)
     */
    clearAllMetrics() {
        this.writeMetricsFileAtomic({ version: this.VERSION, agents: {} });
        this.cachedMetrics = null;
        console.log('[PerformanceMetrics] Cleared all metrics');
    }
    /**
     * Invalidate cache to force recalculation
     */
    invalidateCache() {
        this.cachedMetrics = null;
        console.log('[PerformanceMetrics] Cache invalidated');
    }
}
exports.PerformanceMetrics = PerformanceMetrics;
//# sourceMappingURL=performance-metrics.js.map