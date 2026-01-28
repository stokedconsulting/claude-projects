// Agent Dashboard Webview Script

(function () {
    const vscode = acquireVsCodeApi();

    let currentData = null;

    // Initialize
    window.addEventListener('load', () => {
        console.log('[AgentDashboard] Webview loaded');
        requestRefresh();
    });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.type) {
            case 'updateDashboard':
                currentData = message.data;
                renderDashboard(message.data);
                hideLoading();
                break;

            case 'error':
                showError(message.message);
                hideLoading();
                break;

            case 'activityUpdate':
                if (currentData && currentData.recentActivity) {
                    // Add new event to beginning of activity list
                    currentData.recentActivity.unshift(message.event);
                    // Keep only last 50
                    if (currentData.recentActivity.length > 50) {
                        currentData.recentActivity = currentData.recentActivity.slice(0, 50);
                    }
                    // Re-render activity feed only
                    updateActivityFeed(currentData.recentActivity);
                }
                break;

            case 'costUpdate':
                if (currentData) {
                    currentData.costData = message.costData;
                    updateCostTracker(message.costData);
                }
                break;

            case 'progressUpdate':
                if (currentData && message.agentId) {
                    const agent = currentData.agents.find(a => a.agentId === message.agentId);
                    if (agent) {
                        agent.progress = message.progress;
                        updateAgentProgress(message.agentId, message.progress);
                    }
                }
                break;
        }
    });

    /**
     * Request refresh from extension
     */
    function requestRefresh() {
        vscode.postMessage({ type: 'refresh' });
    }

    /**
     * Show loading spinner
     */
    function showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    /**
     * Hide loading spinner
     */
    function hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Show error banner
     */
    function showError(message) {
        const errorDiv = document.getElementById('error');
        if (!errorDiv) {
            return;
        }

        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    /**
     * Format elapsed time
     */
    function formatElapsedTime(elapsedMs) {
        const seconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get status badge class
     */
    function getStatusBadgeClass(status, healthStatus) {
        if (healthStatus === 'unresponsive') {
            return 'status-badge-crashed';
        }

        switch (status) {
            case 'working':
                return 'status-badge-working';
            case 'idle':
                return 'status-badge-idle';
            case 'reviewing':
                return 'status-badge-reviewing';
            case 'ideating':
                return 'status-badge-ideating';
            case 'paused':
                return 'status-badge-paused';
            default:
                return 'status-badge-idle';
        }
    }

    /**
     * Get status display text
     */
    function getStatusText(status, healthStatus) {
        if (healthStatus === 'unresponsive') {
            return 'Crashed';
        }

        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    /**
     * Render dashboard
     */
    function renderDashboard(data) {
        const contentDiv = document.getElementById('content');
        if (!contentDiv) {
            return;
        }

        // Clear previous content
        contentDiv.innerHTML = '';

        // Render header with cost tracker and global metrics
        const header = document.createElement('div');
        header.className = 'dashboard-header';
        header.innerHTML = `
            <div class="cost-tracker" id="cost-tracker">
                ${renderCostTracker(data.costData)}
            </div>
            ${data.globalMetrics ? renderGlobalMetrics(data.globalMetrics) : ''}
            <div class="header-stats">
                <div class="stat-item">
                    <span class="stat-label">Total Agents:</span>
                    <span class="stat-value">${data.totalAgents}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Working:</span>
                    <span class="stat-value status-working">${data.counts.working || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Idle:</span>
                    <span class="stat-value status-idle">${data.counts.idle || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Paused:</span>
                    <span class="stat-value status-paused">${data.counts.paused || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Crashed:</span>
                    <span class="stat-value status-crashed">${data.counts.unresponsive || 0}</span>
                </div>
            </div>
        `;
        contentDiv.appendChild(header);

        // Render activity feed
        const activitySection = document.createElement('div');
        activitySection.className = 'activity-section';
        activitySection.innerHTML = `
            <div class="activity-header">
                <h3>Recent Activity</h3>
                <button class="btn-secondary btn-sm" onclick="clearActivity()" title="Clear activity log">Clear</button>
            </div>
            <div class="activity-feed" id="activity-feed">
                ${renderActivityFeed(data.recentActivity)}
            </div>
        `;
        contentDiv.appendChild(activitySection);

        // Render agents
        if (data.agents.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <p>No agents running</p>
                <button class="btn-primary" onclick="addAgent()">Add Agent</button>
            `;
            contentDiv.appendChild(emptyState);
        } else {
            const agentsContainer = document.createElement('div');
            agentsContainer.className = 'agents-container';

            data.agents.forEach(agent => {
                const agentCard = createAgentCard(agent);
                agentsContainer.appendChild(agentCard);
            });

            contentDiv.appendChild(agentsContainer);
        }

        // Render footer
        const footer = document.createElement('div');
        footer.className = 'dashboard-footer';

        const canAddAgent = data.totalAgents < data.maxConcurrent;
        const hasPausedAgents = (data.counts.paused || 0) > 0;
        const hasActiveAgents = (data.counts.working || 0) + (data.counts.idle || 0) > 0;

        footer.innerHTML = `
            <div class="footer-controls-group">
                <button
                    class="btn-primary"
                    onclick="addAgent()"
                    ${canAddAgent ? '' : 'disabled'}
                >
                    Add Agent (${data.totalAgents}/${data.maxConcurrent})
                </button>
            </div>
            <div class="footer-controls-group">
                <button
                    class="btn-secondary"
                    onclick="pauseAll()"
                    ${hasActiveAgents ? '' : 'disabled'}
                    title="Pause all running agents"
                >
                    Pause All
                </button>
                <button
                    class="btn-secondary"
                    onclick="resumeAll()"
                    ${hasPausedAgents ? '' : 'disabled'}
                    title="Resume all paused agents"
                >
                    Resume All
                </button>
                <button
                    class="btn-danger"
                    onclick="emergencyStopAll()"
                    ${data.totalAgents > 0 ? '' : 'disabled'}
                    title="Emergency stop all agents"
                >
                    Emergency Stop All
                </button>
            </div>
        `;
        contentDiv.appendChild(footer);
    }

    /**
     * Create agent card element
     */
    function createAgentCard(agent) {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.setAttribute('data-agent-id', agent.agentId);

        const statusBadgeClass = getStatusBadgeClass(agent.status, agent.healthStatus);
        const statusText = getStatusText(agent.status, agent.healthStatus);
        const elapsedTime = formatElapsedTime(agent.elapsedMs);

        // Build controls based on status
        let controls = '';
        if (agent.healthStatus === 'unresponsive') {
            controls = `
                <button class="btn-secondary btn-sm" onclick="stopAgent('${agent.agentId}')">Stop</button>
            `;
        } else if (agent.status === 'paused') {
            controls = `
                <button class="btn-primary btn-sm" onclick="resumeAgent('${agent.agentId}')">Resume</button>
                <button class="btn-secondary btn-sm" onclick="stopAgent('${agent.agentId}')">Stop</button>
            `;
        } else {
            controls = `
                <button class="btn-secondary btn-sm" onclick="pauseAgent('${agent.agentId}')">Pause</button>
                <button class="btn-secondary btn-sm" onclick="stopAgent('${agent.agentId}')">Stop</button>
            `;
        }

        // Add reassign button if agent has active work
        if (agent.currentProjectNumber && agent.status !== 'paused') {
            controls += `
                <button class="btn-warning btn-sm" onclick="reassignProject('${agent.agentId}')" title="Release project to queue">Reassign</button>
            `;
        }

        // Add metrics toggle button
        controls += `
            <button class="btn-secondary btn-sm" onclick="toggleMetrics('${agent.agentId}')" title="Show performance metrics">Metrics</button>
        `;

        // Build current task info with progress
        let taskInfo = '<span class="no-task">No active task</span>';
        if (agent.currentProjectNumber) {
            const phase = agent.currentPhase || 'N/A';
            const progressBar = agent.progress && agent.progress.total > 0 ? `
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${agent.progress.percentage}%"></div>
                    </div>
                    <div class="progress-text">${agent.progress.description} - ${agent.progress.percentage}%</div>
                </div>
            ` : '';

            taskInfo = `
                <div class="task-info">
                    <div><strong>Project:</strong> #${agent.currentProjectNumber}</div>
                    <div><strong>Phase:</strong> ${phase}</div>
                    ${agent.currentTaskDescription ? `<div><strong>Task:</strong> ${agent.currentTaskDescription}</div>` : ''}
                    ${progressBar}
                </div>
            `;
        }

        // Build error info if present
        let errorInfo = '';
        if (agent.lastError) {
            errorInfo = `
                <div class="error-info">
                    <strong>Last Error:</strong> ${agent.lastError}
                    <span class="error-count">(${agent.errorCount} error${agent.errorCount !== 1 ? 's' : ''})</span>
                </div>
            `;
        }

        // Build performance metrics section (initially hidden)
        const metricsSection = agent.metrics ? renderAgentMetrics(agent.metrics) : '';

        card.innerHTML = `
            <div class="agent-card-header">
                <div class="agent-id">${agent.agentId}</div>
                <span class="status-badge ${statusBadgeClass}">${statusText}</span>
            </div>
            <div class="agent-card-body">
                ${taskInfo}
                <div class="agent-stats">
                    <div><strong>Tasks Completed:</strong> ${agent.tasksCompleted}</div>
                    <div><strong>Uptime:</strong> ${elapsedTime}</div>
                </div>
                ${errorInfo}
                ${metricsSection}
            </div>
            <div class="agent-card-controls">
                ${controls}
            </div>
        `;

        return card;
    }

    /**
     * Render agent performance metrics
     */
    function renderAgentMetrics(metrics) {
        if (!metrics) {
            return '';
        }

        return `
            <div class="metrics-section" id="metrics-${metrics.agentId}" style="display: none;">
                <div class="metrics-header">
                    <h4>Performance Metrics</h4>
                </div>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <span class="metric-label">Total Tasks:</span>
                        <span class="metric-value">${metrics.tasksCompleted.total}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Last 24h:</span>
                        <span class="metric-value">${metrics.tasksCompleted.last24Hours}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Last 7d:</span>
                        <span class="metric-value">${metrics.tasksCompleted.last7Days}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Avg Cycle Time:</span>
                        <span class="metric-value">${Math.round(metrics.averageCycleTime)} min</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Review Pass Rate:</span>
                        <span class="metric-value">${metrics.reviewPassRate.toFixed(1)}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Error Rate:</span>
                        <span class="metric-value">${metrics.errorRate.toFixed(2)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Avg Cost/Project:</span>
                        <span class="metric-value">$${metrics.averageCostPerProject.toFixed(2)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Uptime:</span>
                        <span class="metric-value">${metrics.uptimePercent.toFixed(0)}%</span>
                    </div>
                </div>
                <div class="metrics-footer">
                    <span class="metrics-timestamp">Updated: ${new Date(metrics.lastUpdated).toLocaleString()}</span>
                </div>
            </div>
        `;
    }

    /**
     * Toggle metrics visibility for an agent
     */
    window.toggleMetrics = function(agentId) {
        const metricsSection = document.getElementById(`metrics-${agentId}`);
        if (metricsSection) {
            const isHidden = metricsSection.style.display === 'none';
            metricsSection.style.display = isHidden ? 'block' : 'none';
        }
    };

    /**
     * Render cost tracker
     */
    function renderCostTracker(costData) {
        if (!costData) {
            return '<div class="cost-item"><span class="cost-label">Cost tracking unavailable</span></div>';
        }

        return `
            <div class="cost-item">
                <span class="cost-label">Daily:</span>
                <span class="cost-value">$${costData.daily.spent.toFixed(2)} / $${costData.daily.limit.toFixed(2)}</span>
                <div class="cost-bar">
                    <div class="cost-fill" style="width: ${Math.min(100, costData.daily.percentage)}%"></div>
                </div>
                <span class="cost-percentage">${costData.daily.percentage.toFixed(1)}%</span>
            </div>
            <div class="cost-item">
                <span class="cost-label">Monthly:</span>
                <span class="cost-value">$${costData.monthly.spent.toFixed(2)} / $${costData.monthly.limit.toFixed(2)}</span>
                <div class="cost-bar">
                    <div class="cost-fill" style="width: ${Math.min(100, costData.monthly.percentage)}%"></div>
                </div>
                <span class="cost-percentage">${costData.monthly.percentage.toFixed(1)}%</span>
            </div>
        `;
    }

    /**
     * Render global metrics summary
     */
    function renderGlobalMetrics(globalMetrics) {
        if (!globalMetrics) {
            return '';
        }

        return `
            <div class="global-metrics" id="global-metrics">
                <h4>Global Performance</h4>
                <div class="global-metrics-grid">
                    <div class="metric-item">
                        <span class="metric-label">Projects Completed:</span>
                        <span class="metric-value">${globalMetrics.totalProjectsCompleted}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Avg Cycle Time:</span>
                        <span class="metric-value">${Math.round(globalMetrics.averageCycleTime)} min</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Avg Pass Rate:</span>
                        <span class="metric-value">${globalMetrics.averageReviewPassRate.toFixed(1)}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Total Cost:</span>
                        <span class="metric-value">$${globalMetrics.totalCostUSD.toFixed(2)}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Active:</span>
                        <span class="metric-value">${globalMetrics.activeAgents}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Idle:</span>
                        <span class="metric-value">${globalMetrics.idleAgents}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render activity feed
     */
    function renderActivityFeed(activities) {
        if (!activities || activities.length === 0) {
            return '<div class="activity-empty">No recent activity</div>';
        }

        return activities.map(event => {
            const timestamp = new Date(event.timestamp);
            const timeStr = timestamp.toLocaleTimeString();
            const eventIcon = getActivityIcon(event.eventType);
            const eventClass = `activity-event-${event.eventType}`;

            let eventText = `${event.agentId} ${getActivityText(event)}`;
            if (event.projectNumber) {
                eventText += ` #${event.projectNumber}`;
            }
            if (event.details) {
                eventText += ` - ${event.details}`;
            }

            return `
                <div class="activity-item ${eventClass}">
                    <span class="activity-icon">${eventIcon}</span>
                    <span class="activity-time">${timeStr}</span>
                    <span class="activity-text">${eventText}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Get activity icon
     */
    function getActivityIcon(eventType) {
        const icons = {
            claimed: '📋',
            completed: '✅',
            reviewed: '🔍',
            ideated: '💡',
            created: '🆕',
            paused: '⏸️',
            resumed: '▶️',
            error: '❌'
        };
        return icons[eventType] || '•';
    }

    /**
     * Get activity text
     */
    function getActivityText(event) {
        const texts = {
            claimed: 'claimed project',
            completed: 'completed project',
            reviewed: 'reviewed project',
            ideated: 'ideated on project',
            created: 'created project',
            paused: 'paused',
            resumed: 'resumed',
            error: 'encountered error'
        };
        return texts[event.eventType] || event.eventType;
    }

    /**
     * Update activity feed only (for real-time updates)
     */
    function updateActivityFeed(activities) {
        const feedDiv = document.getElementById('activity-feed');
        if (feedDiv) {
            feedDiv.innerHTML = renderActivityFeed(activities);
        }
    }

    /**
     * Update cost tracker only (for real-time updates)
     */
    function updateCostTracker(costData) {
        const costDiv = document.getElementById('cost-tracker');
        if (costDiv) {
            costDiv.innerHTML = renderCostTracker(costData);
        }
    }

    /**
     * Update agent progress only (for real-time updates)
     */
    function updateAgentProgress(agentId, progress) {
        const agentCard = document.querySelector(`[data-agent-id="${agentId}"]`);
        if (!agentCard) {
            return;
        }

        const progressContainer = agentCard.querySelector('.progress-container');
        if (progressContainer && progress.total > 0) {
            progressContainer.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
                <div class="progress-text">${progress.description} - ${progress.percentage}%</div>
            `;
        }
    }

    /**
     * Global functions called from HTML
     */
    window.pauseAgent = function (agentId) {
        vscode.postMessage({ type: 'pauseAgent', agentId });
    };

    window.pauseAll = function () {
        vscode.postMessage({ type: 'pauseAll' });
    };

    window.resumeAgent = function (agentId) {
        vscode.postMessage({ type: 'resumeAgent', agentId });
    };

    window.resumeAll = function () {
        vscode.postMessage({ type: 'resumeAll' });
    };

    window.stopAgent = function (agentId) {
        vscode.postMessage({ type: 'stopAgent', agentId });
    };

    window.reassignProject = function (agentId, newAgentId) {
        vscode.postMessage({ type: 'reassignProject', agentId, newAgentId });
    };

    window.addAgent = function () {
        vscode.postMessage({ type: 'addAgent' });
    };

    window.emergencyStopAll = function () {
        vscode.postMessage({ type: 'emergencyStopAll' });
    };

    window.clearActivity = function () {
        vscode.postMessage({ type: 'clearActivity' });
    };
})();
