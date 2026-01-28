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
exports.ClaudeMonitor = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ClaudeMonitor {
    workspaceRoot;
    sessions = new Map();
    CONTINUATION_DELAY = 10000; // 10 seconds after stopped before sending continuation
    CHECK_INTERVAL = 5000; // Check every 5 seconds
    CONTINUATION_COOLDOWN = 120000; // 2 minutes between continuation prompts
    SESSIONS_DIR = '.claude-sessions';
    // DEPRECATED: stateValidator removed - use MCP Server tools instead
    projectUpdateCallback;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.ensureSessionsDirectory();
        // DEPRECATED: stateValidator removed - use MCP Server tools instead
    }
    /**
     * Set callback for project update notifications
     */
    setProjectUpdateCallback(callback) {
        this.projectUpdateCallback = callback;
    }
    ensureSessionsDirectory() {
        const sessionsPath = path.join(this.workspaceRoot, this.SESSIONS_DIR);
        if (!fs.existsSync(sessionsPath)) {
            fs.mkdirSync(sessionsPath, { recursive: true });
        }
    }
    /**
     * Start monitoring a Claude session
     */
    startSession(projectNumber, terminal) {
        const sessionId = this.generateSessionId();
        const responseFilePath = path.join(this.workspaceRoot, this.SESSIONS_DIR, `${sessionId}.response.md`);
        const signalFilePath = path.join(this.workspaceRoot, this.SESSIONS_DIR, `${sessionId}.signal`);
        // Create the response file
        fs.writeFileSync(responseFilePath, `# Claude Session ${sessionId}\n\nProject: #${projectNumber}\nStarted: ${new Date().toISOString()}\n\n---\n\n`);
        // Create initial signal file (responding state)
        const initialSignal = {
            state: 'responding',
            timestamp: new Date().toISOString(),
            session_id: sessionId,
            event: 'SessionStart'
        };
        fs.writeFileSync(signalFilePath, JSON.stringify(initialSignal, null, 2));
        const session = {
            sessionId,
            projectNumber,
            terminal,
            responseFilePath,
            signalFilePath,
            lastModified: Date.now(),
            isActive: true,
            continuationSent: false,
            lastSignalState: 'responding',
            sessionType: 'execution'
        };
        // Set up file watcher for signal file
        this.setupSignalWatcher(session);
        // Also keep interval-based checking as fallback
        session.checkInterval = setInterval(() => {
            this.checkSession(sessionId);
        }, this.CHECK_INTERVAL);
        this.sessions.set(sessionId, session);
        vscode.window.showInformationMessage(`Started monitoring Claude session for Project #${projectNumber}`, 'View Session File').then(selection => {
            if (selection === 'View Session File') {
                vscode.workspace.openTextDocument(responseFilePath).then(doc => {
                    vscode.window.showTextDocument(doc, { preview: false });
                });
            }
        });
        return sessionId;
    }
    /**
     * Start monitoring a Claude session for project CREATION
     * Different from startSession - uses creation-specific continuation prompts
     */
    startCreationSession(projectDescription, terminal) {
        const sessionId = this.generateSessionId();
        const responseFilePath = path.join(this.workspaceRoot, this.SESSIONS_DIR, `${sessionId}.response.md`);
        const signalFilePath = path.join(this.workspaceRoot, this.SESSIONS_DIR, `${sessionId}.signal`);
        // Create the response file
        const shortDesc = projectDescription.substring(0, 50) + (projectDescription.length > 50 ? '...' : '');
        fs.writeFileSync(responseFilePath, `# Claude Creation Session ${sessionId}\n\nProject: ${shortDesc}\nStarted: ${new Date().toISOString()}\n\n---\n\n`);
        // Create initial signal file (responding state)
        const initialSignal = {
            state: 'responding',
            timestamp: new Date().toISOString(),
            session_id: sessionId,
            event: 'CreationStart'
        };
        fs.writeFileSync(signalFilePath, JSON.stringify(initialSignal, null, 2));
        const session = {
            sessionId,
            projectNumber: 0, // No project number yet - it's being created
            terminal,
            responseFilePath,
            signalFilePath,
            lastModified: Date.now(),
            isActive: true,
            continuationSent: false,
            lastSignalState: 'responding',
            sessionType: 'creation',
            projectDescription
        };
        // Set up file watcher for signal file
        this.setupSignalWatcher(session);
        // Also keep interval-based checking as fallback
        session.checkInterval = setInterval(() => {
            this.checkSession(sessionId);
        }, this.CHECK_INTERVAL);
        this.sessions.set(sessionId, session);
        vscode.window.showInformationMessage(`Started monitoring project creation: ${shortDesc}`, 'View Session File').then(selection => {
            if (selection === 'View Session File') {
                vscode.workspace.openTextDocument(responseFilePath).then(doc => {
                    vscode.window.showTextDocument(doc, { preview: false });
                });
            }
        });
        return sessionId;
    }
    /**
     * Set up file watcher for signal file changes
     */
    setupSignalWatcher(session) {
        const signalDir = path.dirname(session.signalFilePath);
        const signalFileName = path.basename(session.signalFilePath);
        try {
            // Watch the directory for changes to the signal file
            session.signalWatcher = fs.watch(signalDir, (eventType, filename) => {
                if (filename === signalFileName && eventType === 'change') {
                    this.handleSignalChange(session.sessionId);
                }
            });
            console.log(`Signal watcher set up for session ${session.sessionId}`);
        }
        catch (error) {
            console.error(`Failed to set up signal watcher for session ${session.sessionId}:`, error);
        }
    }
    /**
     * Handle signal file changes
     */
    handleSignalChange(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            return;
        }
        try {
            const signalContent = fs.readFileSync(session.signalFilePath, 'utf-8');
            const signal = JSON.parse(signalContent);
            console.log(`Session ${sessionId}: Signal state changed to ${signal.state}`);
            // Check for project update events
            if (signal.project_update) {
                console.log(`Session ${sessionId}: Project update detected:`, signal.project_update);
                if (this.projectUpdateCallback) {
                    this.projectUpdateCallback(signal);
                }
            }
            // Track state transitions
            const previousState = session.lastSignalState;
            session.lastSignalState = signal.state;
            if (signal.state === 'responding') {
                // Claude is responding, reset continuation tracking
                session.continuationSent = false;
                session.stoppedSinceTime = undefined;
                console.log(`Session ${sessionId}: Claude is responding, reset continuation tracking`);
            }
            else if (signal.state === 'stopped' || signal.state === 'idle') {
                // Claude has stopped or is idle
                if (previousState === 'responding') {
                    // Just transitioned to stopped
                    session.stoppedSinceTime = Date.now();
                    console.log(`Session ${sessionId}: Claude stopped, starting delay timer`);
                }
                // Log to response file
                const event = signal.state === 'idle' ? 'idle (60+ seconds)' : 'stopped';
                const logEntry = `\n**[${new Date().toISOString()}] Claude ${event}**\n`;
                fs.appendFileSync(session.responseFilePath, logEntry);
            }
        }
        catch (error) {
            console.error(`Error handling signal change for session ${sessionId}:`, error);
        }
    }
    /**
     * Check if a session needs a continuation prompt
     */
    checkSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isActive) {
            return;
        }
        try {
            // Try to read signal file first
            if (fs.existsSync(session.signalFilePath)) {
                const signalContent = fs.readFileSync(session.signalFilePath, 'utf-8');
                const signal = JSON.parse(signalContent);
                // Update state if needed
                if (signal.state !== session.lastSignalState) {
                    this.handleSignalChange(sessionId);
                }
                // Check if Claude is in stopped/idle state
                if ((signal.state === 'stopped' || signal.state === 'idle') && session.stoppedSinceTime) {
                    const timeSinceStopped = Date.now() - session.stoppedSinceTime;
                    // Check if enough time has passed since stopped
                    if (timeSinceStopped >= this.CONTINUATION_DELAY) {
                        // Check cooldown
                        if (session.lastContinuationTime) {
                            const timeSinceLastContinuation = Date.now() - session.lastContinuationTime;
                            if (timeSinceLastContinuation < this.CONTINUATION_COOLDOWN) {
                                console.log(`Session ${sessionId}: In cooldown period, skipping continuation`);
                                return;
                            }
                        }
                        // Send continuation if not already sent for this stop
                        if (!session.continuationSent) {
                            console.log(`Session ${sessionId}: Sending continuation prompt`);
                            this.sendContinuationPrompt(session);
                            session.continuationSent = true;
                            session.lastContinuationTime = Date.now();
                        }
                    }
                }
                return;
            }
            // Fallback: Use file modification time if no signal file
            this.checkSessionFallback(session);
        }
        catch (error) {
            console.error(`Error checking session ${sessionId}:`, error);
            // Fall back to old method on error
            this.checkSessionFallback(session);
        }
    }
    /**
     * Fallback session check using file modification timestamps
     */
    checkSessionFallback(session) {
        try {
            const stats = fs.statSync(session.responseFilePath);
            const fileModifiedTime = stats.mtimeMs;
            // Check if file has been updated
            if (fileModifiedTime > session.lastModified) {
                // File was updated, Claude is working
                session.lastModified = fileModifiedTime;
                session.continuationSent = false;
                return;
            }
            // Check if we've exceeded the inactivity threshold (60 seconds for fallback)
            const timeSinceLastUpdate = Date.now() - session.lastModified;
            if (timeSinceLastUpdate > 60000) {
                // Check cooldown
                if (session.lastContinuationTime) {
                    const timeSinceLastContinuation = Date.now() - session.lastContinuationTime;
                    if (timeSinceLastContinuation < this.CONTINUATION_COOLDOWN) {
                        return;
                    }
                }
                if (!session.continuationSent) {
                    console.log(`Session ${session.sessionId}: Fallback - sending continuation prompt`);
                    this.sendContinuationPrompt(session);
                    session.continuationSent = true;
                    session.lastContinuationTime = Date.now();
                }
            }
        }
        catch (error) {
            console.error(`Error in fallback check for session ${session.sessionId}:`, error);
        }
    }
    /**
     * Send a continuation prompt to Claude
     */
    async sendContinuationPrompt(session) {
        // Try to get smart prompt based on project state
        let prompt;
        try {
            prompt = await this.generateSmartContinuationPrompt(session);
        }
        catch (error) {
            console.error('Failed to generate smart prompt, using fallback:', error);
            // Fallback to generic prompt
            const continuationPrompts = [
                "Please continue working through the remaining project items. Review the task list and proceed with the next incomplete item.",
                "Continue with the project. Check the current status and move forward with the next task that needs attention.",
                "Keep going! Review what's been completed and continue with the next item in the project plan.",
                "Please proceed with the next phase or task in the project. Don't stop until all items are complete.",
                "Continue working on this project. Check the GitHub project board and tackle the next item that needs work."
            ];
            const promptIndex = Math.floor(Date.now() / 60000) % continuationPrompts.length;
            prompt = continuationPrompts[promptIndex];
        }
        // Log to the response file
        const logEntry = `\n\n---\n**[${new Date().toISOString()}] Auto-continuation triggered**\n\n${prompt}\n\n---\n\n`;
        fs.appendFileSync(session.responseFilePath, logEntry);
        // Update signal file to responding state
        const signal = {
            state: 'responding',
            timestamp: new Date().toISOString(),
            session_id: session.sessionId,
            event: 'AutoContinuation'
        };
        try {
            fs.writeFileSync(session.signalFilePath, JSON.stringify(signal, null, 2));
            session.lastSignalState = 'responding';
            session.stoppedSinceTime = undefined;
        }
        catch (error) {
            console.error(`Failed to update signal file for session ${session.sessionId}:`, error);
        }
        // Send to terminal with explicit submission
        session.terminal.sendText(prompt, true);
        vscode.window.showInformationMessage(`⚡ Sent continuation prompt to Project #${session.projectNumber}`, 'View Session').then(selection => {
            if (selection === 'View Session') {
                vscode.workspace.openTextDocument(session.responseFilePath).then(doc => {
                    vscode.window.showTextDocument(doc, { preview: false });
                });
            }
        });
    }
    /**
     * Generate a smart, context-aware continuation prompt
     */
    async generateSmartContinuationPrompt(session) {
        // Handle creation sessions differently
        if (session.sessionType === 'creation') {
            return this.generateCreationContinuationPrompt(session);
        }
        // TODO: Replace with MCP Server tool: get_project_phases
        // See: docs/mcp-migration-guide.md
        // For now, return a simple continuation prompt without state validation
        return `Please continue with Project #${session.projectNumber}.

Check the current state and continue with the next incomplete item.`;
    }
    /**
     * Generate continuation prompt for project CREATION sessions
     */
    generateCreationContinuationPrompt(session) {
        const projectDesc = session.projectDescription || 'the project';
        return `Please continue with project creation for: "${projectDesc}"

**CRITICAL:** The project creation is NOT complete until you have done ALL of the following:

1. ✅ Created the Product Feature Brief (pfb.md)
2. ✅ Created the Product Requirements Document (prd.md) with ALL phases and work items
3. ✅ Created the GitHub Project using MCP \`github_create_project\` tool
4. ✅ Created ALL master phase issues using MCP \`github_create_issue\` tool (format: \`[Phase N] Phase Title\`)
5. ✅ Created ALL individual work item issues from the PRD using MCP tools (format: \`[PN.M] Work Item Title\`)
6. ✅ Added ALL issues to the GitHub Project using MCP \`github_link_issue_to_project\` tool

**Next Action:** 
Review what has been created so far and continue with any remaining items.
Check the PRD for the full list of work items that need to be created as issues.

**When fully complete**, output:
\`\`\`
PROJECT CREATION COMPLETE
Project: [title]
URL: [project-url]
Master Issues: [count]
Work Items: [count]
\`\`\`

**DO NOT STOP** until all work items from the PRD have been created as GitHub issues!`;
    }
    // DEPRECATED: formatPhaseStatus removed - ProjectState type no longer available
    // Method was used by generateSmartContinuationPrompt which now uses simplified prompt
    /**
     * Stop monitoring a session
     */
    stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        session.isActive = false;
        if (session.checkInterval) {
            clearInterval(session.checkInterval);
        }
        if (session.signalWatcher) {
            session.signalWatcher.close();
        }
        // Log session end
        const endEntry = `\n\n---\n**Session ended: ${new Date().toISOString()}**\n`;
        fs.appendFileSync(session.responseFilePath, endEntry);
        // Clean up signal file
        try {
            if (fs.existsSync(session.signalFilePath)) {
                fs.unlinkSync(session.signalFilePath);
            }
        }
        catch (error) {
            console.error(`Failed to clean up signal file for session ${sessionId}:`, error);
        }
        this.sessions.delete(sessionId);
        vscode.window.showInformationMessage(`Stopped monitoring session for Project #${session.projectNumber}`);
    }
    /**
     * Stop all active sessions
     */
    stopAllSessions() {
        for (const [sessionId] of this.sessions) {
            this.stopSession(sessionId);
        }
    }
    /**
     * Get active sessions
     */
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter(s => s.isActive);
    }
    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `${timestamp}-${random}`;
    }
    /**
     * Clean up old session files (older than 7 days)
     */
    cleanupOldSessions() {
        const sessionsPath = path.join(this.workspaceRoot, this.SESSIONS_DIR);
        if (!fs.existsSync(sessionsPath)) {
            return;
        }
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const files = fs.readdirSync(sessionsPath);
        for (const file of files) {
            if (!file.endsWith('.response.md') && !file.endsWith('.signal')) {
                continue;
            }
            const filePath = path.join(sessionsPath, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < sevenDaysAgo) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up old session file: ${file}`);
            }
        }
    }
}
exports.ClaudeMonitor = ClaudeMonitor;
//# sourceMappingURL=claude-monitor.js.map