import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { AgentSessionManager, AgentSession } from './agent-session-manager';
import { getAgentConfig } from './agent-config';

/**
 * Extended agent status including failure states
 */
export type AgentLifecycleStatus = 'idle' | 'working' | 'reviewing' | 'ideating' | 'paused' | 'stopped' | 'crashed' | 'failed';

/**
 * Process tracking information for an agent
 */
interface AgentProcess {
    process: ChildProcess;
    agentId: number;
    startTime: Date;
}

/**
 * Agent Lifecycle Manager
 *
 * Manages agent process lifecycle including start, pause, resume, and stop operations.
 * Each agent runs as a separate Claude Code session with its own process.
 */
export class AgentLifecycleManager {
    private sessionManager: AgentSessionManager;
    private activeProcesses: Map<number, AgentProcess>;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.sessionManager = new AgentSessionManager(workspaceRoot);
        this.activeProcesses = new Map();
    }

    /**
     * Start an agent by creating its session and spawning a process
     * @param agentId - Numeric identifier for the agent
     * @throws Error if agent is already running or spawn fails
     */
    public async startAgent(agentId: number): Promise<void> {
        console.log(`[AgentLifecycle] Starting agent-${agentId}...`);

        // Check if agent is already running
        if (this.isAgentRunning(agentId)) {
            throw new Error(`Agent ${agentId} is already running`);
        }

        try {
            // Create session file with idle status
            const session = await this.sessionManager.createAgentSession(agentId);
            console.log(`[AgentLifecycle] Session created for agent-${agentId}`);

            // Spawn the agent process
            await this.spawnAgentProcess(agentId);

            console.log(`[AgentLifecycle] Agent-${agentId} started successfully`);
        } catch (error) {
            // Mark agent as failed if spawn fails
            console.error(`[AgentLifecycle] Failed to start agent-${agentId}:`, error);

            try {
                await this.sessionManager.updateAgentSession(agentId, {
                    status: 'idle', // Use idle since 'failed' is not in AgentStatus type
                    lastError: `Failed to start: ${error instanceof Error ? error.message : String(error)}`,
                    errorCount: 1
                });
            } catch (updateError) {
                console.error(`[AgentLifecycle] Failed to update session after start failure:`, updateError);
            }

            throw error;
        }
    }

    /**
     * Spawn a child process for an agent
     * For now, this simulates the process - actual Claude session integration comes later
     */
    private async spawnAgentProcess(agentId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // For now, spawn a long-running sleep process to simulate agent work
                // In production, this would be: claude-code --session agent-${agentId}
                const isWindows = process.platform === 'win32';
                const command = isWindows ? 'timeout' : 'sleep';
                const args = isWindows ? ['/t', '3600', '/nobreak'] : ['3600'];

                const childProcess = spawn(command, args, {
                    cwd: this.workspaceRoot,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: false
                });

                const agentProcess: AgentProcess = {
                    process: childProcess,
                    agentId,
                    startTime: new Date()
                };

                // Track the process
                this.activeProcesses.set(agentId, agentProcess);

                // Handle process events
                childProcess.on('error', async (error) => {
                    console.error(`[AgentLifecycle] Process error for agent-${agentId}:`, error);
                    await this.handleProcessCrash(agentId, error);
                });

                childProcess.on('exit', async (code, signal) => {
                    console.log(`[AgentLifecycle] Agent-${agentId} process exited with code ${code}, signal ${signal}`);
                    this.activeProcesses.delete(agentId);

                    // If exit was unexpected (not via stopAgent), mark as crashed
                    const session = await this.sessionManager.readAgentSession(agentId);
                    if (session && session.status !== 'idle') {
                        await this.handleProcessCrash(agentId, new Error(`Unexpected exit: code=${code}, signal=${signal}`));
                    }
                });

                // Verify process started successfully
                setTimeout(() => {
                    if (childProcess.exitCode !== null) {
                        reject(new Error(`Agent process exited immediately with code ${childProcess.exitCode}`));
                    } else {
                        resolve();
                    }
                }, 100);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle unexpected process crash
     */
    private async handleProcessCrash(agentId: number, error: Error): Promise<void> {
        console.error(`[AgentLifecycle] Agent-${agentId} crashed:`, error);

        try {
            const session = await this.sessionManager.readAgentSession(agentId);
            const errorCount = session ? session.errorCount + 1 : 1;

            await this.sessionManager.updateAgentSession(agentId, {
                status: 'idle', // Use idle since 'crashed' is not in AgentStatus type
                lastError: `Crashed: ${error.message}`,
                errorCount
            });
        } catch (updateError) {
            console.error(`[AgentLifecycle] Failed to update session after crash:`, updateError);
        }

        this.activeProcesses.delete(agentId);
    }

    /**
     * Pause a running agent
     * Sends SIGSTOP on Unix systems, updates status to 'paused'
     * @param agentId - Agent to pause
     * @throws Error if agent is not running or pause fails
     */
    public async pauseAgent(agentId: number): Promise<void> {
        console.log(`[AgentLifecycle] Pausing agent-${agentId}...`);

        if (!this.isAgentRunning(agentId)) {
            throw new Error(`Agent ${agentId} is not running`);
        }

        const agentProcess = this.activeProcesses.get(agentId);
        if (!agentProcess) {
            throw new Error(`Agent ${agentId} process not found`);
        }

        try {
            // Update session status first
            await this.sessionManager.updateAgentSession(agentId, {
                status: 'paused'
            });

            // Send SIGSTOP on Unix systems (not available on Windows)
            if (process.platform !== 'win32' && agentProcess.process.pid) {
                process.kill(agentProcess.process.pid, 'SIGSTOP');
                console.log(`[AgentLifecycle] Sent SIGSTOP to agent-${agentId} (PID: ${agentProcess.process.pid})`);
            } else {
                console.log(`[AgentLifecycle] Paused agent-${agentId} (signal not available on Windows)`);
            }

            console.log(`[AgentLifecycle] Agent-${agentId} paused successfully`);
        } catch (error) {
            console.error(`[AgentLifecycle] Failed to pause agent-${agentId}:`, error);
            throw error;
        }
    }

    /**
     * Resume a paused agent
     * Sends SIGCONT on Unix systems, updates status to 'idle'
     * @param agentId - Agent to resume
     * @throws Error if agent is not paused or resume fails
     */
    public async resumeAgent(agentId: number): Promise<void> {
        console.log(`[AgentLifecycle] Resuming agent-${agentId}...`);

        const session = await this.sessionManager.readAgentSession(agentId);
        if (!session) {
            throw new Error(`Agent ${agentId} session not found`);
        }

        if (session.status !== 'paused') {
            throw new Error(`Agent ${agentId} is not paused (current status: ${session.status})`);
        }

        const agentProcess = this.activeProcesses.get(agentId);
        if (!agentProcess) {
            throw new Error(`Agent ${agentId} process not found`);
        }

        try {
            // Send SIGCONT on Unix systems
            if (process.platform !== 'win32' && agentProcess.process.pid) {
                process.kill(agentProcess.process.pid, 'SIGCONT');
                console.log(`[AgentLifecycle] Sent SIGCONT to agent-${agentId} (PID: ${agentProcess.process.pid})`);
            } else {
                console.log(`[AgentLifecycle] Resumed agent-${agentId} (signal not available on Windows)`);
            }

            // Update session status
            await this.sessionManager.updateAgentSession(agentId, {
                status: 'idle'
            });

            console.log(`[AgentLifecycle] Agent-${agentId} resumed successfully`);
        } catch (error) {
            console.error(`[AgentLifecycle] Failed to resume agent-${agentId}:`, error);
            throw error;
        }
    }

    /**
     * Stop an agent gracefully
     * Sends SIGTERM, waits 5 seconds, then sends SIGKILL if still running
     * @param agentId - Agent to stop
     * @throws Error if stop operation fails
     */
    public async stopAgent(agentId: number): Promise<void> {
        console.log(`[AgentLifecycle] Stopping agent-${agentId}...`);

        const agentProcess = this.activeProcesses.get(agentId);
        if (!agentProcess) {
            console.log(`[AgentLifecycle] Agent-${agentId} is not running`);
            return;
        }

        try {
            // Update session status to stopped
            const session = await this.sessionManager.readAgentSession(agentId);
            if (session) {
                await this.sessionManager.updateAgentSession(agentId, {
                    status: 'idle' // Use idle since 'stopped' is not in AgentStatus type
                });
            }

            // Send SIGTERM for graceful shutdown
            if (agentProcess.process.pid) {
                console.log(`[AgentLifecycle] Sending SIGTERM to agent-${agentId} (PID: ${agentProcess.process.pid})`);
                process.kill(agentProcess.process.pid, 'SIGTERM');

                // Wait 5 seconds for graceful shutdown
                const shutdownTimeout = new Promise<void>((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, 5000);
                });

                const processExit = new Promise<void>((resolve) => {
                    agentProcess.process.once('exit', () => {
                        resolve();
                    });
                });

                await Promise.race([processExit, shutdownTimeout]);

                // If process still running, force kill
                if (agentProcess.process.exitCode === null) {
                    console.log(`[AgentLifecycle] Agent-${agentId} did not exit gracefully, sending SIGKILL`);
                    process.kill(agentProcess.process.pid, 'SIGKILL');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second after SIGKILL
                }
            }

            this.activeProcesses.delete(agentId);
            console.log(`[AgentLifecycle] Agent-${agentId} stopped successfully`);
        } catch (error) {
            console.error(`[AgentLifecycle] Failed to stop agent-${agentId}:`, error);
            throw error;
        }
    }

    /**
     * Stop all running agents
     * Used during extension deactivation
     * @param timeoutMs - Maximum time to wait for all agents to stop (default: 10000ms)
     */
    public async stopAllAgents(timeoutMs: number = 10000): Promise<void> {
        console.log(`[AgentLifecycle] Stopping all agents (${this.activeProcesses.size} running)...`);

        if (this.activeProcesses.size === 0) {
            console.log(`[AgentLifecycle] No agents running`);
            return;
        }

        const agentIds = Array.from(this.activeProcesses.keys());
        const stopPromises = agentIds.map(agentId => this.stopAgent(agentId));

        try {
            // Wait for all agents to stop or timeout
            await Promise.race([
                Promise.all(stopPromises),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout stopping all agents')), timeoutMs)
                )
            ]);

            console.log(`[AgentLifecycle] All agents stopped successfully`);
        } catch (error) {
            console.error(`[AgentLifecycle] Error stopping all agents:`, error);

            // Force kill any remaining processes
            for (const [agentId, agentProcess] of this.activeProcesses.entries()) {
                if (agentProcess.process.pid && agentProcess.process.exitCode === null) {
                    console.log(`[AgentLifecycle] Force killing agent-${agentId} (PID: ${agentProcess.process.pid})`);
                    try {
                        process.kill(agentProcess.process.pid, 'SIGKILL');
                    } catch (killError) {
                        console.error(`[AgentLifecycle] Failed to force kill agent-${agentId}:`, killError);
                    }
                }
            }

            this.activeProcesses.clear();
        }
    }

    /**
     * Get the child process for an agent
     * @param agentId - Agent ID
     * @returns ChildProcess or null if not running
     */
    public getAgentProcess(agentId: number): ChildProcess | null {
        const agentProcess = this.activeProcesses.get(agentId);
        return agentProcess ? agentProcess.process : null;
    }

    /**
     * Check if an agent process is running
     * @param agentId - Agent ID
     * @returns true if agent has an active process
     */
    public isAgentRunning(agentId: number): boolean {
        const agentProcess = this.activeProcesses.get(agentId);
        if (!agentProcess) {
            return false;
        }

        // Check if process is still alive
        return agentProcess.process.exitCode === null;
    }

    /**
     * Get statistics about all running agents
     */
    public async getAgentStats(): Promise<{
        totalRunning: number;
        byStatus: Record<string, number>;
        processes: Array<{ agentId: number; pid: number | undefined; uptime: number }>;
    }> {
        const sessions = await this.sessionManager.listAgentSessions();
        const byStatus: Record<string, number> = {};

        for (const session of sessions) {
            byStatus[session.status] = (byStatus[session.status] || 0) + 1;
        }

        const processes = Array.from(this.activeProcesses.entries()).map(([agentId, agentProcess]) => ({
            agentId,
            pid: agentProcess.process.pid,
            uptime: Date.now() - agentProcess.startTime.getTime()
        }));

        return {
            totalRunning: this.activeProcesses.size,
            byStatus,
            processes
        };
    }
}

/**
 * Singleton instance for global access
 */
let lifecycleManager: AgentLifecycleManager | null = null;

/**
 * Initialize the lifecycle manager with workspace root
 * Should be called during extension activation
 */
export function initializeLifecycleManager(workspaceRoot: string): AgentLifecycleManager {
    lifecycleManager = new AgentLifecycleManager(workspaceRoot);
    return lifecycleManager;
}

/**
 * Get the singleton lifecycle manager instance
 * @throws Error if not initialized
 */
export function getLifecycleManager(): AgentLifecycleManager {
    if (!lifecycleManager) {
        throw new Error('AgentLifecycleManager not initialized. Call initializeLifecycleManager first.');
    }
    return lifecycleManager;
}

/**
 * Cleanup and reset the lifecycle manager
 * Should be called during extension deactivation
 */
export async function cleanupLifecycleManager(): Promise<void> {
    if (lifecycleManager) {
        await lifecycleManager.stopAllAgents(10000);
        lifecycleManager = null;
    }
}

// Export standalone functions for convenience
export async function startAgent(agentId: number): Promise<void> {
    return getLifecycleManager().startAgent(agentId);
}

export async function pauseAgent(agentId: number): Promise<void> {
    return getLifecycleManager().pauseAgent(agentId);
}

export async function resumeAgent(agentId: number): Promise<void> {
    return getLifecycleManager().resumeAgent(agentId);
}

export async function stopAgent(agentId: number): Promise<void> {
    return getLifecycleManager().stopAgent(agentId);
}

export async function stopAllAgents(): Promise<void> {
    return getLifecycleManager().stopAllAgents();
}

export function getAgentProcess(agentId: number): ChildProcess | null {
    return getLifecycleManager().getAgentProcess(agentId);
}

export function isAgentRunning(agentId: number): boolean {
    return getLifecycleManager().isAgentRunning(agentId);
}
