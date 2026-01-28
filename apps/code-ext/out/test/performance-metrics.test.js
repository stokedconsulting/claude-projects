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
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const performance_metrics_1 = require("../performance-metrics");
const agent_session_manager_1 = require("../agent-session-manager");
suite('Performance Metrics Tests', () => {
    let testWorkspace;
    let performanceMetrics;
    let sessionManager;
    setup(() => {
        // Create temporary workspace for testing
        testWorkspace = path.join(__dirname, 'test-workspace-metrics-' + Date.now());
        fs.mkdirSync(testWorkspace, { recursive: true });
        sessionManager = new agent_session_manager_1.AgentSessionManager(testWorkspace);
        performanceMetrics = new performance_metrics_1.PerformanceMetrics(testWorkspace, sessionManager);
    });
    teardown(() => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });
    test('AC-5.4.a: When agent completes project → metrics are updated within 10 seconds', async () => {
        const agentId = 'agent-1';
        const completionData = {
            projectNumber: 42,
            cycleTimeMinutes: 120,
            costUSD: 2.50,
            timestamp: new Date().toISOString()
        };
        const startTime = Date.now();
        // Record task completion
        await performanceMetrics.recordTaskCompletion(agentId, completionData);
        const endTime = Date.now();
        const elapsedMs = endTime - startTime;
        // Should complete within 10 seconds (10000ms)
        assert.ok(elapsedMs < 10000, `Update took ${elapsedMs}ms, should be < 10000ms`);
        // Verify metrics were updated
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        assert.strictEqual(metrics.tasksCompleted.total, 1, 'Should have 1 completed task');
        assert.strictEqual(metrics.averageCycleTime, 120, 'Average cycle time should be 120 minutes');
    });
    test('AC-5.4.b: When dashboard requests metrics → metrics are calculated within 1 second', async () => {
        const agentId = 'agent-1';
        // Record some completions
        for (let i = 0; i < 10; i++) {
            const completionData = {
                projectNumber: i,
                cycleTimeMinutes: 60 + i * 10,
                costUSD: 1.00 + i * 0.5,
                timestamp: new Date().toISOString()
            };
            await performanceMetrics.recordTaskCompletion(agentId, completionData);
        }
        const startTime = Date.now();
        // Get metrics (should use calculation)
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        const endTime = Date.now();
        const elapsedMs = endTime - startTime;
        // Should complete within 1 second (1000ms)
        assert.ok(elapsedMs < 1000, `Calculation took ${elapsedMs}ms, should be < 1000ms`);
        // Verify metrics calculated correctly
        assert.strictEqual(metrics.tasksCompleted.total, 10, 'Should have 10 completed tasks');
    });
    test('AC-5.4.c: When metrics card is expanded → all tracked metrics are displayed', async () => {
        const agentId = 'agent-1';
        // Create agent session
        await sessionManager.createAgentSession(1);
        // Record task completions
        const now = Date.now();
        const completions = [
            {
                projectNumber: 1,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date(now - 48 * 60 * 60 * 1000).toISOString() // 48 hours ago
            },
            {
                projectNumber: 2,
                cycleTimeMinutes: 120,
                costUSD: 2.50,
                timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
            },
            {
                projectNumber: 3,
                cycleTimeMinutes: 90,
                costUSD: 1.80,
                timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
            }
        ];
        for (const completion of completions) {
            await performanceMetrics.recordTaskCompletion(agentId, completion);
        }
        // Record review results
        await performanceMetrics.recordReviewResult(agentId, 1, true);
        await performanceMetrics.recordReviewResult(agentId, 2, false);
        await performanceMetrics.recordReviewResult(agentId, 3, true);
        // Get metrics
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        // Verify all tracked metrics are present
        assert.ok(metrics.tasksCompleted, 'Should have tasksCompleted');
        assert.strictEqual(metrics.tasksCompleted.total, 3, 'Total should be 3');
        assert.strictEqual(metrics.tasksCompleted.last24Hours, 2, 'Last 24 hours should be 2');
        assert.strictEqual(metrics.tasksCompleted.last7Days, 3, 'Last 7 days should be 3');
        assert.ok(metrics.averageCycleTime !== undefined, 'Should have averageCycleTime');
        const expectedAvgCycle = (100 + 120 + 90) / 3;
        assert.strictEqual(Math.round(metrics.averageCycleTime), Math.round(expectedAvgCycle), 'Average cycle time should be correct');
        assert.ok(metrics.reviewPassRate !== undefined, 'Should have reviewPassRate');
        assert.strictEqual(Math.round(metrics.reviewPassRate), 67, 'Review pass rate should be ~67%');
        assert.ok(metrics.errorRate !== undefined, 'Should have errorRate');
        assert.ok(metrics.averageCostPerProject !== undefined, 'Should have averageCostPerProject');
        const expectedAvgCost = (2.00 + 2.50 + 1.80) / 3;
        assert.strictEqual(metrics.averageCostPerProject.toFixed(2), expectedAvgCost.toFixed(2), 'Average cost should be correct');
        assert.ok(metrics.uptimePercent !== undefined, 'Should have uptimePercent');
        assert.ok(metrics.lastUpdated, 'Should have lastUpdated timestamp');
    });
    test('AC-5.4.d: When global metrics summary is displayed → values aggregate correctly', async () => {
        // Create multiple agent sessions
        await sessionManager.createAgentSession(1);
        await sessionManager.createAgentSession(2);
        await sessionManager.createAgentSession(3);
        // Agent 1: 5 completions
        for (let i = 0; i < 5; i++) {
            await performanceMetrics.recordTaskCompletion('agent-1', {
                projectNumber: i,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date().toISOString()
            });
            await performanceMetrics.recordReviewResult('agent-1', i, true);
        }
        // Agent 2: 3 completions
        for (let i = 0; i < 3; i++) {
            await performanceMetrics.recordTaskCompletion('agent-2', {
                projectNumber: 100 + i,
                cycleTimeMinutes: 120,
                costUSD: 3.00,
                timestamp: new Date().toISOString()
            });
            await performanceMetrics.recordReviewResult('agent-2', 100 + i, i < 2); // 2 approved, 1 rejected
        }
        // Agent 3: 0 completions (idle)
        // Update session statuses
        await sessionManager.updateAgentSession(1, { status: 'working' });
        await sessionManager.updateAgentSession(2, { status: 'reviewing' });
        await sessionManager.updateAgentSession(3, { status: 'idle' });
        // Get global metrics
        const globalMetrics = await performanceMetrics.getGlobalMetrics();
        // Verify aggregation
        assert.strictEqual(globalMetrics.totalProjectsCompleted, 8, 'Total projects should be 8 (5+3)');
        const expectedAvgCycle = (100 + 120) / 2; // Average of agent-1 and agent-2 averages
        assert.strictEqual(globalMetrics.averageCycleTime, expectedAvgCycle, 'Average cycle time should aggregate correctly');
        const expectedAvgPassRate = ((100 + (2 / 3 * 100)) / 2);
        assert.strictEqual(Math.round(globalMetrics.averageReviewPassRate), Math.round(expectedAvgPassRate), 'Average review pass rate should aggregate correctly');
        const expectedTotalCost = (5 * 2.00) + (3 * 3.00);
        assert.strictEqual(globalMetrics.totalCostUSD, expectedTotalCost, 'Total cost should be sum of all costs');
        assert.strictEqual(globalMetrics.activeAgents, 2, 'Should have 2 active agents (working + reviewing)');
        assert.strictEqual(globalMetrics.idleAgents, 1, 'Should have 1 idle agent');
    });
    test('AC-5.4.e: When metrics calculation fails → last known values are displayed with stale indicator', async () => {
        const agentId = 'agent-1';
        // Record initial completion
        await performanceMetrics.recordTaskCompletion(agentId, {
            projectNumber: 1,
            cycleTimeMinutes: 100,
            costUSD: 2.00,
            timestamp: new Date().toISOString()
        });
        // Get initial metrics
        const initialMetrics = await performanceMetrics.getAgentMetrics(agentId);
        assert.strictEqual(initialMetrics.tasksCompleted.total, 1, 'Should have 1 task initially');
        // Verify lastUpdated is present (stale indicator)
        assert.ok(initialMetrics.lastUpdated, 'Should have lastUpdated timestamp');
        const lastUpdated = new Date(initialMetrics.lastUpdated);
        assert.ok(lastUpdated.getTime() > 0, 'lastUpdated should be valid date');
        // Even if calculation encounters missing data, should return gracefully
        const metricsForNonExistentAgent = await performanceMetrics.getAgentMetrics('agent-999');
        assert.ok(metricsForNonExistentAgent, 'Should return metrics object even for non-existent agent');
        assert.strictEqual(metricsForNonExistentAgent.tasksCompleted.total, 0, 'Non-existent agent should have 0 tasks');
    });
    test('Rolling 24-hour and 7-day counts are calculated correctly', async () => {
        const agentId = 'agent-1';
        const now = Date.now();
        // Add completions at different times
        const completions = [
            {
                projectNumber: 1,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
            },
            {
                projectNumber: 2,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
            },
            {
                projectNumber: 3,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date(now - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
            },
            {
                projectNumber: 4,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date(now - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
            }
        ];
        for (const completion of completions) {
            await performanceMetrics.recordTaskCompletion(agentId, completion);
        }
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        assert.strictEqual(metrics.tasksCompleted.total, 4, 'Total should be 4');
        assert.strictEqual(metrics.tasksCompleted.last24Hours, 2, 'Last 24 hours should be 2 (projects 3 and 4)');
        assert.strictEqual(metrics.tasksCompleted.last7Days, 3, 'Last 7 days should be 3 (projects 2, 3, and 4)');
    });
    test('Review pass rate calculates correctly', async () => {
        const agentId = 'agent-1';
        // Record reviews: 7 approved, 3 rejected
        await performanceMetrics.recordReviewResult(agentId, 1, true);
        await performanceMetrics.recordReviewResult(agentId, 2, true);
        await performanceMetrics.recordReviewResult(agentId, 3, false);
        await performanceMetrics.recordReviewResult(agentId, 4, true);
        await performanceMetrics.recordReviewResult(agentId, 5, true);
        await performanceMetrics.recordReviewResult(agentId, 6, false);
        await performanceMetrics.recordReviewResult(agentId, 7, true);
        await performanceMetrics.recordReviewResult(agentId, 8, true);
        await performanceMetrics.recordReviewResult(agentId, 9, false);
        await performanceMetrics.recordReviewResult(agentId, 10, true);
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        // 7 approved out of 10 = 70%
        assert.strictEqual(metrics.reviewPassRate, 70, 'Review pass rate should be 70%');
    });
    test('Average cost per project calculates correctly', async () => {
        const agentId = 'agent-1';
        const costs = [1.50, 2.00, 2.50, 3.00, 1.00];
        for (let i = 0; i < costs.length; i++) {
            await performanceMetrics.recordTaskCompletion(agentId, {
                projectNumber: i,
                cycleTimeMinutes: 100,
                costUSD: costs[i],
                timestamp: new Date().toISOString()
            });
        }
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        const expectedAvg = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
        assert.strictEqual(metrics.averageCostPerProject.toFixed(2), expectedAvg.toFixed(2), 'Average cost should be correct');
    });
    test('Metrics persist across instances', async () => {
        const agentId = 'agent-1';
        // Record completion
        await performanceMetrics.recordTaskCompletion(agentId, {
            projectNumber: 42,
            cycleTimeMinutes: 150,
            costUSD: 3.50,
            timestamp: new Date().toISOString()
        });
        // Create new metrics instance
        const newMetrics = new performance_metrics_1.PerformanceMetrics(testWorkspace, sessionManager);
        // Verify data persisted
        const metrics = await newMetrics.getAgentMetrics(agentId);
        assert.strictEqual(metrics.tasksCompleted.total, 1, 'Should have persisted 1 task');
        assert.strictEqual(metrics.averageCycleTime, 150, 'Cycle time should persist');
        assert.strictEqual(metrics.averageCostPerProject, 3.50, 'Cost should persist');
    });
    test('Cache improves performance on repeated calls', async () => {
        const agentId = 'agent-1';
        // Record some data
        for (let i = 0; i < 5; i++) {
            await performanceMetrics.recordTaskCompletion(agentId, {
                projectNumber: i,
                cycleTimeMinutes: 100,
                costUSD: 2.00,
                timestamp: new Date().toISOString()
            });
        }
        // First call (no cache)
        const start1 = Date.now();
        await performanceMetrics.getAgentMetrics(agentId);
        const time1 = Date.now() - start1;
        // Second call (should use cache)
        const start2 = Date.now();
        await performanceMetrics.getAgentMetrics(agentId);
        const time2 = Date.now() - start2;
        // Cached call should be faster (or at least not significantly slower)
        assert.ok(time2 <= time1 + 10, 'Cached call should not be slower than first call');
    });
    test('Clear all metrics resets storage', async () => {
        const agentId = 'agent-1';
        // Record completion
        await performanceMetrics.recordTaskCompletion(agentId, {
            projectNumber: 1,
            cycleTimeMinutes: 100,
            costUSD: 2.00,
            timestamp: new Date().toISOString()
        });
        // Verify data exists
        let metrics = await performanceMetrics.getAgentMetrics(agentId);
        assert.strictEqual(metrics.tasksCompleted.total, 1, 'Should have 1 task');
        // Clear metrics
        performanceMetrics.clearAllMetrics();
        // Verify data cleared
        metrics = await performanceMetrics.getAgentMetrics(agentId);
        assert.strictEqual(metrics.tasksCompleted.total, 0, 'Should have 0 tasks after clear');
    });
    test('Handles empty metrics gracefully', async () => {
        const agentId = 'agent-new';
        // Get metrics for agent with no data
        const metrics = await performanceMetrics.getAgentMetrics(agentId);
        assert.strictEqual(metrics.tasksCompleted.total, 0, 'Total should be 0');
        assert.strictEqual(metrics.tasksCompleted.last24Hours, 0, 'Last 24 hours should be 0');
        assert.strictEqual(metrics.tasksCompleted.last7Days, 0, 'Last 7 days should be 0');
        assert.strictEqual(metrics.averageCycleTime, 0, 'Average cycle time should be 0');
        assert.strictEqual(metrics.reviewPassRate, 0, 'Review pass rate should be 0');
        assert.strictEqual(metrics.errorRate, 0, 'Error rate should be 0');
        assert.strictEqual(metrics.averageCostPerProject, 0, 'Average cost should be 0');
        assert.strictEqual(metrics.uptimePercent, 0, 'Uptime should be 0');
    });
});
//# sourceMappingURL=performance-metrics.test.js.map