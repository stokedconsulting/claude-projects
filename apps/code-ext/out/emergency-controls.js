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
exports.EmergencyControls = void 0;
exports.initializeEmergencyControls = initializeEmergencyControls;
exports.getEmergencyControls = getEmergencyControls;
exports.cleanupEmergencyControls = cleanupEmergencyControls;
exports.emergencyStopAllAgents = emergencyStopAllAgents;
exports.restartAgent = restartAgent;
exports.resetAgentState = resetAgentState;
exports.recoverStuckProjects = recoverStuckProjects;
exports.purgeQueue = purgeQueue;
exports.getRecoveryOptions = getRecoveryOptions;
exports.logEmergencyAction = logEmergencyAction;
exports.checkForOrphanedSessions = checkForOrphanedSessions;
exports.cleanupOrphanedSessions = cleanupOrphanedSessions;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Emergency Controls & Recovery
 *
 * Provides emergency stop, agent restart, and state recovery mechanisms.
 *
 * Work Item 5.5: Emergency Controls & Recovery
 * - Emergency stop all agents with SIGKILL
 * - Restart agents after clearing error state
 * - Reset agent state and restart from idle
 * - Recover stuck projects with stale claims
 * - Purge queue of pending projects
 * - Audit logging of all emergency operations
 */
class EmergencyControls {
    lifecycleManager;
    sessionManager;
    queueManager;
    workspaceRoot;
    ACTIONS_LOG_FILE = 'emergency-actions.json';
    STALE_CLAIM_THRESHOLD_MS = 8 * 60 * 60 * 1000; // 8 hours
    constructor(lifecycleManager, sessionManager, queueManager, workspaceRoot) {
        this.lifecycleManager = lifecycleManager;
        this.sessionManager = sessionManager;
        this.queueManager = queueManager;
        this.workspaceRoot = workspaceRoot;
    }
    /**
     * Get the full path to the emergency actions log file
     */
    getActionsLogPath() {
        return path.join(this.workspaceRoot, '.claude-sessions', this.ACTIONS_LOG_FILE);
    }
    /**
     * Read emergency actions log
     */
    readActionsLog() {
        const logPath = this.getActionsLogPath();
        if (!fs.existsSync(logPath)) {
            return [];
        }
        try {
            const content = fs.readFileSync(logPath, 'utf-8');
            const parsed = JSON.parse(content);
            if (!Array.isArray(parsed)) {
                console.error('[EmergencyControls] Invalid actions log structure, resetting');
                return [];
            }
            return parsed;
        }
        catch (error) {
            console.error('[EmergencyControls] Error reading actions log:', error);
            return [];
        }
    }
    /**
     * Append entry to emergency actions log
     */
    appendToActionsLog(entry) {
        const logPath = this.getActionsLogPath();
        const sessionsDir = path.dirname(logPath);
        // Ensure directory exists
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }
        const existingLog = this.readActionsLog();
        existingLog.push(entry);
        // Keep only last 100 entries
        const trimmedLog = existingLog.slice(-100);
        fs.writeFileSync(logPath, JSON.stringify(trimmedLog, null, 2), 'utf-8');
    }
    /**
     * Log an emergency action
     * AC-5.5.f: When emergency operation is executed → operation is logged with timestamp
     *
     * @param action - Action name
     * @param details - Additional details object
     * @param result - Operation result
     */
    async logEmergencyAction(action, details, result = 'success') {
        try {
            const entry = {
                timestamp: new Date().toISOString(),
                action,
                userId: 'system', // In future, get from VSCode authentication
                details,
                result
            };
            this.appendToActionsLog(entry);
            console.log(`[EmergencyControls] Logged action: ${action} (${result})`);
        }
        catch (error) {
            console.error('[EmergencyControls] Failed to log emergency action:', error);
            // Don't throw - logging failure should not block emergency operations
        }
    }
    /**
     * Emergency stop all agents immediately
     * Uses SIGKILL for guaranteed termination.
     *
     * AC-5.5.a: When "Emergency Stop All" is clicked → confirmation shows affected agents/projects
     * AC-5.5.b: When emergency stop is confirmed → all agents stop within 5 seconds
     * AC-5.5.f: When emergency operation is executed → operation is logged with timestamp
     *
     * @param skipConfirmation - If true, skips confirmation dialog
     * @returns EmergencyStopResult with operation details
     */
    async emergencyStopAllAgents(skipConfirmation = false) {
        console.log('[EmergencyControls] Emergency stop all agents requested...');
        try {
            // Get all active sessions
            const sessions = await this.sessionManager.listAgentSessions();
            const activeClaims = await this.queueManager.getAllActiveClaims();
            if (sessions.length === 0) {
                console.log('[EmergencyControls] No agents to stop');
                const result = {
                    success: true,
                    agentsStopped: 0,
                    claimsReleased: 0,
                    timestamp: new Date().toISOString()
                };
                await this.logEmergencyAction('emergency_stop_all', { reason: 'No agents running' }, 'success');
                return result;
            }
            // Show confirmation dialog with impact details
            if (!skipConfirmation) {
                const workingAgents = sessions.filter(s => s.status === 'working').length;
                const message = `Emergency stop ${sessions.length} agent(s)?

This will immediately terminate:
- ${sessions.length} total agent(s)
- ${workingAgents} currently working agent(s)
- ${activeClaims.length} active claim(s) will be released

This action cannot be undone.`;
                const confirmation = await vscode.window.showWarningMessage(message, { modal: true }, 'Yes, stop all agents', 'Cancel');
                if (confirmation !== 'Yes, stop all agents') {
                    console.log('[EmergencyControls] Emergency stop cancelled by user');
                    const result = {
                        success: false,
                        agentsStopped: 0,
                        claimsReleased: 0,
                        timestamp: new Date().toISOString()
                    };
                    await this.logEmergencyAction('emergency_stop_all', { reason: 'Cancelled by user' }, 'failure');
                    return result;
                }
            }
            console.log(`[EmergencyControls] Emergency stopping ${sessions.length} agent(s)...`);
            // Stop all agents with 5 second timeout (uses SIGKILL after SIGTERM)
            await this.lifecycleManager.stopAllAgents(5000);
            // Release all claims
            let claimsReleased = 0;
            for (const claim of activeClaims) {
                await this.queueManager.releaseProjectClaim(claim.projectNumber, claim.issueNumber);
                claimsReleased++;
            }
            const result = {
                success: true,
                agentsStopped: sessions.length,
                claimsReleased,
                timestamp: new Date().toISOString()
            };
            await this.logEmergencyAction('emergency_stop_all', {
                agentsStopped: sessions.length,
                claimsReleased
            }, 'success');
            console.log(`[EmergencyControls] Emergency stop complete: ${sessions.length} agents stopped, ${claimsReleased} claims released`);
            return result;
        }
        catch (error) {
            console.error('[EmergencyControls] Emergency stop failed:', error);
            const result = {
                success: false,
                agentsStopped: 0,
                claimsReleased: 0,
                timestamp: new Date().toISOString()
            };
            await this.logEmergencyAction('emergency_stop_all', {
                error: error instanceof Error ? error.message : String(error)
            }, 'failure');
            throw error;
        }
    }
    /**
     * Restart an agent after clearing error state
     * Stops agent gracefully, clears error state, and restarts with same configuration.
     *
     * AC-5.5.c: When "Restart Agent" is clicked → agent stops, clears error, restarts within 10 seconds
     *
     * @param agentId - Numeric agent identifier
     */
    async restartAgent(agentId) {
        console.log(`[EmergencyControls] Restarting agent-${agentId}...`);
        try {
            // Get current session
            const session = await this.sessionManager.readAgentSession(agentId);
            // Stop agent if running
            if (this.lifecycleManager.isAgentRunning(agentId)) {
                console.log(`[EmergencyControls] Stopping agent-${agentId}...`);
                await this.lifecycleManager.stopAgent(agentId);
            }
            // Clear error state but preserve work
            if (session) {
                await this.sessionManager.updateAgentSession(agentId, {
                    status: 'idle',
                    lastError: null,
                    errorCount: 0
                });
            }
            // Wait 1 second before restart
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Restart agent
            console.log(`[EmergencyControls] Starting agent-${agentId}...`);
            await this.lifecycleManager.startAgent(agentId);
            await this.logEmergencyAction('restart_agent', { agentId }, 'success');
            console.log(`[EmergencyControls] Agent-${agentId} restarted successfully`);
        }
        catch (error) {
            console.error(`[EmergencyControls] Failed to restart agent-${agentId}:`, error);
            await this.logEmergencyAction('restart_agent', {
                agentId,
                error: error instanceof Error ? error.message : String(error)
            }, 'failure');
            throw error;
        }
    }
    /**
     * Reset agent state completely
     * Deletes session file, clears all metrics, and restarts from idle.
     *
     * AC-5.5.d: When "Reset Agent State" is clicked → session file deleted, agent restarts from idle
     *
     * @param agentId - Numeric agent identifier
     */
    async resetAgentState(agentId) {
        console.log(`[EmergencyControls] Resetting state for agent-${agentId}...`);
        try {
            // Release any claims for this agent
            const claims = await this.queueManager.getClaimedProjects(`agent-${agentId}`);
            for (const claim of claims) {
                await this.queueManager.releaseProjectClaim(claim.projectNumber, claim.issueNumber);
            }
            // Stop agent if running
            if (this.lifecycleManager.isAgentRunning(agentId)) {
                console.log(`[EmergencyControls] Stopping agent-${agentId}...`);
                await this.lifecycleManager.stopAgent(agentId);
            }
            // Delete session file
            await this.sessionManager.deleteAgentSession(agentId);
            // Wait 1 second before restart
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Start fresh
            console.log(`[EmergencyControls] Starting agent-${agentId} with fresh state...`);
            await this.lifecycleManager.startAgent(agentId);
            await this.logEmergencyAction('reset_agent_state', {
                agentId,
                claimsReleased: claims.length
            }, 'success');
            console.log(`[EmergencyControls] Agent-${agentId} state reset successfully`);
        }
        catch (error) {
            console.error(`[EmergencyControls] Failed to reset agent-${agentId} state:`, error);
            await this.logEmergencyAction('reset_agent_state', {
                agentId,
                error: error instanceof Error ? error.message : String(error)
            }, 'failure');
            throw error;
        }
    }
    /**
     * Recover stuck projects by releasing stale claims
     * Identifies claims older than 8 hours and releases them.
     *
     * AC-5.5.e: When stale claims are detected → claims are released automatically
     *
     * @returns RecoveryResult with details of recovered projects
     */
    async recoverStuckProjects() {
        console.log('[EmergencyControls] Recovering stuck projects...');
        try {
            const allClaims = await this.queueManager.getAllActiveClaims();
            const staleClaims = [];
            // Find stale claims (> 8 hours old)
            for (const claim of allClaims) {
                const claimedTime = new Date(claim.claimedAt).getTime();
                const age = Date.now() - claimedTime;
                if (age > this.STALE_CLAIM_THRESHOLD_MS) {
                    staleClaims.push(claim);
                }
            }
            if (staleClaims.length === 0) {
                console.log('[EmergencyControls] No stuck projects found');
                const result = {
                    projectsRecovered: 0,
                    claimsReleased: 0,
                    issuesReturned: []
                };
                await this.logEmergencyAction('recover_stuck_projects', { result }, 'success');
                return result;
            }
            // Release stale claims
            const issuesReturned = [];
            for (const claim of staleClaims) {
                await this.queueManager.releaseProjectClaim(claim.projectNumber, claim.issueNumber);
                issuesReturned.push(claim.issueNumber);
            }
            const result = {
                projectsRecovered: staleClaims.length,
                claimsReleased: staleClaims.length,
                issuesReturned
            };
            await this.logEmergencyAction('recover_stuck_projects', { result }, 'success');
            console.log(`[EmergencyControls] Recovered ${staleClaims.length} stuck project(s)`);
            return result;
        }
        catch (error) {
            console.error('[EmergencyControls] Failed to recover stuck projects:', error);
            await this.logEmergencyAction('recover_stuck_projects', {
                error: error instanceof Error ? error.message : String(error)
            }, 'failure');
            throw error;
        }
    }
    /**
     * Purge all pending projects from queue
     * Clears all active claims (with confirmation).
     *
     * @param skipConfirmation - If true, skips confirmation dialog
     * @returns PurgeResult with operation details
     */
    async purgeQueue(skipConfirmation = false) {
        console.log('[EmergencyControls] Purge queue requested...');
        try {
            const allClaims = await this.queueManager.getAllActiveClaims();
            if (allClaims.length === 0) {
                console.log('[EmergencyControls] Queue is already empty');
                const result = {
                    success: true,
                    projectsCleared: 0,
                    timestamp: new Date().toISOString()
                };
                await this.logEmergencyAction('purge_queue', { result }, 'success');
                return result;
            }
            // Show confirmation dialog
            if (!skipConfirmation) {
                const confirmation = await vscode.window.showWarningMessage(`Purge ${allClaims.length} active claim(s) from queue?\n\nThis will release all claims and return projects to backlog.\n\nThis action cannot be undone.`, { modal: true }, 'Yes, purge queue', 'Cancel');
                if (confirmation !== 'Yes, purge queue') {
                    console.log('[EmergencyControls] Purge cancelled by user');
                    const result = {
                        success: false,
                        projectsCleared: 0,
                        timestamp: new Date().toISOString()
                    };
                    await this.logEmergencyAction('purge_queue', { reason: 'Cancelled by user' }, 'failure');
                    return result;
                }
            }
            // Clear all claims
            await this.queueManager.clearAllClaims();
            const result = {
                success: true,
                projectsCleared: allClaims.length,
                timestamp: new Date().toISOString()
            };
            await this.logEmergencyAction('purge_queue', { result }, 'success');
            console.log(`[EmergencyControls] Purged ${allClaims.length} claim(s) from queue`);
            return result;
        }
        catch (error) {
            console.error('[EmergencyControls] Failed to purge queue:', error);
            const result = {
                success: false,
                projectsCleared: 0,
                timestamp: new Date().toISOString()
            };
            await this.logEmergencyAction('purge_queue', {
                error: error instanceof Error ? error.message : String(error)
            }, 'failure');
            throw error;
        }
    }
    /**
     * Get available recovery options based on current system state
     *
     * @returns Array of available recovery options
     */
    async getRecoveryOptions() {
        const options = [];
        try {
            const sessions = await this.sessionManager.listAgentSessions();
            const allClaims = await this.queueManager.getAllActiveClaims();
            // Emergency stop all
            if (sessions.length > 0) {
                const runningCount = sessions.filter(s => this.lifecycleManager.isAgentRunning(parseInt(s.agentId.replace('agent-', '')))).length;
                options.push({
                    action: 'emergency_stop_all',
                    description: 'Emergency Stop All Agents',
                    impact: `Will immediately stop ${runningCount} running agent(s) and release ${allClaims.length} claim(s)`,
                    requiresConfirmation: true
                });
            }
            // Restart agents with errors
            const errorAgents = sessions.filter(s => s.errorCount > 0 && s.lastError);
            if (errorAgents.length > 0) {
                options.push({
                    action: 'restart_error_agents',
                    description: 'Restart Agents with Errors',
                    impact: `Will restart ${errorAgents.length} agent(s) with errors`,
                    requiresConfirmation: false
                });
            }
            // Recover stuck projects
            const staleClaims = allClaims.filter(claim => {
                const claimedTime = new Date(claim.claimedAt).getTime();
                const age = Date.now() - claimedTime;
                return age > this.STALE_CLAIM_THRESHOLD_MS;
            });
            if (staleClaims.length > 0) {
                options.push({
                    action: 'recover_stuck_projects',
                    description: 'Recover Stuck Projects',
                    impact: `Will release ${staleClaims.length} stale claim(s) (> 8 hours old)`,
                    requiresConfirmation: false
                });
            }
            // Purge queue
            if (allClaims.length > 0) {
                options.push({
                    action: 'purge_queue',
                    description: 'Purge Queue',
                    impact: `Will clear all ${allClaims.length} active claim(s) from queue`,
                    requiresConfirmation: true
                });
            }
            // Reset agent state
            if (sessions.length > 0) {
                options.push({
                    action: 'reset_agent_state',
                    description: 'Reset Agent State (Individual)',
                    impact: 'Will delete session file and restart agent from idle',
                    requiresConfirmation: true
                });
            }
            return options;
        }
        catch (error) {
            console.error('[EmergencyControls] Failed to get recovery options:', error);
            return [];
        }
    }
    /**
     * Check for orphaned session files (no corresponding process)
     * Returns list of orphaned agent IDs
     */
    async checkForOrphanedSessions() {
        try {
            const sessions = await this.sessionManager.listAgentSessions();
            const orphanedAgents = [];
            for (const session of sessions) {
                const match = session.agentId.match(/^agent-(\d+)$/);
                if (match) {
                    const numericId = parseInt(match[1], 10);
                    if (!this.lifecycleManager.isAgentRunning(numericId)) {
                        orphanedAgents.push(numericId);
                    }
                }
            }
            return orphanedAgents;
        }
        catch (error) {
            console.error('[EmergencyControls] Failed to check for orphaned sessions:', error);
            return [];
        }
    }
    /**
     * Clean up orphaned sessions
     * Deletes session files for agents that are not running
     */
    async cleanupOrphanedSessions() {
        try {
            const orphanedAgents = await this.checkForOrphanedSessions();
            for (const agentId of orphanedAgents) {
                console.log(`[EmergencyControls] Cleaning up orphaned session for agent-${agentId}`);
                await this.sessionManager.deleteAgentSession(agentId);
                // Also release any claims
                const claims = await this.queueManager.getClaimedProjects(`agent-${agentId}`);
                for (const claim of claims) {
                    await this.queueManager.releaseProjectClaim(claim.projectNumber, claim.issueNumber);
                }
            }
            if (orphanedAgents.length > 0) {
                await this.logEmergencyAction('cleanup_orphaned_sessions', {
                    agentsCleanedUp: orphanedAgents.length,
                    agentIds: orphanedAgents
                }, 'success');
            }
            return orphanedAgents.length;
        }
        catch (error) {
            console.error('[EmergencyControls] Failed to cleanup orphaned sessions:', error);
            throw error;
        }
    }
}
exports.EmergencyControls = EmergencyControls;
/**
 * Singleton instance for global access
 */
let emergencyControlsInstance = null;
/**
 * Initialize the emergency controls
 * Should be called during extension activation
 *
 * @param lifecycleManager - Agent lifecycle manager instance
 * @param sessionManager - Agent session manager instance
 * @param queueManager - Project queue manager instance
 * @param workspaceRoot - Workspace root directory
 * @returns EmergencyControls instance
 */
function initializeEmergencyControls(lifecycleManager, sessionManager, queueManager, workspaceRoot) {
    emergencyControlsInstance = new EmergencyControls(lifecycleManager, sessionManager, queueManager, workspaceRoot);
    return emergencyControlsInstance;
}
/**
 * Get the singleton emergency controls instance
 * @throws Error if not initialized
 */
function getEmergencyControls() {
    if (!emergencyControlsInstance) {
        throw new Error('EmergencyControls not initialized. Call initializeEmergencyControls first.');
    }
    return emergencyControlsInstance;
}
/**
 * Cleanup and reset the emergency controls
 * Should be called during extension deactivation
 */
function cleanupEmergencyControls() {
    emergencyControlsInstance = null;
}
// Export standalone functions for convenience
async function emergencyStopAllAgents(skipConfirmation = false) {
    return getEmergencyControls().emergencyStopAllAgents(skipConfirmation);
}
async function restartAgent(agentId) {
    return getEmergencyControls().restartAgent(agentId);
}
async function resetAgentState(agentId) {
    return getEmergencyControls().resetAgentState(agentId);
}
async function recoverStuckProjects() {
    return getEmergencyControls().recoverStuckProjects();
}
async function purgeQueue(skipConfirmation = false) {
    return getEmergencyControls().purgeQueue(skipConfirmation);
}
async function getRecoveryOptions() {
    return getEmergencyControls().getRecoveryOptions();
}
async function logEmergencyAction(action, details, result = 'success') {
    return getEmergencyControls().logEmergencyAction(action, details, result);
}
async function checkForOrphanedSessions() {
    return getEmergencyControls().checkForOrphanedSessions();
}
async function cleanupOrphanedSessions() {
    return getEmergencyControls().cleanupOrphanedSessions();
}
//# sourceMappingURL=emergency-controls.js.map