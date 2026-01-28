/**
 * Loop Validator Integration Example
 *
 * This file demonstrates how to integrate the LoopValidator into the agent orchestration system.
 * It shows typical usage patterns and monitoring scenarios.
 */

import { LoopValidator } from './loop-validator';
import { AgentSessionManager } from './agent-session-manager';
import { ProjectQueueManager } from './project-queue-manager';
import { ReviewQueueManager } from './review-queue-manager';
import { GitHubAPI } from './github-api';

/**
 * Example 1: Initialize the LoopValidator during extension activation
 */
export async function initializeLoopValidator(workspaceRoot: string): Promise<LoopValidator> {
    // Initialize dependencies
    const sessionManager = new AgentSessionManager(workspaceRoot);

    // Initialize GitHub API (no output channel needed for basic usage)
    const githubApi = new GitHubAPI();
    const projectQueueManager = new ProjectQueueManager(workspaceRoot, githubApi);
    const reviewQueueManager = new ReviewQueueManager(workspaceRoot);

    // Create LoopValidator instance
    const loopValidator = new LoopValidator(
        workspaceRoot,
        sessionManager,
        projectQueueManager,
        reviewQueueManager
    );

    console.log('[LoopValidator] Initialized successfully');
    return loopValidator;
}

/**
 * Example 2: Monitor loop health periodically (every 5 minutes)
 */
export function startLoopHealthMonitoring(loopValidator: LoopValidator): NodeJS.Timeout {
    const monitoringInterval = 5 * 60 * 1000; // 5 minutes

    const intervalId = setInterval(async () => {
        try {
            const health = await loopValidator.validateLoopHealth();

            console.log('[LoopValidator] Health Check:');
            console.log(`  - Healthy: ${health.healthy}`);
            console.log(`  - Active Agents: ${health.activeAgents}`);
            console.log(`  - Idle Agents: ${health.idleAgents}`);
            console.log(`  - Ideating Agents: ${health.ideatingAgents}`);
            console.log(`  - Project Queue: ${health.projectQueueDepth}`);
            console.log(`  - Review Queue: ${health.reviewQueueDepth}`);
            console.log(`  - Average Cycle Time: ${Math.round(health.averageCycleTime)} min`);
            console.log(`  - Stuck Agents: ${health.stuckAgents.length}`);

            if (health.recommendations.length > 0) {
                console.log('[LoopValidator] Recommendations:');
                health.recommendations.forEach(rec => {
                    console.log(`  - ${rec}`);
                });
            }

            // Take action based on health status
            if (!health.healthy) {
                console.warn('[LoopValidator] System is unhealthy, consider manual intervention');
            }

        } catch (error) {
            console.error('[LoopValidator] Health check failed:', error);
        }
    }, monitoringInterval);

    return intervalId;
}

/**
 * Example 3: Log state transitions during agent lifecycle events
 */
export async function onAgentStatusChange(
    loopValidator: LoopValidator,
    agentId: string,
    oldStatus: string,
    newStatus: string,
    projectNumber?: number
): Promise<void> {
    try {
        await loopValidator.logStateTransition(
            agentId,
            oldStatus as any,
            newStatus as any,
            projectNumber
        );

        console.log(`[LoopValidator] Logged transition: ${agentId} ${oldStatus} → ${newStatus}`);
    } catch (error) {
        console.error('[LoopValidator] Failed to log state transition:', error);
    }
}

/**
 * Example 4: Check if ideation should be triggered
 */
export async function shouldTriggerIdeation(loopValidator: LoopValidator): Promise<boolean> {
    try {
        const shouldPrioritize = await loopValidator.shouldPrioritizeIdeation();
        const shouldPause = await loopValidator.shouldPauseIdeation();

        if (shouldPrioritize) {
            console.log('[LoopValidator] Queue depth low, should prioritize ideation');
            return true;
        }

        if (shouldPause) {
            console.log('[LoopValidator] Queue depth high, should pause ideation');
            return false;
        }

        console.log('[LoopValidator] Queue depth optimal, normal ideation cadence');
        return true;

    } catch (error) {
        console.error('[LoopValidator] Failed to check ideation status:', error);
        return true; // Default to allowing ideation
    }
}

/**
 * Example 5: Detect and handle stuck agents
 */
export async function monitorStuckAgents(loopValidator: LoopValidator): Promise<void> {
    try {
        const stuckAgents = await loopValidator.detectStuckAgents();

        if (stuckAgents.length > 0) {
            console.warn(`[LoopValidator] Found ${stuckAgents.length} stuck agent(s):`);

            for (const agent of stuckAgents) {
                console.warn(`  - ${agent.agentId}: stuck in ${agent.currentStatus} for ${agent.stuckDuration} minutes`);

                // Take corrective action
                // Example: Send notification, restart agent, etc.
            }
        }
    } catch (error) {
        console.error('[LoopValidator] Failed to detect stuck agents:', error);
    }
}

/**
 * Example 6: Generate category coverage report
 */
export async function generateCategoryReport(loopValidator: LoopValidator): Promise<void> {
    try {
        const report = await loopValidator.getCategoryUsageReport();

        console.log('[LoopValidator] Category Coverage Report:');
        console.log(`  - Coverage: ${report.coveragePercent}%`);
        console.log(`  - Categories Used (last 30 days): ${report.categoriesUsed.length}`);
        console.log(`  - Categories Not Used: ${report.categoriesNotUsed.length}`);

        if (report.categoriesNotUsed.length > 0) {
            console.log('  - Unused Categories:');
            report.categoriesNotUsed.forEach(cat => {
                console.log(`    - ${cat}`);
            });
        }
    } catch (error) {
        console.error('[LoopValidator] Failed to generate category report:', error);
    }
}

/**
 * Example 7: Measure agent cycle performance
 */
export async function measureAgentPerformance(
    loopValidator: LoopValidator,
    agentId: string
): Promise<void> {
    try {
        const metrics = await loopValidator.measureCycleTime(agentId);

        console.log(`[LoopValidator] Cycle Metrics for ${agentId}:`);
        console.log(`  - Cycles Completed: ${metrics.cyclesCompleted}`);
        console.log(`  - Last Cycle Time: ${Math.round(metrics.lastCycleTime)} minutes`);
        console.log(`  - Average Cycle Time: ${Math.round(metrics.averageCycleTime)} minutes`);
        console.log(`  - Last Transition: ${metrics.lastStateTransition}`);

        // Alert if cycle time exceeds target
        const TARGET_CYCLE_TIME = 240; // 4 hours in minutes
        if (metrics.averageCycleTime > TARGET_CYCLE_TIME) {
            console.warn(
                `[LoopValidator] Agent ${agentId} exceeds target cycle time (${Math.round(metrics.averageCycleTime)} > ${TARGET_CYCLE_TIME} min)`
            );
        }
    } catch (error) {
        console.error('[LoopValidator] Failed to measure cycle time:', error);
    }
}

/**
 * Example 8: Complete workflow integration
 */
export async function runCompleteHealthCheck(loopValidator: LoopValidator): Promise<void> {
    console.log('[LoopValidator] Starting complete health check...');

    // 1. Validate overall loop health
    const health = await loopValidator.validateLoopHealth();
    console.log(`[LoopValidator] System health: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);

    // 2. Check for stuck agents
    await monitorStuckAgents(loopValidator);

    // 3. Generate category coverage report
    await generateCategoryReport(loopValidator);

    // 4. Check queue depths
    const queueDepth = await loopValidator.getQueueDepth();
    console.log(`[LoopValidator] Queue depths: Projects=${queueDepth.projectQueueDepth}, Reviews=${queueDepth.reviewQueueDepth}`);

    // 5. Determine ideation action
    const shouldIdeate = await shouldTriggerIdeation(loopValidator);
    console.log(`[LoopValidator] Should trigger ideation: ${shouldIdeate}`);

    console.log('[LoopValidator] Complete health check finished');
}

/**
 * Example 9: Cleanup during extension deactivation
 */
export function stopLoopHealthMonitoring(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId);
    console.log('[LoopValidator] Stopped health monitoring');
}
