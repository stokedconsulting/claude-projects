import * as vscode from 'vscode';
import * as path from 'path';
import { AgentSessionManager, AgentSession, AgentStatus } from './agent-session-manager';
import { AgentHeartbeatManager, AgentHealthStatus } from './agent-heartbeat';
import { AgentLifecycleManager } from './agent-lifecycle';
import { getAgentConfig } from './agent-config';

/**
 * Agent Dashboard Provider
 *
 * Provides a webview panel displaying real-time agent status and controls.
 * Updates automatically every 2 seconds via polling.
 */
export class AgentDashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeProjects.agentDashboard';

    private _view?: vscode.WebviewView;
    private _updateInterval?: NodeJS.Timeout;
    private _sessionManager: AgentSessionManager;
    private _heartbeatManager: AgentHeartbeatManager;
    private _lifecycleManager: AgentLifecycleManager;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        sessionManager: AgentSessionManager,
        heartbeatManager: AgentHeartbeatManager,
        lifecycleManager: AgentLifecycleManager
    ) {
        this._sessionManager = sessionManager;
        this._heartbeatManager = heartbeatManager;
        this._lifecycleManager = lifecycleManager;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'refresh':
                    await this.updateDashboard();
                    break;

                case 'pauseAgent':
                    await this.handlePauseAgent(data.agentId);
                    break;

                case 'resumeAgent':
                    await this.handleResumeAgent(data.agentId);
                    break;

                case 'stopAgent':
                    await this.handleStopAgent(data.agentId);
                    break;

                case 'addAgent':
                    await this.handleAddAgent();
                    break;

                case 'emergencyStopAll':
                    await this.handleEmergencyStopAll();
                    break;
            }
        });

        // Start auto-refresh when view becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });

        // Initial update
        this.updateDashboard();

        // Start auto-refresh if view is visible
        if (webviewView.visible) {
            this.startAutoRefresh();
        }
    }

    /**
     * Start auto-refresh interval (every 2 seconds)
     */
    private startAutoRefresh(): void {
        if (this._updateInterval) {
            return; // Already running
        }

        console.log('[AgentDashboard] Starting auto-refresh (2s interval)');
        this._updateInterval = setInterval(() => {
            void this.updateDashboard();
        }, 2000);
    }

    /**
     * Stop auto-refresh interval
     */
    private stopAutoRefresh(): void {
        if (this._updateInterval) {
            console.log('[AgentDashboard] Stopping auto-refresh');
            clearInterval(this._updateInterval);
            this._updateInterval = undefined;
        }
    }

    /**
     * Update dashboard with current agent data
     */
    private async updateDashboard(): Promise<void> {
        if (!this._view) {
            return;
        }

        try {
            // Get all agent sessions
            const sessions = await this._sessionManager.listAgentSessions();

            // Get health status for each agent
            const healthStatuses = await this._heartbeatManager.getAllAgentHealthStatuses();

            // Get config for max concurrent agents
            const config = getAgentConfig();

            // Build dashboard data
            const dashboardData = {
                totalAgents: sessions.length,
                maxConcurrent: config.maxConcurrent,
                agents: sessions.map(session => {
                    // Extract numeric agent ID from "agent-N" format
                    const agentIdMatch = session.agentId.match(/^agent-(\d+)$/);
                    const numericAgentId = agentIdMatch ? parseInt(agentIdMatch[1], 10) : 0;

                    const healthStatus = healthStatuses.get(numericAgentId);

                    // Calculate elapsed time
                    const lastHeartbeat = new Date(session.lastHeartbeat);
                    const elapsedMs = Date.now() - lastHeartbeat.getTime();

                    return {
                        agentId: session.agentId,
                        numericAgentId,
                        status: session.status,
                        healthStatus: healthStatus?.status || 'unresponsive',
                        currentProjectNumber: session.currentProjectNumber,
                        currentPhase: session.currentPhase,
                        currentTaskDescription: session.currentTaskDescription,
                        tasksCompleted: session.tasksCompleted,
                        elapsedMs,
                        lastError: session.lastError,
                        errorCount: session.errorCount,
                        isRunning: this._lifecycleManager.isAgentRunning(numericAgentId)
                    };
                }),
                counts: this.calculateStatusCounts(sessions, healthStatuses)
            };

            // Send update to webview
            this._view.webview.postMessage({
                type: 'updateDashboard',
                data: dashboardData
            });

        } catch (error) {
            console.error('[AgentDashboard] Failed to update dashboard:', error);
            this._view?.webview.postMessage({
                type: 'error',
                message: `Failed to update dashboard: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    /**
     * Calculate counts by status
     */
    private calculateStatusCounts(
        sessions: AgentSession[],
        healthStatuses: Map<number, { status: AgentHealthStatus }>
    ): Record<string, number> {
        const counts: Record<string, number> = {
            working: 0,
            idle: 0,
            reviewing: 0,
            ideating: 0,
            paused: 0,
            unresponsive: 0
        };

        for (const session of sessions) {
            // Extract numeric agent ID
            const agentIdMatch = session.agentId.match(/^agent-(\d+)$/);
            const numericAgentId = agentIdMatch ? parseInt(agentIdMatch[1], 10) : 0;

            const healthStatus = healthStatuses.get(numericAgentId);

            if (healthStatus?.status === 'unresponsive') {
                counts.unresponsive++;
            } else {
                counts[session.status]++;
            }
        }

        return counts;
    }

    /**
     * Handle pause agent request
     */
    private async handlePauseAgent(agentId: string): Promise<void> {
        try {
            // Extract numeric ID
            const match = agentId.match(/^agent-(\d+)$/);
            if (!match) {
                throw new Error('Invalid agent ID format');
            }

            const numericAgentId = parseInt(match[1], 10);
            await this._lifecycleManager.pauseAgent(numericAgentId);

            vscode.window.showInformationMessage(`Agent ${agentId} paused`);
            await this.updateDashboard();

        } catch (error) {
            console.error('[AgentDashboard] Failed to pause agent:', error);
            vscode.window.showErrorMessage(
                `Failed to pause agent: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Handle resume agent request
     */
    private async handleResumeAgent(agentId: string): Promise<void> {
        try {
            // Extract numeric ID
            const match = agentId.match(/^agent-(\d+)$/);
            if (!match) {
                throw new Error('Invalid agent ID format');
            }

            const numericAgentId = parseInt(match[1], 10);
            await this._lifecycleManager.resumeAgent(numericAgentId);

            vscode.window.showInformationMessage(`Agent ${agentId} resumed`);
            await this.updateDashboard();

        } catch (error) {
            console.error('[AgentDashboard] Failed to resume agent:', error);
            vscode.window.showErrorMessage(
                `Failed to resume agent: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Handle stop agent request
     */
    private async handleStopAgent(agentId: string): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                `Stop ${agentId}?`,
                { modal: true },
                'Stop'
            );

            if (confirmation !== 'Stop') {
                return;
            }

            // Extract numeric ID
            const match = agentId.match(/^agent-(\d+)$/);
            if (!match) {
                throw new Error('Invalid agent ID format');
            }

            const numericAgentId = parseInt(match[1], 10);
            await this._lifecycleManager.stopAgent(numericAgentId);

            vscode.window.showInformationMessage(`Agent ${agentId} stopped`);
            await this.updateDashboard();

        } catch (error) {
            console.error('[AgentDashboard] Failed to stop agent:', error);
            vscode.window.showErrorMessage(
                `Failed to stop agent: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Handle add agent request
     */
    private async handleAddAgent(): Promise<void> {
        try {
            const config = getAgentConfig();
            const sessions = await this._sessionManager.listAgentSessions();

            if (sessions.length >= config.maxConcurrent) {
                vscode.window.showWarningMessage(
                    `Cannot add agent: Maximum concurrent agents (${config.maxConcurrent}) reached`
                );
                return;
            }

            // Find next available agent ID
            const existingIds = sessions.map(s => {
                const match = s.agentId.match(/^agent-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            });

            const nextId = Math.max(0, ...existingIds) + 1;

            // Start the new agent
            await this._lifecycleManager.startAgent(nextId);
            this._heartbeatManager.startHeartbeat(nextId);

            vscode.window.showInformationMessage(`Agent agent-${nextId} created`);
            await this.updateDashboard();

        } catch (error) {
            console.error('[AgentDashboard] Failed to add agent:', error);
            vscode.window.showErrorMessage(
                `Failed to add agent: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Handle emergency stop all request
     */
    private async handleEmergencyStopAll(): Promise<void> {
        try {
            const sessions = await this._sessionManager.listAgentSessions();

            if (sessions.length === 0) {
                vscode.window.showInformationMessage('No agents running');
                return;
            }

            const confirmation = await vscode.window.showWarningMessage(
                `Emergency stop all ${sessions.length} agent(s)?`,
                { modal: true },
                'Stop All'
            );

            if (confirmation !== 'Stop All') {
                return;
            }

            // Show progress
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Stopping all agents...',
                    cancellable: false
                },
                async (progress) => {
                    await this._lifecycleManager.stopAllAgents(5000);
                    this._heartbeatManager.stopAllHeartbeats();
                }
            );

            vscode.window.showInformationMessage('All agents stopped');
            await this.updateDashboard();

        } catch (error) {
            console.error('[AgentDashboard] Failed to stop all agents:', error);
            vscode.window.showErrorMessage(
                `Failed to stop all agents: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        this.stopAutoRefresh();
    }

    /**
     * Get HTML for webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'agent-dashboard.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'agent-dashboard.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Agent Dashboard</title>
        </head>
        <body>
            <div id="app">
                <div id="loading" class="loading-container">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading agents...</div>
                </div>
                <div id="error" class="error-banner"></div>
                <div id="content"></div>
            </div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

/**
 * Generate a nonce for CSP
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
