import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    initializeCostTracker,
    logApiUsage,
    getDailySpend,
    getMonthlySpend,
    getProjectSpend,
    getAgentSpend,
    checkBudget,
    getBudgetAlertLevel,
    clearCostLog,
    resetAlertLevel,
    TokenUsage,
    BudgetStatus,
} from '../cost-tracker';

suite('CostTracker Test Suite', () => {
    let testDir: string;
    let costLogPath: string;

    setup(() => {
        // Create temporary test directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-tracker-test-'));
        initializeCostTracker(testDir);
        costLogPath = path.join(testDir, '.claude-sessions', 'cost-log.json');
        resetAlertLevel();
    });

    teardown(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('Initialization creates cost log file', () => {
        assert.strictEqual(fs.existsSync(costLogPath), true);

        const content = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        assert.deepStrictEqual(content, { entries: [] });
    });

    test('AC-2.4.a: Cost is calculated and logged within 1 second', async function() {
        this.timeout(2000); // 2 second timeout

        const startTime = Date.now();
        const usage: TokenUsage = {
            inputTokens: 1000,
            outputTokens: 500,
            model: 'sonnet',
        };

        await logApiUsage('agent-1', usage, 42);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within 1 second
        assert.ok(duration < 1000, `Logging took ${duration}ms, should be < 1000ms`);

        // Verify entry was logged
        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        assert.strictEqual(log.entries.length, 1);
        assert.strictEqual(log.entries[0].agentId, 'agent-1');
        assert.strictEqual(log.entries[0].projectNumber, 42);
    });

    test('Cost calculation - Sonnet model', async () => {
        const usage: TokenUsage = {
            inputTokens: 1_000_000, // 1M tokens
            outputTokens: 1_000_000, // 1M tokens
            model: 'sonnet',
        };

        await logApiUsage('agent-1', usage, 1);

        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const entry = log.entries[0];

        // Sonnet: $3/MTok input + $15/MTok output = $18 for 1M+1M tokens
        assert.strictEqual(entry.costUSD, 18);
    });

    test('Cost calculation - Opus model', async () => {
        const usage: TokenUsage = {
            inputTokens: 1_000_000, // 1M tokens
            outputTokens: 1_000_000, // 1M tokens
            model: 'opus',
        };

        await logApiUsage('agent-1', usage, 1);

        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const entry = log.entries[0];

        // Opus: $15/MTok input + $75/MTok output = $90 for 1M+1M tokens
        assert.strictEqual(entry.costUSD, 90);
    });

    test('Cost calculation - Haiku model', async () => {
        const usage: TokenUsage = {
            inputTokens: 1_000_000, // 1M tokens
            outputTokens: 1_000_000, // 1M tokens
            model: 'haiku',
        };

        await logApiUsage('agent-1', usage, 1);

        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const entry = log.entries[0];

        // Haiku: $0.25/MTok input + $1.25/MTok output = $1.50 for 1M+1M tokens
        assert.strictEqual(entry.costUSD, 1.5);
    });

    test('Cost calculation - Accurate for small token counts', async () => {
        const usage: TokenUsage = {
            inputTokens: 1000, // Small request
            outputTokens: 500,
            model: 'sonnet',
        };

        await logApiUsage('agent-1', usage, 1);

        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const entry = log.entries[0];

        // Sonnet: (1000/1M * $3) + (500/1M * $15) = $0.003 + $0.0075 = $0.0105
        assert.strictEqual(entry.costUSD, 0.0105);
    });

    test('getDailySpend returns correct sum', async () => {
        // Log multiple entries for today
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);
        await logApiUsage('agent-2', { inputTokens: 2000, outputTokens: 1000, model: 'sonnet' }, 1);

        const dailySpend = await getDailySpend();

        // (1000/1M * $3 + 500/1M * $15) + (2000/1M * $3 + 1000/1M * $15)
        // = 0.0105 + 0.021 = 0.0315
        assert.strictEqual(dailySpend, 0.0315);
    });

    test('getDailySpend filters by date', async () => {
        // Add an entry for today
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        // Manually add an entry for yesterday
        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        log.entries.push({
            timestamp: yesterday.toISOString(),
            agentId: 'agent-2',
            projectNumber: 1,
            inputTokens: 1000,
            outputTokens: 500,
            model: 'sonnet',
            costUSD: 0.0105,
        });
        fs.writeFileSync(costLogPath, JSON.stringify(log, null, 2));

        const dailySpend = await getDailySpend();

        // Should only count today's entry
        assert.strictEqual(dailySpend, 0.0105);
    });

    test('getMonthlySpend returns correct sum', async () => {
        // Log multiple entries
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);
        await logApiUsage('agent-2', { inputTokens: 2000, outputTokens: 1000, model: 'sonnet' }, 2);

        const monthlySpend = await getMonthlySpend();

        // Same as daily since all entries are from this month
        assert.strictEqual(monthlySpend, 0.0315);
    });

    test('getMonthlySpend filters by month', async () => {
        // Add an entry for this month
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        // Manually add an entry for last month
        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        log.entries.push({
            timestamp: lastMonth.toISOString(),
            agentId: 'agent-2',
            projectNumber: 1,
            inputTokens: 1000,
            outputTokens: 500,
            model: 'sonnet',
            costUSD: 0.0105,
        });
        fs.writeFileSync(costLogPath, JSON.stringify(log, null, 2));

        const monthlySpend = await getMonthlySpend();

        // Should only count this month's entry
        assert.strictEqual(monthlySpend, 0.0105);
    });

    test('getProjectSpend filters by project number', async () => {
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 42);
        await logApiUsage('agent-2', { inputTokens: 2000, outputTokens: 1000, model: 'sonnet' }, 42);
        await logApiUsage('agent-3', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 99);

        const project42Spend = await getProjectSpend(42);
        const project99Spend = await getProjectSpend(99);

        assert.strictEqual(project42Spend, 0.0315); // Sum of first two entries
        assert.strictEqual(project99Spend, 0.0105); // Third entry only
    });

    test('getAgentSpend filters by agent ID', async () => {
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);
        await logApiUsage('agent-1', { inputTokens: 2000, outputTokens: 1000, model: 'sonnet' }, 2);
        await logApiUsage('agent-2', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        const agent1Spend = await getAgentSpend('agent-1');
        const agent2Spend = await getAgentSpend('agent-2');

        assert.strictEqual(agent1Spend, 0.0315); // Sum of first two entries
        assert.strictEqual(agent2Spend, 0.0105); // Third entry only
    });

    test('checkBudget returns correct status - within budget', async () => {
        // Default budget: $50 daily, $500 monthly (from agent-config.ts)
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        const status = await checkBudget();

        assert.strictEqual(status.dailySpend, 0.0105);
        assert.strictEqual(status.withinBudget, true);
        assert.ok(status.dailyRemaining > 0);
        assert.ok(status.monthlyRemaining > 0);
    });

    test('checkBudget calculates percentages correctly', async () => {
        // Log $25 worth (50% of $50 daily budget)
        // Need ~2.38M input + 1.19M output tokens for Sonnet to reach $25
        const inputTokens = 2_380_952; // $7.14
        const outputTokens = 1_190_476; // $17.86
        // Total: $25

        await logApiUsage('agent-1', { inputTokens, outputTokens, model: 'sonnet' }, 1);

        const status = await checkBudget();

        // Should be exactly 50% of daily budget
        assert.ok(Math.abs(status.dailyPercentUsed - 50) < 1, `Expected ~50%, got ${status.dailyPercentUsed}%`);
    });

    test('getBudgetAlertLevel returns ok when under 50%', async () => {
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        const alertLevel = await getBudgetAlertLevel();

        assert.strictEqual(alertLevel, 'ok');
    });

    test('AC-2.4.b: Alert level warning50 at 50% threshold', async () => {
        // Log exactly 50% of budget ($25 of $50)
        const inputTokens = 2_380_952;
        const outputTokens = 1_190_476;

        await logApiUsage('agent-1', { inputTokens, outputTokens, model: 'sonnet' }, 1);

        const alertLevel = await getBudgetAlertLevel();

        assert.strictEqual(alertLevel, 'warning50');
    });

    test('Alert level warning75 at 75% threshold', async () => {
        // Log 75% of budget ($37.50 of $50)
        const inputTokens = 3_571_428; // $10.71
        const outputTokens = 1_785_714; // $26.79
        // Total: $37.50

        await logApiUsage('agent-1', { inputTokens, outputTokens, model: 'sonnet' }, 1);

        const alertLevel = await getBudgetAlertLevel();

        assert.strictEqual(alertLevel, 'warning75');
    });

    test('AC-2.4.c: Alert level warning90 at 90% threshold', async () => {
        // Log 90% of budget ($45 of $50)
        const inputTokens = 4_285_714; // $12.86
        const outputTokens = 2_142_857; // $32.14
        // Total: $45

        await logApiUsage('agent-1', { inputTokens, outputTokens, model: 'sonnet' }, 1);

        const alertLevel = await getBudgetAlertLevel();

        assert.strictEqual(alertLevel, 'warning90');
    });

    test('AC-2.4.d: Alert level exceeded at 100% threshold', async () => {
        // Log exactly 100% of budget ($50 of $50)
        const inputTokens = 4_761_904; // $14.29
        const outputTokens = 2_380_952; // $35.71
        // Total: $50

        await logApiUsage('agent-1', { inputTokens, outputTokens, model: 'sonnet' }, 1);

        const alertLevel = await getBudgetAlertLevel();

        assert.strictEqual(alertLevel, 'exceeded');
    });

    test('Alert level exceeded when over budget', async () => {
        // Log 110% of budget ($55 of $50)
        const inputTokens = 5_238_095; // $15.71
        const outputTokens = 2_619_047; // $39.29
        // Total: $55

        await logApiUsage('agent-1', { inputTokens, outputTokens, model: 'sonnet' }, 1);

        const alertLevel = await getBudgetAlertLevel();

        assert.strictEqual(alertLevel, 'exceeded');
    });

    test('Atomic file writes - concurrent writes do not corrupt log', async () => {
        // Simulate concurrent writes
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(
                logApiUsage(`agent-${i}`, { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, i)
            );
        }

        await Promise.all(promises);

        // Verify log is valid JSON and has all entries
        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        assert.strictEqual(log.entries.length, 10);
    });

    test('AC-2.4.e: Fallback cost on calculation failure', async () => {
        // Corrupt the cost log to trigger error handling
        fs.writeFileSync(costLogPath, 'invalid json');

        // This should not throw, but use fallback cost
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        // Log should be recovered with fallback entry
        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        assert.strictEqual(log.entries.length, 1);
        assert.strictEqual(log.entries[0].costUSD, 0.50); // Fallback cost
    });

    test('clearCostLog removes all entries', () => {
        // Add some entries first
        const log = {
            entries: [
                {
                    timestamp: new Date().toISOString(),
                    agentId: 'agent-1',
                    projectNumber: 1,
                    inputTokens: 1000,
                    outputTokens: 500,
                    model: 'sonnet' as const,
                    costUSD: 0.0105,
                },
            ],
        };
        fs.writeFileSync(costLogPath, JSON.stringify(log));

        clearCostLog();

        const clearedLog = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        assert.deepStrictEqual(clearedLog, { entries: [] });
    });

    test('Cost entry contains all required fields', async () => {
        const usage: TokenUsage = {
            inputTokens: 1000,
            outputTokens: 500,
            model: 'sonnet',
        };

        await logApiUsage('test-agent', usage, 42);

        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const entry = log.entries[0];

        assert.ok(entry.timestamp);
        assert.strictEqual(entry.agentId, 'test-agent');
        assert.strictEqual(entry.projectNumber, 42);
        assert.strictEqual(entry.inputTokens, 1000);
        assert.strictEqual(entry.outputTokens, 500);
        assert.strictEqual(entry.model, 'sonnet');
        assert.strictEqual(typeof entry.costUSD, 'number');
    });

    test('Timestamp is in ISO8601 format', async () => {
        await logApiUsage('agent-1', { inputTokens: 1000, outputTokens: 500, model: 'sonnet' }, 1);

        const log = JSON.parse(fs.readFileSync(costLogPath, 'utf-8'));
        const entry = log.entries[0];

        // Should be valid ISO8601 date
        const date = new Date(entry.timestamp);
        assert.ok(!isNaN(date.getTime()), 'Timestamp should be valid ISO8601');
    });
});
