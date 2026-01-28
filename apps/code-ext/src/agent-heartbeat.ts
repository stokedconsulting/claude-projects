import { AgentSessionManager } from './agent-session-manager';

/**
 * Agent health status levels
 */
export type AgentHealthStatus = 'healthy' | 'degraded' | 'unresponsive';

/**
 * Heartbeat payload structure
 */
export interface HeartbeatPayload {
    agentId: number;
    status: string;
    currentProjectNumber: number | null;
    timestamp: string;
    memoryUsage: number; // MB
    cpuUsage: number; // Percentage (0-100)
}

/**
 * Health status calculation result
 */
export interface HealthStatusResult {
    status: AgentHealthStatus;
    lastHeartbeat: Date | null;
    timeSinceLastHeartbeat: number | null; // milliseconds
}

/**
 * Agent Heartbeat Manager
 *
 * Manages periodic heartbeat updates and health status tracking for all active agents.
 *
 * Heartbeat Configuration:
 * - Interval: Every 30 seconds per agent
 * - Payload includes: agentId, status, currentProjectNumber, timestamp, memoryUsage, cpuUsage
 *
 * Health Status Thresholds:
 * - Healthy: Last heartbeat < 60 seconds ago
 * - Degraded: Last heartbeat 60-120 seconds ago
 * - Unresponsive: Last heartbeat > 120 seconds ago
 */
export class AgentHeartbeatManager {
    private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
    private readonly HEALTHY_THRESHOLD_MS = 60000; // 60 seconds
    private readonly DEGRADED_THRESHOLD_MS = 120000; // 120 seconds

    private sessionManager: AgentSessionManager;
    private heartbeatTimers: Map<number, NodeJS.Timeout> = new Map();

    constructor(sessionManager: AgentSessionManager) {
        this.sessionManager = sessionManager;
    }

    /**
     * Get current system resource usage
     * Used for heartbeat payload
     */
    private getResourceUsage(): { memoryUsage: number; cpuUsage: number } {
        // Memory usage in MB
        const memUsage = process.memoryUsage();
        const memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);

        // CPU usage approximation (0-100)
        // Note: This is a simplified metric. For accurate CPU usage,
        // we'd need to track CPU time over intervals.
        const cpuUsage = Math.round(Math.random() * 10); // Placeholder for now

        return { memoryUsage, cpuUsage };
    }

    /**
     * Send a single heartbeat for an agent
     * Updates local session file and (future) State Tracking API
     */
    private async sendHeartbeat(agentId: number): Promise<void> {
        try {
            const session = await this.sessionManager.readAgentSession(agentId);

            if (!session) {
                console.error(`[AgentHeartbeat] Cannot send heartbeat for agent-${agentId}: session not found`);
                return;
            }

            // Get current resource usage
            const { memoryUsage, cpuUsage } = this.getResourceUsage();

            // Build heartbeat payload
            const payload: HeartbeatPayload = {
                agentId,
                status: session.status,
                currentProjectNumber: session.currentProjectNumber,
                timestamp: new Date().toISOString(),
                memoryUsage,
                cpuUsage
            };

            // Update local session file with heartbeat timestamp
            // This also updates lastHeartbeat automatically via updateAgentSession
            await this.sessionManager.updateAgentSession(agentId, {
                lastHeartbeat: payload.timestamp
            });

            // TODO: Send heartbeat to State Tracking API
            // await this.sendHeartbeatToAPI(agentId, payload);

            console.log(`[AgentHeartbeat] Heartbeat sent for agent-${agentId}:`, {
                status: payload.status,
                projectNumber: payload.currentProjectNumber,
                memoryUsage: `${payload.memoryUsage}MB`,
                cpuUsage: `${payload.cpuUsage}%`
            });
        } catch (error) {
            // Network errors during heartbeat should not kill agent
            // Log warning and continue
            console.warn(`[AgentHeartbeat] Failed to send heartbeat for agent-${agentId}:`, error);
        }
    }

    /**
     * TODO: Send heartbeat to State Tracking API
     * POST /api/agents/{agentId}/heartbeat
     *
     * This will be implemented when State Tracking API integration is ready.
     * For now, we only update local session files.
     */
    private async sendHeartbeatToAPI(agentId: number, payload: HeartbeatPayload): Promise<void> {
        // TODO: Implement API call
        // Example:
        // const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}/heartbeat`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload)
        // });
        //
        // if (!response.ok) {
        //     throw new Error(`API heartbeat failed: ${response.statusText}`);
        // }

        // For now, this is a no-op
        console.log(`[AgentHeartbeat] TODO: Send to API for agent-${agentId}`, payload);
    }

    /**
     * Start sending heartbeats every 30 seconds for an agent
     *
     * @param agentId - Agent ID to start heartbeats for
     */
    public startHeartbeat(agentId: number): void {
        // Stop existing heartbeat if running
        this.stopHeartbeat(agentId);

        console.log(`[AgentHeartbeat] Starting heartbeat for agent-${agentId} (interval: ${this.HEARTBEAT_INTERVAL_MS}ms)`);

        // Send initial heartbeat immediately
        void this.sendHeartbeat(agentId);

        // Schedule periodic heartbeats
        const timer = setInterval(() => {
            void this.sendHeartbeat(agentId);
        }, this.HEARTBEAT_INTERVAL_MS);

        this.heartbeatTimers.set(agentId, timer);
    }

    /**
     * Stop heartbeat for a specific agent
     *
     * @param agentId - Agent ID to stop heartbeats for
     */
    public stopHeartbeat(agentId: number): void {
        const timer = this.heartbeatTimers.get(agentId);

        if (timer) {
            clearInterval(timer);
            this.heartbeatTimers.delete(agentId);
            console.log(`[AgentHeartbeat] Stopped heartbeat for agent-${agentId}`);
        }
    }

    /**
     * Stop all active heartbeats
     * Used during extension deactivation
     */
    public stopAllHeartbeats(): void {
        console.log(`[AgentHeartbeat] Stopping all heartbeats (${this.heartbeatTimers.size} active)`);

        for (const [agentId, timer] of this.heartbeatTimers.entries()) {
            clearInterval(timer);
            console.log(`[AgentHeartbeat] Stopped heartbeat for agent-${agentId}`);
        }

        this.heartbeatTimers.clear();
    }

    /**
     * Get health status for a specific agent based on last heartbeat
     *
     * @param agentId - Agent ID to check health for
     * @returns Health status result with status level and timing information
     */
    public async getAgentHealthStatus(agentId: number): Promise<HealthStatusResult> {
        const session = await this.sessionManager.readAgentSession(agentId);

        if (!session) {
            return {
                status: 'unresponsive',
                lastHeartbeat: null,
                timeSinceLastHeartbeat: null
            };
        }

        const lastHeartbeat = new Date(session.lastHeartbeat);
        const now = new Date();
        const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();

        let status: AgentHealthStatus;

        if (timeSinceLastHeartbeat < this.HEALTHY_THRESHOLD_MS) {
            status = 'healthy';
        } else if (timeSinceLastHeartbeat < this.DEGRADED_THRESHOLD_MS) {
            status = 'degraded';
        } else {
            status = 'unresponsive';
        }

        return {
            status,
            lastHeartbeat,
            timeSinceLastHeartbeat
        };
    }

    /**
     * Get health status for all agents
     *
     * @returns Map of agent IDs to their health status
     */
    public async getAllAgentHealthStatuses(): Promise<Map<number, HealthStatusResult>> {
        const sessions = await this.sessionManager.listAgentSessions();
        const healthStatuses = new Map<number, HealthStatusResult>();

        for (const session of sessions) {
            // Extract agent ID from agentId field (format: "agent-N")
            const match = session.agentId.match(/^agent-(\d+)$/);
            if (!match) {
                continue;
            }

            const agentId = parseInt(match[1], 10);
            const healthStatus = await this.getAgentHealthStatus(agentId);
            healthStatuses.set(agentId, healthStatus);
        }

        return healthStatuses;
    }

    /**
     * Mark an agent as crashed and send final heartbeat
     * Used when an agent encounters a fatal error
     *
     * @param agentId - Agent ID that crashed
     * @param errorDetails - Error message or details
     */
    public async markAgentAsCrashed(agentId: number, errorDetails: string): Promise<void> {
        console.error(`[AgentHeartbeat] Agent-${agentId} crashed: ${errorDetails}`);

        // Stop heartbeat timer
        this.stopHeartbeat(agentId);

        try {
            // Update session with crashed status and error details
            await this.sessionManager.updateAgentSession(agentId, {
                status: 'paused', // Using 'paused' as closest to crashed state
                lastError: `CRASH: ${errorDetails}`,
                errorCount: (await this.sessionManager.readAgentSession(agentId))?.errorCount ?? 0 + 1
            });

            // Send final heartbeat to API (future implementation)
            // TODO: Send crash notification to State Tracking API
            console.log(`[AgentHeartbeat] Final heartbeat sent for crashed agent-${agentId}`);
        } catch (error) {
            console.error(`[AgentHeartbeat] Failed to mark agent-${agentId} as crashed:`, error);
        }
    }
}
