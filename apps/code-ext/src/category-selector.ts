import * as fs from 'fs';
import * as path from 'path';
import { getAllCategories, getEnabledCategories } from './category-prompt-manager';

/**
 * Interface for tracking category usage
 */
export interface CategoryUsage {
  category: string;
  lastUsedAt: string | null;  // ISO8601 timestamp
  projectsGenerated: number;
  noIdeaAt: string | null;    // ISO8601 timestamp when category was exhausted
}

/**
 * Interface for category usage statistics
 */
export interface CategoryUsageStats {
  categories: CategoryUsage[];
  enabledCount: number;
  availableCount: number;  // enabled - exhausted
  exhaustedCount: number;
}

/**
 * Internal storage format for category usage tracking
 */
interface CategoryUsageStorage {
  [category: string]: {
    lastUsedAt?: string;
    projectsGenerated: number;
    noIdeaAt?: string;
  };
}

/**
 * Configuration constants
 */
const EXHAUSTION_EXPIRY_DAYS = 7;
const USAGE_FILE_NAME = 'category-usage.json';

/**
 * Get the absolute path to the category usage tracking file
 * @returns Absolute path to .claude-sessions/category-usage.json
 */
function getUsageFilePath(): string {
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
async function ensureSessionsDirectory(): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }

  const claudeSessionsDir = path.join(homeDir, '.claude-sessions');

  try {
    await fs.promises.mkdir(claudeSessionsDir, { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      throw new Error(`Failed to create .claude-sessions directory: ${err.message}`);
    }
  }
}

/**
 * Load category usage data from disk with atomic read
 * @returns Promise resolving to usage data map
 */
async function loadUsageData(): Promise<CategoryUsageStorage> {
  await ensureSessionsDirectory();

  const usageFilePath = getUsageFilePath();

  try {
    const data = await fs.promises.readFile(usageFilePath, 'utf8');
    return JSON.parse(data) as CategoryUsageStorage;
  } catch (err: any) {
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
async function saveUsageData(data: CategoryUsageStorage): Promise<void> {
  await ensureSessionsDirectory();

  const usageFilePath = getUsageFilePath();
  const tempFilePath = `${usageFilePath}.tmp`;

  try {
    // Write to temp file first
    await fs.promises.writeFile(
      tempFilePath,
      JSON.stringify(data, null, 2),
      'utf8'
    );

    // Atomic rename
    await fs.promises.rename(tempFilePath, usageFilePath);
  } catch (err: any) {
    // Clean up temp file if it exists
    try {
      await fs.promises.unlink(tempFilePath);
    } catch {
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
function isExhaustionExpired(noIdeaAt: string | null): boolean {
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
async function getAvailableCategories(): Promise<string[]> {
  const enabledCategories = getEnabledCategories();
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
export async function getNextCategory(): Promise<string | null> {
  const availableCategories = await getAvailableCategories();

  if (availableCategories.length === 0) {
    return null; // All categories exhausted
  }

  const usageData = await loadUsageData();

  // Find the least recently used category
  let selectedCategory = availableCategories[0];
  let oldestTimestamp: Date | null = null;

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
export async function markCategoryUsed(category: string): Promise<void> {
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
export async function markCategoryExhausted(category: string): Promise<void> {
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
export async function resetCategoryExhaustion(category: string): Promise<void> {
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
export async function cleanupExpiredExhaustions(): Promise<void> {
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
export async function getCategoryUsageStats(): Promise<CategoryUsageStats> {
  const allCategories = getAllCategories();
  const enabledCategories = getEnabledCategories();
  const usageData = await loadUsageData();

  const categories: CategoryUsage[] = allCategories.map((category) => {
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
export async function initializeUsageData(): Promise<void> {
  const usageData = await loadUsageData();
  const allCategories = getAllCategories();
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
