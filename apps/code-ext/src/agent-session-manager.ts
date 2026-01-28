import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent status values
 */
export type AgentStatus = 'idle' | 'working' | 'reviewing' | 'ideating' | 'paused';

/**
 * Agent session state stored in file system
 */
export interface AgentSession {
    agentId: string;
    status: AgentStatus;
    currentProjectNumber: number | null;
    currentPhase: string | null;
    branchName: string | null;
    lastHeartbeat: string;
    tasksCompleted: number;
    currentTaskDescription: string | null;
    errorCount: number;
    lastError: string | null;
}

/**
 * Agent Session Manager
 *
 * Manages file-based state tracking for individual agent sessions.
 * Files are stored in `.claude-sessions/` directory with naming convention:
 * `.claude-sessions/agent-{id}.session`
 */
export class AgentSessionManager {
    private readonly SESSIONS_DIR = '.claude-sessions';
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Get the full path to the sessions directory
     */
    public getSessionsDirectory(): string {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
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
     * Get the file path for a specific agent session
     */
    private getAgentSessionPath(agentId: number): string {
        return path.join(this.getSessionsDirectory(), `agent-${agentId}.session`);
    }

    /**
     * Create default agent session object
     */
    private createDefaultSession(agentId: number): AgentSession {
        return {
            agentId: `agent-${agentId}`,
            status: 'idle',
            currentProjectNumber: null,
            currentPhase: null,
            branchName: null,
            lastHeartbeat: new Date().toISOString(),
            tasksCompleted: 0,
            currentTaskDescription: null,
            errorCount: 0,
            lastError: null
        };
    }

    /**
     * Validate that a session object has all required fields
     */
    private isValidSession(obj: any): obj is AgentSession {
        if (!obj || typeof obj !== 'object') {
            return false;
        }

        const validStatuses: AgentStatus[] = ['idle', 'working', 'reviewing', 'ideating', 'paused'];

        return (
            typeof obj.agentId === 'string' &&
            validStatuses.includes(obj.status) &&
            (obj.currentProjectNumber === null || typeof obj.currentProjectNumber === 'number') &&
            (obj.currentPhase === null || typeof obj.currentPhase === 'string') &&
            (obj.branchName === null || typeof obj.branchName === 'string') &&
            typeof obj.lastHeartbeat === 'string' &&
            typeof obj.tasksCompleted === 'number' &&
            (obj.currentTaskDescription === null || typeof obj.currentTaskDescription === 'string') &&
            typeof obj.errorCount === 'number' &&
            (obj.lastError === null || typeof obj.lastError === 'string')
        );
    }

    /**
     * Write session data atomically using temp file + rename pattern
     * This prevents file corruption from incomplete writes
     */
    private async writeSessionAtomic(filePath: string, session: AgentSession): Promise<void> {
        const tempPath = `${filePath}.tmp`;
        const content = JSON.stringify(session, null, 2);

        // Write to temp file
        fs.writeFileSync(tempPath, content, 'utf-8');

        // Atomically rename temp file to target file
        fs.renameSync(tempPath, filePath);
    }

    /**
     * Retry an async operation with exponential backoff
     * Backoff sequence: 1s, 2s, 4s (max 3 retries)
     */
    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        context: string,
        maxRetries: number = 3
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s

                console.error(
                    `[AgentSessionManager] ${context} failed (attempt ${attempt + 1}/${maxRetries}):`,
                    error
                );

                if (attempt < maxRetries - 1) {
                    console.log(
                        `[AgentSessionManager] Retrying in ${backoffMs}ms...`
                    );
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        throw lastError;
    }

    /**
     * Create a new agent session file
     */
    public async createAgentSession(agentId: number): Promise<AgentSession> {
        this.ensureSessionsDirectory();

        const session = this.createDefaultSession(agentId);
        const filePath = this.getAgentSessionPath(agentId);

        await this.retryWithBackoff(
            async () => {
                await this.writeSessionAtomic(filePath, session);
            },
            `Create agent session ${agentId}`,
            3
        );

        console.log(`[AgentSessionManager] Created session for agent-${agentId}`);
        return session;
    }

    /**
     * Read an agent session file with validation
     * Returns null if file doesn't exist
     * Auto-recovers from corruption by recreating with default idle state
     */
    public async readAgentSession(agentId: number): Promise<AgentSession | null> {
        const filePath = this.getAgentSessionPath(agentId);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);

            if (this.isValidSession(parsed)) {
                return parsed;
            } else {
                // Invalid session structure - recreate with defaults
                console.error(
                    `[AgentSessionManager] Invalid session structure for agent-${agentId}, recreating with defaults`
                );
                const defaultSession = this.createDefaultSession(agentId);
                await this.writeSessionAtomic(filePath, defaultSession);
                return defaultSession;
            }
        } catch (error) {
            // Corrupted JSON or read error - recreate with defaults
            console.error(
                `[AgentSessionManager] Corrupted session file for agent-${agentId}, recreating with defaults:`,
                error
            );

            try {
                const defaultSession = this.createDefaultSession(agentId);
                await this.writeSessionAtomic(filePath, defaultSession);
                return defaultSession;
            } catch (writeError) {
                console.error(
                    `[AgentSessionManager] Failed to recreate corrupted session file:`,
                    writeError
                );
                return null;
            }
        }
    }

    /**
     * Update an agent session atomically
     * Merges updates with existing session data
     */
    public async updateAgentSession(
        agentId: number,
        updates: Partial<AgentSession>
    ): Promise<void> {
        const existingSession = await this.readAgentSession(agentId);

        if (!existingSession) {
            throw new Error(`Agent session ${agentId} does not exist. Call createAgentSession first.`);
        }

        // Merge updates with existing session
        const updatedSession: AgentSession = {
            ...existingSession,
            ...updates,
            // Always update heartbeat on any update
            lastHeartbeat: new Date().toISOString()
        };

        const filePath = this.getAgentSessionPath(agentId);

        await this.retryWithBackoff(
            async () => {
                await this.writeSessionAtomic(filePath, updatedSession);
            },
            `Update agent session ${agentId}`,
            3
        );

        console.log(`[AgentSessionManager] Updated session for agent-${agentId}`);
    }

    /**
     * Delete an agent session file
     */
    public async deleteAgentSession(agentId: number): Promise<void> {
        const filePath = this.getAgentSessionPath(agentId);

        if (!fs.existsSync(filePath)) {
            console.log(`[AgentSessionManager] Session file for agent-${agentId} does not exist, skipping delete`);
            return;
        }

        await this.retryWithBackoff(
            async () => {
                fs.unlinkSync(filePath);
            },
            `Delete agent session ${agentId}`,
            3
        );

        console.log(`[AgentSessionManager] Deleted session for agent-${agentId}`);
    }

    /**
     * List all active agent sessions
     * Returns array of all valid session objects
     */
    public async listAgentSessions(): Promise<AgentSession[]> {
        const sessionsPath = this.getSessionsDirectory();

        if (!fs.existsSync(sessionsPath)) {
            return [];
        }

        const files = fs.readdirSync(sessionsPath);
        const sessionFiles = files.filter(f => f.match(/^agent-\d+\.session$/));

        const sessions: AgentSession[] = [];

        for (const file of sessionFiles) {
            // Extract agent ID from filename
            const match = file.match(/^agent-(\d+)\.session$/);
            if (!match) {
                continue;
            }

            const agentId = parseInt(match[1], 10);
            const session = await this.readAgentSession(agentId);

            if (session) {
                sessions.push(session);
            }
        }

        return sessions;
    }
}
