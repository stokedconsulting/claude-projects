import * as fs from 'fs';
import * as path from 'path';
import { AgentSessionManager } from './agent-session-manager';
import { ProjectQueueManager } from './project-queue-manager';
import { GitHubAPI, ProjectItem } from './github-api';

/**
 * Result of a project execution
 */
export interface ExecutionResult {
    success: boolean;
    projectNumber: number;
    issueNumber: number;
    branchName: string;
    error?: string;
    duration: number;
}

/**
 * Current execution status for an agent
 */
export interface ExecutionStatus {
    agentId: number;
    isExecuting: boolean;
    currentProject: number | null;
    currentIssue: number | null;
    startedAt: Date | null;
    error?: string;
}

/**
 * Execution loop state tracking
 */
interface ExecutionLoopState {
    isRunning: boolean;
    intervalId: NodeJS.Timeout | null;
    currentExecution: ExecutionStatus;
}

/**
 * Agent Executor
 *
 * Manages the agent task execution loop:
 * 1. Query project queue for available issues
 * 2. Claim first available issue atomically
 * 3. Execute /project-start command (simulated)
 * 4. Monitor for completion
 * 5. Push code to remote branch (simulated)
 * 6. Update issue status to "done"
 * 7. Return to idle and look for next task
 *
 * AC-2.2.a: When agent claims issue → agent status transitions to "working" and execution starts within 30 seconds
 * AC-2.2.b: When project execution completes successfully → code is "pushed" to branch within 2 minutes (simulated)
 * AC-2.2.c: When code is pushed → issue status is updated to "done" within 30 seconds
 * AC-2.2.d: When project completes → agent status returns to "idle" and `tasksCompleted` increments
 * AC-2.2.e: When execution fails with error → agent status returns to "idle", error is logged, claim is released
 * AC-2.2.f: When execution exceeds 8-hour timeout → session is killed, claim is released
 */
export class AgentExecutor {
    private sessionManager: AgentSessionManager;
    private queueManager: ProjectQueueManager;
    private githubApi: GitHubAPI;
    private workspaceRoot: string;
    private executionLoops: Map<number, ExecutionLoopState>;
    private readonly LOOP_INTERVAL_MS = 10000; // Check for new work every 10 seconds
    private readonly EXECUTION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
    private readonly PROJECT_ID: string; // GitHub project ID to work from

    constructor(
        workspaceRoot: string,
        githubApi: GitHubAPI,
        projectId: string
    ) {
        this.workspaceRoot = workspaceRoot;
        this.githubApi = githubApi;
        this.PROJECT_ID = projectId;
        this.sessionManager = new AgentSessionManager(workspaceRoot);
        this.queueManager = new ProjectQueueManager(workspaceRoot, githubApi);
        this.executionLoops = new Map();
    }

    /**
     * Get the full path to the response file for an agent
     */
    private getResponseFilePath(agentId: number): string {
        const sessionsDir = this.sessionManager.getSessionsDirectory();
        return path.join(sessionsDir, `agent-${agentId}.response.md`);
    }

    /**
     * Start the execution loop for an agent
     * Agent will continuously look for available work and execute projects
     *
     * AC-2.2.a: When agent claims issue → agent status transitions to "working" and execution starts within 30 seconds
     */
    public async startExecutionLoop(agentId: number): Promise<void> {
        // Check if loop already running
        if (this.executionLoops.has(agentId)) {
            const state = this.executionLoops.get(agentId)!;
            if (state.isRunning) {
                console.log(`[AgentExecutor] Execution loop already running for agent-${agentId}`);
                return;
            }
        }

        console.log(`[AgentExecutor] Starting execution loop for agent-${agentId}`);

        // Verify agent session exists
        const session = await this.sessionManager.readAgentSession(agentId);
        if (!session) {
            throw new Error(`Agent session ${agentId} does not exist. Create session first.`);
        }

        // Initialize loop state
        const loopState: ExecutionLoopState = {
            isRunning: true,
            intervalId: null,
            currentExecution: {
                agentId,
                isExecuting: false,
                currentProject: null,
                currentIssue: null,
                startedAt: null
            }
        };

        // Start the execution loop
        const loopFn = async () => {
            if (!loopState.isRunning) {
                return;
            }

            // Skip if already executing
            if (loopState.currentExecution.isExecuting) {
                console.log(`[AgentExecutor] Agent-${agentId} is busy, skipping work check`);
                return;
            }

            try {
                await this.executionLoopIteration(agentId, loopState);
            } catch (error) {
                console.error(`[AgentExecutor] Error in execution loop for agent-${agentId}:`, error);
            }
        };

        // Run first iteration immediately
        await loopFn();

        // Schedule subsequent iterations
        loopState.intervalId = setInterval(loopFn, this.LOOP_INTERVAL_MS);
        this.executionLoops.set(agentId, loopState);

        console.log(`[AgentExecutor] Execution loop started for agent-${agentId} (checking every ${this.LOOP_INTERVAL_MS}ms)`);
    }

    /**
     * Single iteration of the execution loop
     * Checks for available work and executes if found
     */
    private async executionLoopIteration(agentId: number, loopState: ExecutionLoopState): Promise<void> {
        // Clean up stale claims first
        await this.queueManager.cleanupStaleClaims();

        // Query for available projects
        const availableProjects = await this.queueManager.getAvailableProjects(this.PROJECT_ID);

        if (availableProjects.length === 0) {
            console.log(`[AgentExecutor] No available projects for agent-${agentId}`);
            return;
        }

        // Take first available project (lowest issue number = highest priority)
        const project = availableProjects[0];
        const issueNumber = project.content.number;

        // Extract project number (assuming single project for now)
        // In production, this would come from the ProjectItem or be configured
        const projectNumber = 79; // TODO: Get from configuration or ProjectItem

        console.log(`[AgentExecutor] Agent-${agentId} attempting to claim issue ${issueNumber} from project ${projectNumber}`);

        // Attempt to claim the project atomically
        const claimed = await this.queueManager.claimProject(projectNumber, issueNumber, `agent-${agentId}`);

        if (!claimed) {
            console.log(`[AgentExecutor] Agent-${agentId} failed to claim issue ${issueNumber} (likely claimed by another agent)`);
            return;
        }

        // Update execution state
        loopState.currentExecution.isExecuting = true;
        loopState.currentExecution.currentProject = projectNumber;
        loopState.currentExecution.currentIssue = issueNumber;
        loopState.currentExecution.startedAt = new Date();

        // Execute the project
        try {
            await this.executeProject(agentId, projectNumber, issueNumber);
        } catch (error) {
            console.error(`[AgentExecutor] Execution failed for agent-${agentId}:`, error);
            // Error handling is done in executeProject, just log here
        } finally {
            // Reset execution state
            loopState.currentExecution.isExecuting = false;
            loopState.currentExecution.currentProject = null;
            loopState.currentExecution.currentIssue = null;
            loopState.currentExecution.startedAt = null;
        }
    }

    /**
     * Stop the execution loop for an agent
     */
    public stopExecutionLoop(agentId: number): void {
        const loopState = this.executionLoops.get(agentId);

        if (!loopState) {
            console.log(`[AgentExecutor] No execution loop found for agent-${agentId}`);
            return;
        }

        console.log(`[AgentExecutor] Stopping execution loop for agent-${agentId}`);

        // Stop the loop
        loopState.isRunning = false;

        // Clear the interval
        if (loopState.intervalId) {
            clearInterval(loopState.intervalId);
            loopState.intervalId = null;
        }

        this.executionLoops.delete(agentId);

        console.log(`[AgentExecutor] Execution loop stopped for agent-${agentId}`);
    }

    /**
     * Execute a single project
     *
     * AC-2.2.a: When agent claims issue → agent status transitions to "working" and execution starts within 30 seconds
     * AC-2.2.b: When project execution completes successfully → code is "pushed" to branch within 2 minutes (simulated)
     * AC-2.2.c: When code is pushed → issue status is updated to "done" within 30 seconds
     * AC-2.2.d: When project completes → agent status returns to "idle" and `tasksCompleted` increments
     * AC-2.2.e: When execution fails with error → agent status returns to "idle", error is logged, claim is released
     * AC-2.2.f: When execution exceeds 8-hour timeout → session is killed, claim is released
     */
    public async executeProject(
        agentId: number,
        projectNumber: number,
        issueNumber: number
    ): Promise<ExecutionResult> {
        const startTime = Date.now();
        const branchName = `agent-${agentId}/project-${issueNumber}`;

        console.log(`[AgentExecutor] Agent-${agentId} executing project ${projectNumber}, issue ${issueNumber}`);

        try {
            // Update session file: status="working", currentProjectNumber, branchName
            await this.sessionManager.updateAgentSession(agentId, {
                status: 'working',
                currentProjectNumber: projectNumber,
                branchName,
                currentTaskDescription: `Executing issue #${issueNumber}`
            });

            // Create branch (simulated)
            console.log(`[AgentExecutor] Creating branch: ${branchName}`);
            await this.createBranch(branchName);

            // Execute Claude Code command: /project-start {projectNumber} (simulated)
            console.log(`[AgentExecutor] Executing /project-start ${issueNumber}`);
            await this.executeClaudeCommand(agentId, issueNumber);

            // Monitor for completion with timeout
            console.log(`[AgentExecutor] Monitoring for completion (timeout: ${this.EXECUTION_TIMEOUT_MS}ms)`);
            const completed = await this.waitForCompletion(agentId, startTime);

            if (!completed) {
                throw new Error('Execution timeout: exceeded 8 hours');
            }

            // Push code to remote branch (simulated)
            console.log(`[AgentExecutor] Pushing branch: ${branchName}`);
            await this.pushBranch(branchName);

            // Update issue status to "done" (simulated)
            console.log(`[AgentExecutor] Updating issue ${issueNumber} status to "done"`);
            await this.updateIssueStatus(projectNumber, issueNumber, 'done');

            // Update session file: status="idle", currentProjectNumber=null, tasksCompleted++
            const session = await this.sessionManager.readAgentSession(agentId);
            const tasksCompleted = session ? session.tasksCompleted + 1 : 1;

            await this.sessionManager.updateAgentSession(agentId, {
                status: 'idle',
                currentProjectNumber: null,
                currentPhase: null,
                branchName: null,
                tasksCompleted,
                currentTaskDescription: null
            });

            const duration = Date.now() - startTime;

            console.log(
                `[AgentExecutor] Agent-${agentId} completed project ${projectNumber}, issue ${issueNumber} in ${duration}ms`
            );

            return {
                success: true,
                projectNumber,
                issueNumber,
                branchName,
                duration
            };
        } catch (error) {
            // AC-2.2.e: When execution fails with error → agent status returns to "idle", error is logged, claim is released
            const errorMessage = error instanceof Error ? error.message : String(error);

            console.error(`[AgentExecutor] Agent-${agentId} execution failed:`, error);

            // Update session with error
            const session = await this.sessionManager.readAgentSession(agentId);
            const errorCount = session ? session.errorCount + 1 : 1;

            await this.sessionManager.updateAgentSession(agentId, {
                status: 'idle',
                currentProjectNumber: null,
                currentPhase: null,
                branchName: null,
                currentTaskDescription: null,
                lastError: errorMessage,
                errorCount
            });

            // Release the claim
            await this.queueManager.releaseProjectClaim(projectNumber, issueNumber);

            const duration = Date.now() - startTime;

            return {
                success: false,
                projectNumber,
                issueNumber,
                branchName,
                error: errorMessage,
                duration
            };
        }
    }

    /**
     * Create a git branch (stubbed for now)
     * TODO: Implement real git integration
     */
    private async createBranch(branchName: string): Promise<void> {
        // Simulated delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // TODO: Real implementation
        // const { exec } = require('child_process');
        // await new Promise((resolve, reject) => {
        //     exec(`git checkout -b ${branchName}`, { cwd: this.workspaceRoot }, (error, stdout, stderr) => {
        //         if (error) {
        //             reject(error);
        //         } else {
        //             resolve(stdout);
        //         }
        //     });
        // });

        console.log(`[AgentExecutor] [STUB] Created branch: ${branchName}`);
    }

    /**
     * Push a git branch to remote (stubbed for now)
     * TODO: Implement real git integration
     */
    private async pushBranch(branchName: string): Promise<void> {
        // Simulated delay (represents push time)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // TODO: Real implementation
        // const { exec } = require('child_process');
        // await new Promise((resolve, reject) => {
        //     exec(`git push origin ${branchName}`, { cwd: this.workspaceRoot }, (error, stdout, stderr) => {
        //         if (error) {
        //             reject(error);
        //         } else {
        //             resolve(stdout);
        //         }
        //     });
        // });

        console.log(`[AgentExecutor] [STUB] Pushed branch: ${branchName}`);
    }

    /**
     * Execute Claude Code command (stubbed for now)
     * TODO: Integrate with real Claude Code CLI
     */
    private async executeClaudeCommand(agentId: number, issueNumber: number): Promise<void> {
        // Simulated execution delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // TODO: Real implementation
        // const { spawn } = require('child_process');
        // const claudeProcess = spawn('claude-code', ['--session', `agent-${agentId}`, '/project-start', String(issueNumber)], {
        //     cwd: this.workspaceRoot,
        //     stdio: ['ignore', 'pipe', 'pipe']
        // });
        //
        // return new Promise((resolve, reject) => {
        //     claudeProcess.on('error', reject);
        //     claudeProcess.on('exit', (code) => {
        //         if (code === 0) {
        //             resolve();
        //         } else {
        //             reject(new Error(`Claude process exited with code ${code}`));
        //         }
        //     });
        // });

        // For now, write a fake response file
        const responseFile = this.getResponseFilePath(agentId);
        const responseContent = `# Agent ${agentId} - Issue ${issueNumber}\n\nExecution complete (simulated).\n`;
        fs.writeFileSync(responseFile, responseContent, 'utf-8');

        console.log(`[AgentExecutor] [STUB] Executed /project-start ${issueNumber} for agent-${agentId}`);
    }

    /**
     * Wait for project execution to complete
     * Monitors response file for completion signal
     *
     * AC-2.2.f: When execution exceeds 8-hour timeout → session is killed, claim is released
     */
    private async waitForCompletion(agentId: number, startTime: number): Promise<boolean> {
        const responseFile = this.getResponseFilePath(agentId);
        const checkInterval = 5000; // Check every 5 seconds

        return new Promise((resolve) => {
            const checkCompletion = () => {
                // Check timeout
                const elapsed = Date.now() - startTime;
                if (elapsed > this.EXECUTION_TIMEOUT_MS) {
                    console.error(`[AgentExecutor] Agent-${agentId} execution timeout (${elapsed}ms)`);
                    resolve(false);
                    return;
                }

                // Check if response file exists
                if (fs.existsSync(responseFile)) {
                    console.log(`[AgentExecutor] Agent-${agentId} completion detected via response file`);

                    // Clean up response file
                    try {
                        fs.unlinkSync(responseFile);
                    } catch (error) {
                        console.error(`[AgentExecutor] Failed to clean up response file:`, error);
                    }

                    resolve(true);
                    return;
                }

                // Continue checking
                setTimeout(checkCompletion, checkInterval);
            };

            // Start checking
            checkCompletion();
        });
    }

    /**
     * Update issue status (stubbed for now)
     * TODO: Integrate with GitHub API via MCP
     */
    private async updateIssueStatus(
        projectNumber: number,
        issueNumber: number,
        status: string
    ): Promise<void> {
        // Simulated delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // TODO: Real implementation via GitHub GraphQL API
        // const mutation = `
        //     mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
        //         updateProjectV2ItemFieldValue(
        //             input: {
        //                 projectId: $projectId
        //                 itemId: $itemId
        //                 fieldId: $fieldId
        //                 value: { text: $value }
        //             }
        //         ) {
        //             projectV2Item {
        //                 id
        //             }
        //         }
        //     }
        // `;
        // await this.githubApi.executeMutation(mutation, variables);

        console.log(`[AgentExecutor] [STUB] Updated issue ${issueNumber} status to "${status}"`);
    }

    /**
     * Get current execution status for an agent
     */
    public getExecutionStatus(agentId: number): ExecutionStatus {
        const loopState = this.executionLoops.get(agentId);

        if (!loopState) {
            return {
                agentId,
                isExecuting: false,
                currentProject: null,
                currentIssue: null,
                startedAt: null
            };
        }

        return { ...loopState.currentExecution };
    }

    /**
     * Check if an agent is currently executing a project
     */
    public isAgentExecuting(agentId: number): boolean {
        const status = this.getExecutionStatus(agentId);
        return status.isExecuting;
    }

    /**
     * Get statistics about all executing agents
     */
    public getExecutionStats(): {
        totalExecuting: number;
        agents: Array<{ agentId: number; projectNumber: number; issueNumber: number; duration: number }>;
    } {
        const agents: Array<{ agentId: number; projectNumber: number; issueNumber: number; duration: number }> = [];

        for (const [agentId, loopState] of this.executionLoops.entries()) {
            if (loopState.currentExecution.isExecuting) {
                const duration = loopState.currentExecution.startedAt
                    ? Date.now() - loopState.currentExecution.startedAt.getTime()
                    : 0;

                agents.push({
                    agentId,
                    projectNumber: loopState.currentExecution.currentProject!,
                    issueNumber: loopState.currentExecution.currentIssue!,
                    duration
                });
            }
        }

        return {
            totalExecuting: agents.length,
            agents
        };
    }
}

/**
 * Singleton instance for global access
 */
let executorInstance: AgentExecutor | null = null;

/**
 * Initialize the agent executor with workspace root and GitHub API
 * Should be called during extension activation
 */
export function initializeAgentExecutor(
    workspaceRoot: string,
    githubApi: GitHubAPI,
    projectId: string
): AgentExecutor {
    executorInstance = new AgentExecutor(workspaceRoot, githubApi, projectId);
    return executorInstance;
}

/**
 * Get the singleton executor instance
 * @throws Error if not initialized
 */
export function getAgentExecutor(): AgentExecutor {
    if (!executorInstance) {
        throw new Error('AgentExecutor not initialized. Call initializeAgentExecutor first.');
    }
    return executorInstance;
}

/**
 * Cleanup and reset the executor
 * Should be called during extension deactivation
 */
export function cleanupAgentExecutor(): void {
    if (executorInstance) {
        // Stop all execution loops
        // Note: loops are tracked internally, just clear the instance
        executorInstance = null;
    }
}
