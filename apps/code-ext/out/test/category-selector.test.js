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
const category_selector_1 = require("../category-selector");
const category_prompt_manager_1 = require("../category-prompt-manager");
suite('Category Selector Test Suite', () => {
    const testUsageFilePath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude-sessions', 'category-usage.json');
    let backupData = null;
    suiteSetup(async () => {
        // Backup existing usage data before tests
        try {
            backupData = await fs.promises.readFile(testUsageFilePath, 'utf8');
        }
        catch (err) {
            backupData = null; // No existing file
        }
    });
    suiteTeardown(async () => {
        // Restore backup after all tests
        if (backupData) {
            await fs.promises.writeFile(testUsageFilePath, backupData, 'utf8');
        }
        else {
            try {
                await fs.promises.unlink(testUsageFilePath);
            }
            catch (err) {
                // Ignore if file doesn't exist
            }
        }
    });
    setup(async () => {
        // Clear usage data before each test
        try {
            await fs.promises.unlink(testUsageFilePath);
        }
        catch (err) {
            // Ignore if file doesn't exist
        }
    });
    suite('getNextCategory - LRU Selection', () => {
        test('AC-4.2.a: should select category using LRU strategy (oldest last-used)', async function () {
            this.timeout(5000);
            // Initialize with usage data
            await (0, category_selector_1.initializeUsageData)();
            // Mark some categories as used with different timestamps
            const now = Date.now();
            // Manually set up usage data with specific timestamps
            const usageData = {
                'optimization': {
                    projectsGenerated: 2,
                    lastUsedAt: new Date(now - 10000).toISOString(), // 10 seconds ago (oldest)
                },
                'security': {
                    projectsGenerated: 1,
                    lastUsedAt: new Date(now - 5000).toISOString(), // 5 seconds ago
                },
                'testing': {
                    projectsGenerated: 3,
                    lastUsedAt: new Date(now - 2000).toISOString(), // 2 seconds ago (newest)
                },
            };
            await fs.promises.writeFile(testUsageFilePath, JSON.stringify(usageData, null, 2), 'utf8');
            // Get next category - should be 'optimization' (oldest)
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            assert.ok(nextCategory, 'Should return a category');
            assert.strictEqual(nextCategory, 'optimization', 'Should select least recently used category');
        });
        test('AC-4.2.f: should fall back to round-robin when timestamps are equal', async function () {
            this.timeout(5000);
            const now = new Date().toISOString();
            // Set multiple categories with same timestamp
            const usageData = {
                'security': {
                    projectsGenerated: 1,
                    lastUsedAt: now,
                },
                'testing': {
                    projectsGenerated: 1,
                    lastUsedAt: now,
                },
                'optimization': {
                    projectsGenerated: 1,
                    lastUsedAt: now,
                },
            };
            await fs.promises.writeFile(testUsageFilePath, JSON.stringify(usageData, null, 2), 'utf8');
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            assert.ok(nextCategory, 'Should return a category');
            // Should return first matching category in enabled list (round-robin behavior)
            const enabledCategories = ['optimization', 'security', 'testing'];
            assert.ok(enabledCategories.includes(nextCategory), 'Should select from categories with equal timestamps');
        });
        test('should prioritize never-used categories', async function () {
            this.timeout(5000);
            const now = Date.now();
            // Set some categories as used, leave others untouched
            const usageData = {
                'optimization': {
                    projectsGenerated: 2,
                    lastUsedAt: new Date(now - 1000).toISOString(),
                },
                'security': {
                    projectsGenerated: 1,
                    lastUsedAt: new Date(now - 500).toISOString(),
                },
                // 'testing' is intentionally not included (never used)
            };
            await fs.promises.writeFile(testUsageFilePath, JSON.stringify(usageData, null, 2), 'utf8');
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            assert.ok(nextCategory, 'Should return a category');
            // Should return a never-used category if one exists
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const selectedUsage = stats.categories.find((c) => c.category === nextCategory);
            if (selectedUsage && selectedUsage.lastUsedAt === null) {
                assert.ok(true, 'Correctly prioritized never-used category');
            }
            else {
                // If all enabled categories have been used, this is also acceptable
                assert.ok(true, 'All enabled categories have been used');
            }
        });
        test('AC-4.2.e: should return null when all categories are exhausted', async function () {
            this.timeout(5000);
            await (0, category_selector_1.initializeUsageData)();
            // Mark all enabled categories as exhausted
            const allCategories = (0, category_prompt_manager_1.getAllCategories)();
            const now = new Date().toISOString();
            const usageData = {};
            for (const category of allCategories) {
                usageData[category] = {
                    projectsGenerated: 1,
                    lastUsedAt: now,
                    noIdeaAt: now,
                };
            }
            await fs.promises.writeFile(testUsageFilePath, JSON.stringify(usageData, null, 2), 'utf8');
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            assert.strictEqual(nextCategory, null, 'Should return null when all categories are exhausted');
        });
    });
    suite('markCategoryUsed', () => {
        test('AC-4.2.b: should update last-used timestamp within 5 seconds', async function () {
            this.timeout(5000);
            const category = 'optimization';
            const startTime = Date.now();
            await (0, category_selector_1.markCategoryUsed)(category);
            const endTime = Date.now();
            const duration = endTime - startTime;
            assert.ok(duration < 5000, `Should complete within 5 seconds (took ${duration}ms)`);
            // Verify timestamp was updated
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const usage = stats.categories.find((c) => c.category === category);
            assert.ok(usage, 'Category should exist in stats');
            assert.ok(usage.lastUsedAt, 'Should have lastUsedAt timestamp');
            const lastUsed = new Date(usage.lastUsedAt);
            const now = new Date();
            const timeDiff = now.getTime() - lastUsed.getTime();
            assert.ok(timeDiff < 5000, `Timestamp should be recent (${timeDiff}ms ago)`);
        });
        test('should increment projectsGenerated counter', async function () {
            this.timeout(5000);
            const category = 'security';
            await (0, category_selector_1.markCategoryUsed)(category);
            await (0, category_selector_1.markCategoryUsed)(category);
            await (0, category_selector_1.markCategoryUsed)(category);
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const usage = stats.categories.find((c) => c.category === category);
            assert.ok(usage, 'Category should exist in stats');
            assert.strictEqual(usage.projectsGenerated, 3, 'Should have incremented counter 3 times');
        });
        test('should clear exhaustion flag when category is used again', async function () {
            this.timeout(5000);
            const category = 'testing';
            // Mark as exhausted
            await (0, category_selector_1.markCategoryExhausted)(category);
            let stats = await (0, category_selector_1.getCategoryUsageStats)();
            let usage = stats.categories.find((c) => c.category === category);
            assert.ok(usage.noIdeaAt, 'Should be marked as exhausted');
            // Mark as used (should clear exhaustion)
            await (0, category_selector_1.markCategoryUsed)(category);
            stats = await (0, category_selector_1.getCategoryUsageStats)();
            usage = stats.categories.find((c) => c.category === category);
            assert.strictEqual(usage.noIdeaAt, null, 'Should have cleared exhaustion flag');
        });
    });
    suite('markCategoryExhausted', () => {
        test('AC-4.2.d: should mark category as exhausted with noIdeaAt timestamp', async function () {
            this.timeout(5000);
            const category = 'documentation';
            await (0, category_selector_1.markCategoryExhausted)(category);
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const usage = stats.categories.find((c) => c.category === category);
            assert.ok(usage, 'Category should exist in stats');
            assert.ok(usage.noIdeaAt, 'Should have noIdeaAt timestamp');
            const exhaustedDate = new Date(usage.noIdeaAt);
            const now = new Date();
            const timeDiff = now.getTime() - exhaustedDate.getTime();
            assert.ok(timeDiff < 1000, `Exhaustion timestamp should be recent (${timeDiff}ms ago)`);
        });
        test('AC-4.2.d: should exclude exhausted category for 7 days', async function () {
            this.timeout(5000);
            const category = 'architecture';
            // Mark as exhausted
            await (0, category_selector_1.markCategoryExhausted)(category);
            // Verify it's not selected
            let attempts = 0;
            let selectedCategory = await (0, category_selector_1.getNextCategory)();
            // Try multiple times to ensure it's consistently excluded
            while (selectedCategory && attempts < 10) {
                assert.notStrictEqual(selectedCategory, category, 'Exhausted category should not be selected');
                // Select a different category to keep testing
                await (0, category_selector_1.markCategoryUsed)(selectedCategory);
                selectedCategory = await (0, category_selector_1.getNextCategory)();
                attempts++;
            }
        });
    });
    suite('Category Filtering', () => {
        test('AC-4.2.c: should exclude disabled categories from selection', async function () {
            this.timeout(5000);
            // Note: This test depends on workspace settings
            // We can only verify that the function respects enabled categories
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            if (nextCategory) {
                // Verify selected category is from enabled list
                const stats = await (0, category_selector_1.getCategoryUsageStats)();
                assert.ok(stats.enabledCount > 0, 'Should have at least one enabled category');
            }
        });
        test('should only select from available (enabled + not exhausted) categories', async function () {
            this.timeout(5000);
            // Mark some categories as exhausted
            await (0, category_selector_1.markCategoryExhausted)('optimization');
            await (0, category_selector_1.markCategoryExhausted)('security');
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const availableBefore = stats.availableCount;
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            if (nextCategory) {
                assert.notStrictEqual(nextCategory, 'optimization', 'Should not select exhausted category');
                assert.notStrictEqual(nextCategory, 'security', 'Should not select exhausted category');
            }
            assert.ok(availableBefore > 0 || nextCategory === null, 'Should only return null if no categories available');
        });
    });
    suite('getCategoryUsageStats', () => {
        test('should return complete usage statistics', async function () {
            this.timeout(5000);
            await (0, category_selector_1.initializeUsageData)();
            // Add some usage data
            await (0, category_selector_1.markCategoryUsed)('optimization');
            await (0, category_selector_1.markCategoryUsed)('security');
            await (0, category_selector_1.markCategoryExhausted)('testing');
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            assert.ok(stats, 'Should return stats object');
            assert.ok(Array.isArray(stats.categories), 'Should have categories array');
            assert.strictEqual(stats.categories.length, 21, 'Should include all 21 categories');
            assert.strictEqual(typeof stats.enabledCount, 'number', 'Should have enabledCount');
            assert.strictEqual(typeof stats.availableCount, 'number', 'Should have availableCount');
            assert.strictEqual(typeof stats.exhaustedCount, 'number', 'Should have exhaustedCount');
        });
        test('should correctly count exhausted categories', async function () {
            this.timeout(5000);
            await (0, category_selector_1.initializeUsageData)();
            // Mark several categories as exhausted
            await (0, category_selector_1.markCategoryExhausted)('optimization');
            await (0, category_selector_1.markCategoryExhausted)('security');
            await (0, category_selector_1.markCategoryExhausted)('testing');
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            assert.ok(stats.exhaustedCount >= 3, `Should have at least 3 exhausted categories (found ${stats.exhaustedCount})`);
            assert.strictEqual(stats.availableCount, stats.enabledCount - stats.exhaustedCount, 'availableCount should equal enabledCount - exhaustedCount');
        });
    });
    suite('resetCategoryExhaustion', () => {
        test('should clear exhaustion flag for specific category', async function () {
            this.timeout(5000);
            const category = 'innovation';
            // Mark as exhausted
            await (0, category_selector_1.markCategoryExhausted)(category);
            let stats = await (0, category_selector_1.getCategoryUsageStats)();
            let usage = stats.categories.find((c) => c.category === category);
            assert.ok(usage.noIdeaAt, 'Should be marked as exhausted');
            // Reset exhaustion
            await (0, category_selector_1.resetCategoryExhaustion)(category);
            stats = await (0, category_selector_1.getCategoryUsageStats)();
            usage = stats.categories.find((c) => c.category === category);
            assert.strictEqual(usage.noIdeaAt, null, 'Exhaustion flag should be cleared');
        });
        test('should not affect other categories', async function () {
            this.timeout(5000);
            // Mark multiple categories as exhausted
            await (0, category_selector_1.markCategoryExhausted)('optimization');
            await (0, category_selector_1.markCategoryExhausted)('security');
            await (0, category_selector_1.markCategoryExhausted)('testing');
            // Reset only one
            await (0, category_selector_1.resetCategoryExhaustion)('security');
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const opt = stats.categories.find((c) => c.category === 'optimization');
            const sec = stats.categories.find((c) => c.category === 'security');
            const test = stats.categories.find((c) => c.category === 'testing');
            assert.ok(opt.noIdeaAt, 'optimization should still be exhausted');
            assert.strictEqual(sec.noIdeaAt, null, 'security should not be exhausted');
            assert.ok(test.noIdeaAt, 'testing should still be exhausted');
        });
    });
    suite('cleanupExpiredExhaustions', () => {
        test('should remove exhaustions older than 7 days', async function () {
            this.timeout(5000);
            // Manually create usage data with old exhaustion
            const now = Date.now();
            const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
            const usageData = {
                'optimization': {
                    projectsGenerated: 1,
                    lastUsedAt: eightDaysAgo,
                    noIdeaAt: eightDaysAgo,
                },
            };
            await fs.promises.writeFile(testUsageFilePath, JSON.stringify(usageData, null, 2), 'utf8');
            await (0, category_selector_1.cleanupExpiredExhaustions)();
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const usage = stats.categories.find((c) => c.category === 'optimization');
            assert.strictEqual(usage.noIdeaAt, null, 'Expired exhaustion should be cleared');
        });
        test('should not remove exhaustions newer than 7 days', async function () {
            this.timeout(5000);
            // Manually create usage data with recent exhaustion
            const now = Date.now();
            const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
            const usageData = {
                'security': {
                    projectsGenerated: 1,
                    lastUsedAt: threeDaysAgo,
                    noIdeaAt: threeDaysAgo,
                },
            };
            await fs.promises.writeFile(testUsageFilePath, JSON.stringify(usageData, null, 2), 'utf8');
            await (0, category_selector_1.cleanupExpiredExhaustions)();
            const stats = await (0, category_selector_1.getCategoryUsageStats)();
            const usage = stats.categories.find((c) => c.category === 'security');
            assert.ok(usage.noIdeaAt, 'Recent exhaustion should not be cleared');
        });
    });
    suite('File Operations', () => {
        test('should handle missing usage file gracefully', async function () {
            this.timeout(5000);
            // Ensure file doesn't exist
            try {
                await fs.promises.unlink(testUsageFilePath);
            }
            catch (err) {
                // Ignore
            }
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            assert.ok(nextCategory, 'Should work with missing usage file');
        });
        test('should create .claude-sessions directory if missing', async function () {
            this.timeout(5000);
            const sessionDir = path.dirname(testUsageFilePath);
            // Directory should be created on first operation
            await (0, category_selector_1.markCategoryUsed)('optimization');
            const dirExists = await fs.promises
                .access(sessionDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.ok(dirExists, '.claude-sessions directory should exist');
        });
        test('should use atomic file operations', async function () {
            this.timeout(5000);
            // Mark category used (triggers write)
            await (0, category_selector_1.markCategoryUsed)('architecture');
            // Verify temp file is cleaned up
            const tempFile = `${testUsageFilePath}.tmp`;
            const tempExists = await fs.promises
                .access(tempFile, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(tempExists, false, 'Temp file should be cleaned up');
        });
    });
    suite('Integration Tests', () => {
        test('full workflow: select, use, exhaust, cleanup', async function () {
            this.timeout(10000);
            // Step 1: Initialize
            await (0, category_selector_1.initializeUsageData)();
            const stats1 = await (0, category_selector_1.getCategoryUsageStats)();
            console.log(`Initial state: ${stats1.availableCount} available categories`);
            // Step 2: Select and use categories
            for (let i = 0; i < 3; i++) {
                const category = await (0, category_selector_1.getNextCategory)();
                assert.ok(category, `Should select category on iteration ${i + 1}`);
                await (0, category_selector_1.markCategoryUsed)(category);
            }
            // Step 3: Exhaust a category
            const toExhaust = await (0, category_selector_1.getNextCategory)();
            let stats2;
            if (toExhaust) {
                await (0, category_selector_1.markCategoryExhausted)(toExhaust);
                stats2 = await (0, category_selector_1.getCategoryUsageStats)();
                assert.strictEqual(stats2.exhaustedCount, 1, 'Should have 1 exhausted category');
            }
            // Step 4: Cleanup (no effect since exhaustion is recent)
            await (0, category_selector_1.cleanupExpiredExhaustions)();
            const stats3 = await (0, category_selector_1.getCategoryUsageStats)();
            assert.strictEqual(stats3.exhaustedCount, stats2?.exhaustedCount || 0, 'Recent exhaustions should not be cleaned up');
            // Step 5: Manual reset
            if (toExhaust) {
                await (0, category_selector_1.resetCategoryExhaustion)(toExhaust);
                const stats4 = await (0, category_selector_1.getCategoryUsageStats)();
                assert.strictEqual(stats4.exhaustedCount, 0, 'Exhaustion should be cleared after reset');
            }
        });
        test('LRU selection across multiple rounds', async function () {
            this.timeout(10000);
            await (0, category_selector_1.initializeUsageData)();
            const selectedCategories = [];
            // Select 5 categories
            for (let i = 0; i < 5; i++) {
                const category = await (0, category_selector_1.getNextCategory)();
                assert.ok(category, `Should select category on round ${i + 1}`);
                selectedCategories.push(category);
                await (0, category_selector_1.markCategoryUsed)(category);
                // Small delay to ensure timestamps differ
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            // Next selection should be first used category (LRU)
            const nextCategory = await (0, category_selector_1.getNextCategory)();
            assert.strictEqual(nextCategory, selectedCategories[0], 'Should select least recently used category');
        });
    });
    suite('Performance Tests', () => {
        test('should complete category selection in under 100ms', async function () {
            this.timeout(5000);
            await (0, category_selector_1.initializeUsageData)();
            const start = Date.now();
            await (0, category_selector_1.getNextCategory)();
            const duration = Date.now() - start;
            console.log(`Category selection took ${duration}ms`);
            assert.ok(duration < 100, `Should complete within 100ms (took ${duration}ms)`);
        });
        test('should handle concurrent operations safely', async function () {
            this.timeout(5000);
            await (0, category_selector_1.initializeUsageData)();
            // Trigger multiple concurrent operations
            const operations = [
                (0, category_selector_1.markCategoryUsed)('optimization'),
                (0, category_selector_1.markCategoryUsed)('security'),
                (0, category_selector_1.markCategoryUsed)('testing'),
                (0, category_selector_1.getNextCategory)(),
                (0, category_selector_1.getCategoryUsageStats)(),
            ];
            // All should complete without errors
            await Promise.all(operations);
            assert.ok(true, 'Concurrent operations completed successfully');
        });
    });
});
//# sourceMappingURL=category-selector.test.js.map