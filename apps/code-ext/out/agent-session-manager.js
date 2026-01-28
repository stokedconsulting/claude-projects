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
exports.AgentSessionManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Agent Session Manager
 *
 * Manages file-based state tracking for individual agent sessions.
 * Files are stored in `.claude-sessions/` directory with naming convention:
 * `.claude-sessions/agent-{id}.session`
 */
class AgentSessionManager {
    SESSIONS_DIR = '.claude-sessions';
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    /**
     * Get the full path to the sessions directory
     */
    getSessionsDirectory() {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
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
     * Get the file path for a specific agent session
     */
    getAgentSessionPath(agentId) {
        return path.join(this.getSessionsDirectory(), `agent-${agentId}.session`);
    }
    /**
     * Create default agent session object
     */
    createDefaultSession(agentId) {
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
    isValidSession(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        const validStatuses = ['idle', 'working', 'reviewing', 'ideating', 'paused'];
        return (typeof obj.agentId === 'string' &&
            validStatuses.includes(obj.status) &&
            (obj.currentProjectNumber === null || typeof obj.currentProjectNumber === 'number') &&
            (obj.currentPhase === null || typeof obj.currentPhase === 'string') &&
            (obj.branchName === null || typeof obj.branchName === 'string') &&
            typeof obj.lastHeartbeat === 'string' &&
            typeof obj.tasksCompleted === 'number' &&
            (obj.currentTaskDescription === null || typeof obj.currentTaskDescription === 'string') &&
            typeof obj.errorCount === 'number' &&
            (obj.lastError === null || typeof obj.lastError === 'string'));
    }
    /**
     * Write session data atomically using temp file + rename pattern
     * This prevents file corruption from incomplete writes
     */
    async writeSessionAtomic(filePath, session) {
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
    async retryWithBackoff(operation, context, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                console.error(`[AgentSessionManager] ${context} failed (attempt ${attempt + 1}/${maxRetries}):`, error);
                if (attempt < maxRetries - 1) {
                    console.log(`[AgentSessionManager] Retrying in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }
        throw lastError;
    }
    /**
     * Create a new agent session file
     */
    async createAgentSession(agentId) {
        this.ensureSessionsDirectory();
        const session = this.createDefaultSession(agentId);
        const filePath = this.getAgentSessionPath(agentId);
        await this.retryWithBackoff(async () => {
            await this.writeSessionAtomic(filePath, session);
        }, `Create agent session ${agentId}`, 3);
        console.log(`[AgentSessionManager] Created session for agent-${agentId}`);
        return session;
    }
    /**
     * Read an agent session file with validation
     * Returns null if file doesn't exist
     * Auto-recovers from corruption by recreating with default idle state
     */
    async readAgentSession(agentId) {
        const filePath = this.getAgentSessionPath(agentId);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (this.isValidSession(parsed)) {
                return parsed;
            }
            else {
                // Invalid session structure - recreate with defaults
                console.error(`[AgentSessionManager] Invalid session structure for agent-${agentId}, recreating with defaults`);
                const defaultSession = this.createDefaultSession(agentId);
                await this.writeSessionAtomic(filePath, defaultSession);
                return defaultSession;
            }
        }
        catch (error) {
            // Corrupted JSON or read error - recreate with defaults
            console.error(`[AgentSessionManager] Corrupted session file for agent-${agentId}, recreating with defaults:`, error);
            try {
                const defaultSession = this.createDefaultSession(agentId);
                await this.writeSessionAtomic(filePath, defaultSession);
                return defaultSession;
            }
            catch (writeError) {
                console.error(`[AgentSessionManager] Failed to recreate corrupted session file:`, writeError);
                return null;
            }
        }
    }
    /**
     * Update an agent session atomically
     * Merges updates with existing session data
     */
    async updateAgentSession(agentId, updates) {
        const existingSession = await this.readAgentSession(agentId);
        if (!existingSession) {
            throw new Error(`Agent session ${agentId} does not exist. Call createAgentSession first.`);
        }
        // Merge updates with existing session
        const updatedSession = {
            ...existingSession,
            ...updates,
            // Always update heartbeat on any update
            lastHeartbeat: new Date().toISOString()
        };
        const filePath = this.getAgentSessionPath(agentId);
        await this.retryWithBackoff(async () => {
            await this.writeSessionAtomic(filePath, updatedSession);
        }, `Update agent session ${agentId}`, 3);
        console.log(`[AgentSessionManager] Updated session for agent-${agentId}`);
    }
    /**
     * Delete an agent session file
     */
    async deleteAgentSession(agentId) {
        const filePath = this.getAgentSessionPath(agentId);
        if (!fs.existsSync(filePath)) {
            console.log(`[AgentSessionManager] Session file for agent-${agentId} does not exist, skipping delete`);
            return;
        }
        await this.retryWithBackoff(async () => {
            fs.unlinkSync(filePath);
        }, `Delete agent session ${agentId}`, 3);
        console.log(`[AgentSessionManager] Deleted session for agent-${agentId}`);
    }
    /**
     * List all active agent sessions
     * Returns array of all valid session objects
     */
    async listAgentSessions() {
        const sessionsPath = this.getSessionsDirectory();
        if (!fs.existsSync(sessionsPath)) {
            return [];
        }
        const files = fs.readdirSync(sessionsPath);
        const sessionFiles = files.filter(f => f.match(/^agent-\d+\.session$/));
        const sessions = [];
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
exports.AgentSessionManager = AgentSessionManager;
//# sourceMappingURL=agent-session-manager.js.map