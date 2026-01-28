"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskHistoryManager = void 0;
class TaskHistoryManager {
    context;
    history = [];
    maxHistorySize = 100;
    storageKey = 'claudeProjects.taskHistory';
    outputChannel;
    constructor(context, outputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
        this.loadHistory();
    }
    /**
     * Load history from workspace state
     */
    loadHistory() {
        try {
            const saved = this.context.workspaceState.get(this.storageKey, []);
            // Convert timestamp strings back to Date objects
            this.history = saved.map(entry => ({
                ...entry,
                timestamp: new Date(entry.timestamp),
                subagentResponses: entry.subagentResponses?.map(sub => ({
                    ...sub,
                    timestamp: new Date(sub.timestamp)
                }))
            }));
            this.outputChannel.appendLine(`[Task History] Loaded ${this.history.length} entries`);
        }
        catch (error) {
            this.outputChannel.appendLine(`[Task History] Failed to load history: ${error}`);
            this.history = [];
        }
    }
    /**
     * Save history to workspace state
     */
    async saveHistory() {
        try {
            await this.context.workspaceState.update(this.storageKey, this.history);
        }
        catch (error) {
            this.outputChannel.appendLine(`[Task History] Failed to save history: ${error}`);
        }
    }
    /**
     * Add a new task to history
     */
    async addTask(command, prompt, options) {
        const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const entry = {
            id,
            timestamp: new Date(),
            command,
            prompt,
            projectNumber: options?.projectNumber,
            phaseNumber: options?.phaseNumber,
            itemNumber: options?.itemNumber,
            status: 'pending',
            subagentResponses: []
        };
        this.history.unshift(entry); // Add to beginning (most recent first)
        // Trim history if too large
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
        await this.saveHistory();
        this.outputChannel.appendLine(`[Task History] Added task: ${id} - ${command}`);
        return id;
    }
    /**
     * Update task with response
     */
    async updateTaskResponse(taskId, response, status, error) {
        const entry = this.history.find(e => e.id === taskId);
        if (!entry) {
            this.outputChannel.appendLine(`[Task History] Task not found: ${taskId}`);
            return;
        }
        entry.response = response;
        entry.status = status;
        if (error) {
            entry.error = error;
        }
        await this.saveHistory();
        this.outputChannel.appendLine(`[Task History] Updated task: ${taskId} - ${status}`);
    }
    /**
     * Add subagent response to a task
     */
    async addSubagentResponse(taskId, agentId, response) {
        const entry = this.history.find(e => e.id === taskId);
        if (!entry) {
            this.outputChannel.appendLine(`[Task History] Task not found: ${taskId}`);
            return;
        }
        if (!entry.subagentResponses) {
            entry.subagentResponses = [];
        }
        entry.subagentResponses.push({
            agentId,
            response,
            timestamp: new Date()
        });
        await this.saveHistory();
        this.outputChannel.appendLine(`[Task History] Added subagent response to task: ${taskId}`);
    }
    /**
     * Get all history entries
     */
    getHistory() {
        return [...this.history]; // Return copy
    }
    /**
     * Get history for a specific project
     */
    getProjectHistory(projectNumber) {
        return this.history.filter(e => e.projectNumber === projectNumber);
    }
    /**
     * Clear all history
     */
    async clearHistory() {
        this.history = [];
        await this.saveHistory();
        this.outputChannel.appendLine('[Task History] Cleared all history');
    }
    /**
     * Export history as JSON
     */
    exportHistory() {
        return JSON.stringify(this.history, null, 2);
    }
    /**
     * Get statistics
     */
    getStatistics() {
        return {
            total: this.history.length,
            completed: this.history.filter(e => e.status === 'completed').length,
            pending: this.history.filter(e => e.status === 'pending').length,
            failed: this.history.filter(e => e.status === 'failed').length
        };
    }
}
exports.TaskHistoryManager = TaskHistoryManager;
//# sourceMappingURL=task-history-manager.js.map