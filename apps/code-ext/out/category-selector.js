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
exports.getNextCategory = getNextCategory;
exports.markCategoryUsed = markCategoryUsed;
exports.markCategoryExhausted = markCategoryExhausted;
exports.resetCategoryExhaustion = resetCategoryExhaustion;
exports.cleanupExpiredExhaustions = cleanupExpiredExhaustions;
exports.getCategoryUsageStats = getCategoryUsageStats;
exports.initializeUsageData = initializeUsageData;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const category_prompt_manager_1 = require("./category-prompt-manager");
/**
 * Configuration constants
 */
const EXHAUSTION_EXPIRY_DAYS = 7;
const USAGE_FILE_NAME = 'category-usage.json';
/**
 * Get the absolute path to the category usage tracking file
 * @returns Absolute path to .claude-sessions/category-usage.json
 */
function getUsageFilePath() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
        throw new Error('Could not determine home directory');
    }
    const claudeSessionsDir = path.join(homeDir, '.claude-sessions');
    return path.join(claudeSessionsDir, USAGE_FILE_NAME);
}
/**
 * Ensure the .claude-sessions directory exists
 */
async function ensureSessionsDirectory() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
        throw new Error('Could not determine home directory');
    }
    const claudeSessionsDir = path.join(homeDir, '.claude-sessions');
    try {
        await fs.promises.mkdir(claudeSessionsDir, { recursive: true });
    }
    catch (err) {
        if (err.code !== 'EEXIST') {
            throw new Error(`Failed to create .claude-sessions directory: ${err.message}`);
        }
    }
}
/**
 * Load category usage data from disk with atomic read
 * @returns Promise resolving to usage data map
 */
async function loadUsageData() {
    await ensureSessionsDirectory();
    const usageFilePath = getUsageFilePath();
    try {
        const data = await fs.promises.readFile(usageFilePath, 'utf8');
        return JSON.parse(data);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            // File doesn't exist yet, return empty data
            return {};
        }
        throw new Error(`Failed to load category usage data: ${err.message}`);
    }
}
/**
 * Save category usage data to disk with atomic write
 * @param data - Usage data to save
 */
async function saveUsageData(data) {
    await ensureSessionsDirectory();
    const usageFilePath = getUsageFilePath();
    const tempFilePath = `${usageFilePath}.tmp`;
    try {
        // Write to temp file first
        await fs.promises.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
        // Atomic rename
        await fs.promises.rename(tempFilePath, usageFilePath);
    }
    catch (err) {
        // Clean up temp file if it exists
        try {
            await fs.promises.unlink(tempFilePath);
        }
        catch {
            // Ignore cleanup errors
        }
        throw new Error(`Failed to save category usage data: ${err.message}`);
    }
}
/**
 * Check if a category exhaustion has expired (older than 7 days)
 * @param noIdeaAt - ISO8601 timestamp when category was exhausted
 * @returns true if exhaustion has expired
 */
function isExhaustionExpired(noIdeaAt) {
    if (!noIdeaAt) {
        return true;
    }
    const exhaustedDate = new Date(noIdeaAt);
    const now = new Date();
    const daysDiff = (now.getTime() - exhaustedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff >= EXHAUSTION_EXPIRY_DAYS;
}
/**
 * Get list of available categories (enabled and not exhausted)
 * @returns Promise resolving to array of available category names
 */
async function getAvailableCategories() {
    const enabledCategories = (0, category_prompt_manager_1.getEnabledCategories)();
    const usageData = await loadUsageData();
    return enabledCategories.filter((category) => {
        const usage = usageData[category];
        if (!usage) {
            return true; // Never used, available
        }
        // Check if exhaustion has expired
        if (usage.noIdeaAt) {
            return isExhaustionExpired(usage.noIdeaAt);
        }
        return true; // Not exhausted
    });
}
/**
 * Get the next category to use based on LRU strategy
 * Falls back to round-robin when timestamps are equal
 * @returns Promise resolving to category name, or null if all categories exhausted
 */
async function getNextCategory() {
    const availableCategories = await getAvailableCategories();
    if (availableCategories.length === 0) {
        return null; // All categories exhausted
    }
    const usageData = await loadUsageData();
    // Find the least recently used category
    let selectedCategory = availableCategories[0];
    let oldestTimestamp = null;
    for (const category of availableCategories) {
        const usage = usageData[category];
        if (!usage || !usage.lastUsedAt) {
            // Never used - highest priority
            return category;
        }
        const lastUsed = new Date(usage.lastUsedAt);
        if (oldestTimestamp === null || lastUsed < oldestTimestamp) {
            oldestTimestamp = lastUsed;
            selectedCategory = category;
        }
    }
    return selectedCategory;
}
/**
 * Mark a category as used, updating the last used timestamp
 * @param category - Category name to mark as used
 */
async function markCategoryUsed(category) {
    const usageData = await loadUsageData();
    if (!usageData[category]) {
        usageData[category] = {
            projectsGenerated: 0,
            lastUsedAt: undefined,
            noIdeaAt: undefined,
        };
    }
    usageData[category].lastUsedAt = new Date().toISOString();
    usageData[category].projectsGenerated = (usageData[category].projectsGenerated || 0) + 1;
    // Clear exhaustion flag if it was set (category has recovered)
    if (usageData[category].noIdeaAt) {
        delete usageData[category].noIdeaAt;
    }
    await saveUsageData(usageData);
}
/**
 * Mark a category as exhausted (returned "NO_IDEA_AVAILABLE")
 * @param category - Category name to mark as exhausted
 */
async function markCategoryExhausted(category) {
    const usageData = await loadUsageData();
    if (!usageData[category]) {
        usageData[category] = {
            projectsGenerated: 0,
            lastUsedAt: undefined,
            noIdeaAt: undefined,
        };
    }
    usageData[category].noIdeaAt = new Date().toISOString();
    await saveUsageData(usageData);
}
/**
 * Reset exhaustion flag for a specific category
 * Useful for manual recovery or after 7-day expiration
 * @param category - Category name to reset
 */
async function resetCategoryExhaustion(category) {
    const usageData = await loadUsageData();
    if (usageData[category] && usageData[category].noIdeaAt) {
        delete usageData[category].noIdeaAt;
        await saveUsageData(usageData);
    }
}
/**
 * Clean up expired exhaustions (older than 7 days)
 * Should be called periodically to auto-recover categories
 */
async function cleanupExpiredExhaustions() {
    const usageData = await loadUsageData();
    let modified = false;
    for (const category in usageData) {
        if (usageData[category].noIdeaAt) {
            if (isExhaustionExpired(usageData[category].noIdeaAt || null)) {
                delete usageData[category].noIdeaAt;
                modified = true;
            }
        }
    }
    if (modified) {
        await saveUsageData(usageData);
    }
}
/**
 * Get comprehensive category usage statistics
 * @returns Promise resolving to usage statistics
 */
async function getCategoryUsageStats() {
    const allCategories = (0, category_prompt_manager_1.getAllCategories)();
    const enabledCategories = (0, category_prompt_manager_1.getEnabledCategories)();
    const usageData = await loadUsageData();
    const categories = allCategories.map((category) => {
        const usage = usageData[category];
        return {
            category,
            lastUsedAt: usage?.lastUsedAt || null,
            projectsGenerated: usage?.projectsGenerated || 0,
            noIdeaAt: usage?.noIdeaAt || null,
        };
    });
    // Count exhausted categories (only among enabled ones)
    const exhaustedCount = enabledCategories.filter((category) => {
        const usage = usageData[category];
        return usage?.noIdeaAt && !isExhaustionExpired(usage.noIdeaAt);
    }).length;
    return {
        categories,
        enabledCount: enabledCategories.length,
        availableCount: enabledCategories.length - exhaustedCount,
        exhaustedCount,
    };
}
/**
 * Initialize usage data for all categories (for testing/setup)
 * Does not overwrite existing data
 */
async function initializeUsageData() {
    const usageData = await loadUsageData();
    const allCategories = (0, category_prompt_manager_1.getAllCategories)();
    let modified = false;
    for (const category of allCategories) {
        if (!usageData[category]) {
            usageData[category] = {
                projectsGenerated: 0,
                lastUsedAt: undefined,
                noIdeaAt: undefined,
            };
            modified = true;
        }
    }
    if (modified) {
        await saveUsageData(usageData);
    }
}
//# sourceMappingURL=category-selector.js.map