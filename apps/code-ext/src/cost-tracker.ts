import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getAgentConfig } from './agent-config';

/**
 * Supported Claude models with their pricing
 */
export type ClaudeModel = 'sonnet' | 'opus' | 'haiku';

/**
 * Token usage data for a single API request
 */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    model: ClaudeModel;
}

/**
 * Cost log entry representing a single API request
 */
export interface CostEntry {
    timestamp: string;
    agentId: string;
    projectNumber: number;
    inputTokens: number;
    outputTokens: number;
    model: ClaudeModel;
    costUSD: number;
}

/**
 * Cost log file structure
 */
interface CostLog {
    entries: CostEntry[];
}

/**
 * Budget status information
 */
export interface BudgetStatus {
    dailySpend: number;
    monthlySpend: number;
    dailyBudget: number;
    monthlyBudget: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    withinBudget: boolean;
    dailyPercentUsed: number;
    monthlyPercentUsed: number;
}

/**
 * Budget alert level based on spend percentage
 */
export type BudgetAlertLevel = 'ok' | 'warning50' | 'warning75' | 'warning90' | 'exceeded';

/**
 * Model pricing in USD per million tokens
 */
const MODEL_PRICING: Record<ClaudeModel, { input: number; output: number }> = {
    sonnet: { input: 3, output: 15 },
    opus: { input: 15, output: 75 },
    haiku: { input: 0.25, output: 1.25 },
};

/**
 * Fallback cost per request when calculation fails
 */
const FALLBACK_COST_PER_REQUEST = 0.50;

/**
 * Cost log file path
 */
let costLogPath: string | null = null;

/**
 * Last alert level shown to avoid duplicate notifications
 */
let lastAlertLevel: BudgetAlertLevel = 'ok';

/**
 * Initialize the cost tracker with workspace root path
 * @param workspaceRoot - Path to workspace root directory
 */
export function initializeCostTracker(workspaceRoot: string): void {
    const sessionsDir = path.join(workspaceRoot, '.claude-sessions');

    // Ensure .claude-sessions directory exists
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }

    costLogPath = path.join(sessionsDir, 'cost-log.json');

    // Initialize empty log file if it doesn't exist
    if (!fs.existsSync(costLogPath)) {
        const emptyLog: CostLog = { entries: [] };
        writeLogFile(emptyLog);
    }
}

/**
 * Calculate cost for a given token usage
 * @param usage - Token usage data
 * @returns Cost in USD
 */
function calculateCost(usage: TokenUsage): number {
    const pricing = MODEL_PRICING[usage.model];
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
}

/**
 * Read the cost log file
 * @returns Cost log data
 */
function readLogFile(): CostLog {
    if (!costLogPath) {
        throw new Error('Cost tracker not initialized. Call initializeCostTracker() first.');
    }

    try {
        const content = fs.readFileSync(costLogPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('[CostTracker] Error reading cost log:', error);
        return { entries: [] };
    }
}

/**
 * Write the cost log file atomically
 * @param log - Cost log data to write
 */
function writeLogFile(log: CostLog): void {
    if (!costLogPath) {
        throw new Error('Cost tracker not initialized. Call initializeCostTracker() first.');
    }

    try {
        const tempPath = `${costLogPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(log, null, 2), 'utf-8');
        fs.renameSync(tempPath, costLogPath);
    } catch (error) {
        console.error('[CostTracker] Error writing cost log:', error);
        throw error;
    }
}

/**
 * Log API usage and calculate cost
 * @param agentId - ID of the agent making the request
 * @param usage - Token usage data
 * @param projectNumber - Project number
 */
export async function logApiUsage(
    agentId: string,
    usage: TokenUsage,
    projectNumber: number
): Promise<void> {
    try {
        const cost = calculateCost(usage);
        const entry: CostEntry = {
            timestamp: new Date().toISOString(),
            agentId,
            projectNumber,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            model: usage.model,
            costUSD: cost,
        };

        const log = readLogFile();
        log.entries.push(entry);
        writeLogFile(log);

        console.log(`[CostTracker] Logged usage: Agent=${agentId}, Project=${projectNumber}, Cost=$${cost.toFixed(4)}`);

        // Check budget after logging
        await checkAndNotifyBudget();
    } catch (error) {
        console.error('[CostTracker] Error logging API usage:', error);

        // Log fallback cost on failure
        try {
            const fallbackEntry: CostEntry = {
                timestamp: new Date().toISOString(),
                agentId,
                projectNumber,
                inputTokens: 0,
                outputTokens: 0,
                model: usage.model,
                costUSD: FALLBACK_COST_PER_REQUEST,
            };

            const log = readLogFile();
            log.entries.push(fallbackEntry);
            writeLogFile(log);

            vscode.window.showWarningMessage(
                `Cost tracking failed. Assuming worst-case cost of $${FALLBACK_COST_PER_REQUEST} per request.`
            );
        } catch (fallbackError) {
            console.error('[CostTracker] Failed to log fallback cost:', fallbackError);
        }
    }
}

/**
 * Get total spend for today
 * @returns Daily spend in USD
 */
export async function getDailySpend(): Promise<number> {
    const log = readLogFile();
    const today = new Date().toISOString().split('T')[0];

    return log.entries
        .filter(entry => entry.timestamp.startsWith(today))
        .reduce((sum, entry) => sum + entry.costUSD, 0);
}

/**
 * Get total spend for this month
 * @returns Monthly spend in USD
 */
export async function getMonthlySpend(): Promise<number> {
    const log = readLogFile();
    const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    return log.entries
        .filter(entry => entry.timestamp.startsWith(thisMonth))
        .reduce((sum, entry) => sum + entry.costUSD, 0);
}

/**
 * Get total spend for a specific project
 * @param projectNumber - Project number
 * @returns Project spend in USD
 */
export async function getProjectSpend(projectNumber: number): Promise<number> {
    const log = readLogFile();

    return log.entries
        .filter(entry => entry.projectNumber === projectNumber)
        .reduce((sum, entry) => sum + entry.costUSD, 0);
}

/**
 * Get total spend for a specific agent
 * @param agentId - Agent ID
 * @returns Agent spend in USD
 */
export async function getAgentSpend(agentId: string): Promise<number> {
    const log = readLogFile();

    return log.entries
        .filter(entry => entry.agentId === agentId)
        .reduce((sum, entry) => sum + entry.costUSD, 0);
}

/**
 * Check current budget status
 * @returns Budget status information
 */
export async function checkBudget(): Promise<BudgetStatus> {
    const config = getAgentConfig();
    const dailySpend = await getDailySpend();
    const monthlySpend = await getMonthlySpend();

    const dailyRemaining = Math.max(0, config.dailyBudgetUSD - dailySpend);
    const monthlyRemaining = Math.max(0, config.monthlyBudgetUSD - monthlySpend);

    const dailyPercentUsed = (dailySpend / config.dailyBudgetUSD) * 100;
    const monthlyPercentUsed = (monthlySpend / config.monthlyBudgetUSD) * 100;

    const withinBudget = dailySpend <= config.dailyBudgetUSD && monthlySpend <= config.monthlyBudgetUSD;

    return {
        dailySpend,
        monthlySpend,
        dailyBudget: config.dailyBudgetUSD,
        monthlyBudget: config.monthlyBudgetUSD,
        dailyRemaining,
        monthlyRemaining,
        withinBudget,
        dailyPercentUsed,
        monthlyPercentUsed,
    };
}

/**
 * Get current budget alert level
 * @returns Alert level based on daily spend percentage
 */
export async function getBudgetAlertLevel(): Promise<BudgetAlertLevel> {
    const status = await checkBudget();
    const percentUsed = status.dailyPercentUsed;

    if (percentUsed >= 100) {
        return 'exceeded';
    } else if (percentUsed >= 90) {
        return 'warning90';
    } else if (percentUsed >= 75) {
        return 'warning75';
    } else if (percentUsed >= 50) {
        return 'warning50';
    } else {
        return 'ok';
    }
}

/**
 * Check budget and send notifications if thresholds are crossed
 */
async function checkAndNotifyBudget(): Promise<void> {
    const status = await checkBudget();
    const alertLevel = await getBudgetAlertLevel();

    // Only notify if alert level has changed
    if (alertLevel === lastAlertLevel) {
        return;
    }

    lastAlertLevel = alertLevel;

    switch (alertLevel) {
        case 'warning50':
            vscode.window.showInformationMessage(
                `Budget Alert: 50% of daily budget used ($${status.dailySpend.toFixed(2)} / $${status.dailyBudget.toFixed(2)})`
            );
            break;

        case 'warning75':
            vscode.window.showWarningMessage(
                `Budget Alert: 75% of daily budget used ($${status.dailySpend.toFixed(2)} / $${status.dailyBudget.toFixed(2)})`
            );
            break;

        case 'warning90':
            vscode.window.showErrorMessage(
                `Budget Alert: 90% of daily budget used! New project claims paused. ($${status.dailySpend.toFixed(2)} / $${status.dailyBudget.toFixed(2)})`
            );
            break;

        case 'exceeded':
            vscode.window.showErrorMessage(
                `Budget Exceeded! Daily budget limit reached. All agents will be stopped. ($${status.dailySpend.toFixed(2)} / $${status.dailyBudget.toFixed(2)})`,
                'View Details'
            ).then(action => {
                if (action === 'View Details') {
                    vscode.window.showInformationMessage(
                        `Daily: $${status.dailySpend.toFixed(2)} / $${status.dailyBudget.toFixed(2)}\n` +
                        `Monthly: $${status.monthlySpend.toFixed(2)} / $${status.monthlyBudget.toFixed(2)}`
                    );
                }
            });
            break;
    }
}

/**
 * Reset the last alert level (useful for testing)
 */
export function resetAlertLevel(): void {
    lastAlertLevel = 'ok';
}

/**
 * Clear all cost entries (useful for testing and monthly resets)
 */
export function clearCostLog(): void {
    const emptyLog: CostLog = { entries: [] };
    writeLogFile(emptyLog);
    console.log('[CostTracker] Cost log cleared');
}
