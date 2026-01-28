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
exports.ConflictResolverProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Conflict Resolver Provider
 *
 * Provides a webview panel for managing and resolving merge conflicts
 * flagged by autonomous agents during project execution.
 *
 * AC-5.3.b: When user opens conflict resolver → all pending conflicts are displayed with file counts
 * AC-5.3.c: When "Open in Merge Editor" is clicked → VS Code command is invoked
 * AC-5.3.d: When user clicks "Mark Resolved" → conflict is removed from queue
 * AC-5.3.e: When "Abort" is clicked → issue claim is released and issue returns to backlog
 */
class ConflictResolverProvider {
    _extensionUri;
    _context;
    static viewType = 'conflictResolver.view';
    _view;
    _updateInterval;
    _conflictQueueManager;
    _projectQueueManager;
    constructor(_extensionUri, _context, conflictQueueManager, projectQueueManager) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._conflictQueueManager = conflictQueueManager;
        this._projectQueueManager = projectQueueManager;
    }
    resolveWebviewView(webviewView, context, _token) {
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
                    await this.updateConflictList();
                    break;
                case 'openMergeEditor':
                    await this.handleOpenMergeEditor(data.conflictId);
                    break;
                case 'markResolved':
                    await this.handleMarkResolved(data.conflictId);
                    break;
                case 'abortConflict':
                    await this.handleAbortConflict(data.conflictId);
                    break;
                case 'viewDetails':
                    await this.handleViewDetails(data.conflictId);
                    break;
            }
        });
        // Start auto-refresh (every 5 seconds)
        this._updateInterval = setInterval(() => {
            this.updateConflictList();
        }, 5000);
        // Initial load
        this.updateConflictList();
        // Clean up on dispose
        webviewView.onDidDispose(() => {
            if (this._updateInterval) {
                clearInterval(this._updateInterval);
            }
        });
    }
    /**
     * Update the conflict list in the webview
     * AC-5.3.b: Display all pending conflicts with file counts
     */
    async updateConflictList() {
        if (!this._view) {
            return;
        }
        try {
            const conflicts = await this._conflictQueueManager.getConflicts();
            this._view.webview.postMessage({
                type: 'updateConflicts',
                conflicts: conflicts
            });
        }
        catch (error) {
            console.error('[ConflictResolverProvider] Failed to update conflict list:', error);
            this._view.webview.postMessage({
                type: 'error',
                message: `Failed to load conflicts: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
    /**
     * Handle opening the VS Code merge editor for a conflict
     * AC-5.3.c: When "Open in Merge Editor" is clicked → VS Code command is invoked
     */
    async handleOpenMergeEditor(conflictId) {
        try {
            const conflict = await this._conflictQueueManager.getConflictById(conflictId);
            if (!conflict) {
                vscode.window.showErrorMessage(`Conflict ${conflictId} not found`);
                return;
            }
            // Update status to resolving
            await this._conflictQueueManager.updateConflictStatus(conflictId, 'resolving');
            // Open source control view to show conflicting files
            await vscode.commands.executeCommand('workbench.view.scm');
            // Show information message with instructions
            vscode.window.showInformationMessage(`Resolve conflicts in ${conflict.conflictingFiles.length} file(s) for issue #${conflict.issueNumber}. ` +
                `Use the Source Control view to resolve each conflict, then mark as resolved.`, 'View Files').then(selection => {
                if (selection === 'View Files') {
                    // Open first conflicting file for quick access
                    if (conflict.conflictingFiles.length > 0) {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceRoot) {
                            const filePath = path.join(workspaceRoot, conflict.conflictingFiles[0]);
                            vscode.workspace.openTextDocument(filePath).then(doc => {
                                vscode.window.showTextDocument(doc);
                            });
                        }
                    }
                }
            });
            // Refresh the conflict list
            await this.updateConflictList();
        }
        catch (error) {
            console.error('[ConflictResolverProvider] Failed to open merge editor:', error);
            vscode.window.showErrorMessage(`Failed to open merge editor: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle marking a conflict as resolved
     * AC-5.3.d: When user clicks "Mark Resolved" → conflict is removed from queue
     */
    async handleMarkResolved(conflictId) {
        try {
            const conflict = await this._conflictQueueManager.getConflictById(conflictId);
            if (!conflict) {
                vscode.window.showErrorMessage(`Conflict ${conflictId} not found`);
                return;
            }
            // Confirm resolution
            const confirmation = await vscode.window.showWarningMessage(`Mark conflict for issue #${conflict.issueNumber} as resolved? ` +
                `This will remove it from the queue and allow the agent to proceed.`, 'Yes, Mark Resolved', 'Cancel');
            if (confirmation !== 'Yes, Mark Resolved') {
                return;
            }
            // Remove conflict from queue
            await this._conflictQueueManager.removeConflict(conflictId);
            vscode.window.showInformationMessage(`Conflict for issue #${conflict.issueNumber} marked as resolved`);
            // Refresh the conflict list
            await this.updateConflictList();
        }
        catch (error) {
            console.error('[ConflictResolverProvider] Failed to mark conflict as resolved:', error);
            vscode.window.showErrorMessage(`Failed to mark conflict as resolved: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle aborting a conflict and returning the issue to the backlog
     * AC-5.3.e: When "Abort" is clicked → issue claim is released and issue returns to backlog
     */
    async handleAbortConflict(conflictId) {
        try {
            const conflict = await this._conflictQueueManager.getConflictById(conflictId);
            if (!conflict) {
                vscode.window.showErrorMessage(`Conflict ${conflictId} not found`);
                return;
            }
            // Confirm abort
            const confirmation = await vscode.window.showWarningMessage(`Abort conflict resolution for issue #${conflict.issueNumber}? ` +
                `This will release the agent's claim and return the issue to the backlog.`, 'Yes, Abort', 'Cancel');
            if (confirmation !== 'Yes, Abort') {
                return;
            }
            // Release the issue claim if project queue manager is available
            if (this._projectQueueManager) {
                try {
                    await this._projectQueueManager.releaseProjectClaim(conflict.projectNumber, conflict.issueNumber);
                    console.log(`[ConflictResolverProvider] Released claim for issue #${conflict.issueNumber}`);
                }
                catch (error) {
                    console.warn('[ConflictResolverProvider] Failed to release claim:', error);
                    // Continue with removal even if claim release fails
                }
            }
            // Remove conflict from queue
            await this._conflictQueueManager.removeConflict(conflictId);
            vscode.window.showInformationMessage(`Conflict for issue #${conflict.issueNumber} aborted. Issue returned to backlog.`);
            // Refresh the conflict list
            await this.updateConflictList();
        }
        catch (error) {
            console.error('[ConflictResolverProvider] Failed to abort conflict:', error);
            vscode.window.showErrorMessage(`Failed to abort conflict: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle viewing detailed information about a conflict
     */
    async handleViewDetails(conflictId) {
        try {
            const conflict = await this._conflictQueueManager.getConflictById(conflictId);
            if (!conflict) {
                vscode.window.showErrorMessage(`Conflict ${conflictId} not found`);
                return;
            }
            // Format conflict details for display
            const details = [
                `Conflict ID: ${conflict.conflictId}`,
                `Issue: #${conflict.issueNumber}`,
                `Branch: ${conflict.branchName}`,
                `Agent: ${conflict.agentId}`,
                `Status: ${conflict.status}`,
                `Created: ${new Date(conflict.createdAt).toLocaleString()}`,
                '',
                `Conflicting Files (${conflict.conflictingFiles.length}):`,
                ...conflict.conflictingFiles.map(f => `  - ${f}`)
            ].join('\n');
            // Show in an information message with options
            vscode.window.showInformationMessage(details, { modal: true }, 'Open Merge Editor', 'Mark Resolved', 'Abort').then(async (selection) => {
                if (selection === 'Open Merge Editor') {
                    await this.handleOpenMergeEditor(conflictId);
                }
                else if (selection === 'Mark Resolved') {
                    await this.handleMarkResolved(conflictId);
                }
                else if (selection === 'Abort') {
                    await this.handleAbortConflict(conflictId);
                }
            });
        }
        catch (error) {
            console.error('[ConflictResolverProvider] Failed to view conflict details:', error);
            vscode.window.showErrorMessage(`Failed to view conflict details: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Generate HTML for the webview
     */
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conflict Resolver</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }

        .refresh-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 10px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }

        .refresh-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }

        .conflict-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .conflict-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
        }

        .conflict-item.resolving {
            border-color: var(--vscode-inputValidation-warningBorder);
        }

        .conflict-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .conflict-title {
            font-weight: 600;
            font-size: 14px;
        }

        .conflict-status {
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-pending {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }

        .status-resolving {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
        }

        .conflict-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }

        .conflict-info div {
            margin-bottom: 4px;
        }

        .conflict-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .action-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 10px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }

        .action-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .action-button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .action-button.primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .action-button.danger {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }

        .action-button.danger:hover {
            opacity: 0.8;
        }

        .error-message {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Conflict Resolver</h2>
        <button class="refresh-button" onclick="refresh()">Refresh</button>
    </div>

    <div id="error-container"></div>
    <div id="conflict-container">
        <div class="empty-state">Loading conflicts...</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'updateConflicts':
                    renderConflicts(message.conflicts);
                    break;

                case 'error':
                    showError(message.message);
                    break;
            }
        });

        function renderConflicts(conflicts) {
            const container = document.getElementById('conflict-container');
            const errorContainer = document.getElementById('error-container');
            errorContainer.innerHTML = '';

            if (!conflicts || conflicts.length === 0) {
                container.innerHTML = '<div class="empty-state">No conflicts to resolve</div>';
                return;
            }

            const html = conflicts.map(conflict => {
                const statusClass = 'status-' + conflict.status;
                const itemClass = conflict.status === 'resolving' ? 'conflict-item resolving' : 'conflict-item';

                return \`
                    <div class="\${itemClass}">
                        <div class="conflict-header">
                            <div class="conflict-title">Issue #\${conflict.issueNumber}</div>
                            <span class="conflict-status \${statusClass}">\${conflict.status}</span>
                        </div>
                        <div class="conflict-info">
                            <div>Branch: \${conflict.branchName}</div>
                            <div>Agent: \${conflict.agentId}</div>
                            <div>Conflicting Files: \${conflict.conflictingFiles.length}</div>
                            <div>Created: \${new Date(conflict.createdAt).toLocaleString()}</div>
                        </div>
                        <div class="conflict-actions">
                            <button class="action-button primary" onclick="openMergeEditor('\${conflict.conflictId}')">
                                Open in Merge Editor
                            </button>
                            <button class="action-button" onclick="viewDetails('\${conflict.conflictId}')">
                                View Details
                            </button>
                            <button class="action-button" onclick="markResolved('\${conflict.conflictId}')">
                                Mark Resolved
                            </button>
                            <button class="action-button danger" onclick="abortConflict('\${conflict.conflictId}')">
                                Abort & Return to Queue
                            </button>
                        </div>
                    </div>
                \`;
            }).join('');

            container.innerHTML = '<div class="conflict-list">' + html + '</div>';
        }

        function showError(message) {
            const errorContainer = document.getElementById('error-container');
            errorContainer.innerHTML = \`
                <div class="error-message">
                    \${message}
                </div>
            \`;
        }

        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }

        function openMergeEditor(conflictId) {
            vscode.postMessage({ type: 'openMergeEditor', conflictId });
        }

        function markResolved(conflictId) {
            vscode.postMessage({ type: 'markResolved', conflictId });
        }

        function abortConflict(conflictId) {
            vscode.postMessage({ type: 'abortConflict', conflictId });
        }

        function viewDetails(conflictId) {
            vscode.postMessage({ type: 'viewDetails', conflictId });
        }

        // Initial load
        refresh();
    </script>
</body>
</html>`;
    }
}
exports.ConflictResolverProvider = ConflictResolverProvider;
//# sourceMappingURL=conflict-resolver-provider.js.map