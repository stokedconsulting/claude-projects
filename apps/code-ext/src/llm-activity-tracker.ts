import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

/**
 * Information about a single LLM session
 */
export interface LlmSessionInfo {
    sessionId: string;
    provider: string;       // 'claude-code' | 'qwen-coder' | string
    state: 'responding' | 'stopped' | 'idle';
    taskDescription: string;
    workspacePath: string;
    lastUpdated: number;    // epoch ms
}

/**
 * Signal file structure (matches ClaudeSignal interface)
 */
interface SignalFile {
    state: 'responding' | 'stopped' | 'idle';
    timestamp: string;
    session_id: string;
    event: string;
    provider?: string;
    notification_type?: string;
    project_update?: {
        type: 'task_completed' | 'issue_closed' | 'status_updated' | 'item_updated';
        project_number?: number;
        issue_number?: number;
        item_id?: string;
        status?: string;
    };
}

/**
 * Workspace paths cache entry
 */
interface WorkspacePathsCache {
    paths: string[];
    timestamp: number;
}

/**
 * LLM Activity Tracker - Provider-agnostic session monitoring
 *
 * Scans .claude-sessions/*.signal files across workspace and worktrees
 * to track active LLM sessions from any provider (Claude Code, Qwen Coder, etc.)
 */
export class LlmActivityTracker extends EventEmitter {
    private readonly SESSIONS_DIR = '.claude-sessions';
    private readonly CACHE_TTL = 60000; // 60 seconds for workspace paths cache
    private readonly ACTIVE_THRESHOLD = 300000; // 5 minutes for file modification
    private readonly RECENT_THRESHOLD = 60000; // 60 seconds for stopped/idle sessions

    private workspacePathsCache?: WorkspacePathsCache;
    private pollingInterval?: NodeJS.Timeout;

    constructor(private workspaceRoot: string) {
        super();
    }

    /**
     * Get count of active sessions across all workspace paths
     */
    public getActiveSessionCount(): number {
        const sessions = this.getActiveSessions();
        return sessions.length;
    }

    /**
     * Get detailed information about all active sessions
     */
    public getActiveSessions(): LlmSessionInfo[] {
        const workspacePaths = this.getWorkspacePaths();
        const sessions: LlmSessionInfo[] = [];

        for (const workspacePath of workspacePaths) {
            const pathSessions = this.scanSessionsInPath(workspacePath);
            sessions.push(...pathSessions);
        }

        return sessions;
    }

    /**
     * Get sessions grouped by provider
     */
    public getSessionsByProvider(): Map<string, LlmSessionInfo[]> {
        const sessions = this.getActiveSessions();
        const byProvider = new Map<string, LlmSessionInfo[]>();

        for (const session of sessions) {
            const existing = byProvider.get(session.provider) || [];
            existing.push(session);
            byProvider.set(session.provider, existing);
        }

        return byProvider;
    }

    /**
     * Manually refresh session data and emit update event
     */
    public refresh(): void {
        const sessions = this.getActiveSessions();
        this.emit('update', sessions);
    }

    /**
     * Start periodic polling for session updates
     */
    public startPolling(intervalMs: number): void {
        if (this.pollingInterval) {
            this.stopPolling();
        }

        this.pollingInterval = setInterval(() => {
            this.refresh();
        }, intervalMs);

        // Emit initial state
        this.refresh();
    }

    /**
     * Stop periodic polling
     */
    public stopPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.stopPolling();
        this.removeAllListeners();
    }

    /**
     * Scan sessions in a specific workspace path
     */
    private scanSessionsInPath(workspacePath: string): LlmSessionInfo[] {
        const sessionsPath = path.join(workspacePath, this.SESSIONS_DIR);

        if (!fs.existsSync(sessionsPath)) {
            return [];
        }

        const sessions: LlmSessionInfo[] = [];
        const now = Date.now();

        try {
            const files = fs.readdirSync(sessionsPath);

            for (const file of files) {
                if (!file.endsWith('.signal')) {
                    continue;
                }

                const filePath = path.join(sessionsPath, file);

                try {
                    // Check file modification time
                    const stats = fs.statSync(filePath);
                    const timeSinceModified = now - stats.mtimeMs;

                    // Skip if too old (not modified in 5 minutes)
                    if (timeSinceModified > this.ACTIVE_THRESHOLD) {
                        continue;
                    }

                    // Read and parse signal file
                    const signalContent = fs.readFileSync(filePath, 'utf-8');
                    const signal: SignalFile = JSON.parse(signalContent);

                    // Determine if session is active
                    const isActive = this.isSessionActive(signal.state, timeSinceModified);

                    if (!isActive) {
                        continue;
                    }

                    // Extract provider from filename or signal
                    const provider = this.extractProvider(file, signal);

                    // Extract task description
                    const taskDescription = this.extractTaskDescription(signal);

                    // Create session info
                    const sessionInfo: LlmSessionInfo = {
                        sessionId: signal.session_id || path.basename(file, '.signal'),
                        provider,
                        state: signal.state,
                        taskDescription,
                        workspacePath,
                        lastUpdated: stats.mtimeMs
                    };

                    sessions.push(sessionInfo);
                } catch (error) {
                    // Skip files that can't be read or parsed
                    console.warn(`Failed to parse signal file ${file}:`, error);
                    continue;
                }
            }
        } catch (error) {
            console.error(`Error scanning sessions in ${workspacePath}:`, error);
        }

        return sessions;
    }

    /**
     * Determine if a session is active based on state and modification time
     * Matches logic from ClaudeMonitor.countActiveSessionsInPath
     */
    private isSessionActive(state: string, timeSinceModified: number): boolean {
        // Active if responding
        if (state === 'responding') {
            return true;
        }

        // Active if stopped/idle but recently modified (within 60 seconds)
        if ((state === 'stopped' || state === 'idle') && timeSinceModified < this.RECENT_THRESHOLD) {
            return true;
        }

        return false;
    }

    /**
     * Extract provider from filename or signal content
     * Supports: {provider}-{id}.signal format or provider field in JSON
     */
    private extractProvider(filename: string, signal: SignalFile): string {
        // First, check if signal has explicit provider field
        if (signal.provider) {
            return signal.provider;
        }

        // Try to extract from filename pattern: {provider}-{rest}.signal
        const baseFilename = path.basename(filename, '.signal');
        const knownProviders = ['claude', 'qwen', 'openai', 'anthropic', 'mistral'];

        for (const provider of knownProviders) {
            if (baseFilename.startsWith(`${provider}-`)) {
                return `${provider}-code`;
            }
        }

        // Default to claude-code (backward compatibility)
        return 'claude-code';
    }

    /**
     * Extract task description from signal file
     */
    private extractTaskDescription(signal: SignalFile): string {
        // Priority 1: project_update.type if available
        if (signal.project_update?.type) {
            return signal.project_update.type;
        }

        // Priority 2: event field if not SessionStart/CreationStart
        if (signal.event && signal.event !== 'SessionStart' && signal.event !== 'CreationStart') {
            return signal.event;
        }

        // Fallback: generic "running"
        return 'running';
    }

    /**
     * Get all workspace paths (main workspace + worktrees)
     * Cached with 60-second TTL
     */
    private getWorkspacePaths(): string[] {
        const now = Date.now();

        // Return cached paths if still valid
        if (this.workspacePathsCache && (now - this.workspacePathsCache.timestamp) < this.CACHE_TTL) {
            return this.workspacePathsCache.paths;
        }

        // Refresh cache
        const paths: string[] = [this.workspaceRoot];

        try {
            const { execSync } = require('child_process');
            const worktreesOutput = execSync('git worktree list --porcelain', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
            });

            // Parse worktree output
            const lines = worktreesOutput.split('\n');
            for (const line of lines) {
                if (line.startsWith('worktree ')) {
                    const worktreePath = line.substring('worktree '.length).trim();
                    if (worktreePath && worktreePath !== this.workspaceRoot) {
                        paths.push(worktreePath);
                    }
                }
            }
        } catch (error) {
            // Not a git repo or no worktrees - that's fine, just use main workspace
            console.log('No git worktrees found or not a git repository');
        }

        // Update cache
        this.workspacePathsCache = {
            paths,
            timestamp: now
        };

        return paths;
    }
}
