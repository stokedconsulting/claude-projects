import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Context interface for interpolating category prompts
 */
export interface IdeationContext {
  owner: string;
  repo: string;
  recentCommits: string[];
  techStack: string[];
  existingIssueCount: number;
}

/**
 * All 21 categories for project ideation
 */
const CATEGORIES: readonly string[] = [
  'optimization',
  'innovation',
  'architecture',
  'frontend-improvements',
  'backend-improvements',
  'security',
  'testing',
  'documentation',
  'technical-debt',
  'developer-experience',
  'monitoring-observability',
  'devops-infrastructure',
  'accessibility',
  'dependency-management',
  'data-management',
  'internationalization',
  'error-handling-resilience',
  'code-quality',
  'compliance-governance',
  'scalability',
  'api-evolution',
] as const;

export type CategoryName = typeof CATEGORIES[number];

/**
 * Get the absolute path to the category prompt template file
 * @param category - The category name
 * @returns Absolute path to the template file
 */
export function getCategoryPromptPath(category: string): string {
  const extensionPath = vscode.extensions.getExtension('your-extension-id')?.extensionPath || '';
  return path.join(extensionPath, 'commands', 'category-prompts', `${category}.md`);
}

/**
 * Get list of all available categories
 * @returns Array of all category names
 */
export function getAllCategories(): string[] {
  return [...CATEGORIES];
}

/**
 * Check if a category is enabled in workspace settings
 * @param category - The category name to check
 * @returns True if enabled, false otherwise
 */
export function isCategoryEnabled(category: string): boolean {
  const config = vscode.workspace.getConfiguration('claudeProjects');
  const disabledCategories = config.get<string[]>('disabledIdeationCategories', []);
  return !disabledCategories.includes(category);
}

/**
 * Load a category prompt template from disk
 * @param category - The category name
 * @returns Promise resolving to the template content
 * @throws Error if template file doesn't exist or can't be read
 */
export async function loadCategoryPromptTemplate(category: string): Promise<string> {
  const templatePath = getCategoryPromptPath(category);

  return new Promise((resolve, reject) => {
    fs.readFile(templatePath, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          reject(new Error(`Category template not found: ${category}`));
        } else {
          reject(new Error(`Failed to read category template ${category}: ${err.message}`));
        }
        return;
      }
      resolve(data);
    });
  });
}

/**
 * Interpolate a category prompt template with context values
 * @param category - The category name
 * @param context - The ideation context to inject
 * @returns Promise resolving to the interpolated prompt
 */
export async function interpolateCategoryPrompt(
  category: string,
  context: IdeationContext
): Promise<string> {
  const template = await loadCategoryPromptTemplate(category);

  // Replace all placeholders with context values
  let interpolated = template;

  interpolated = interpolated.replace(/\{\{owner\}\}/g, context.owner);
  interpolated = interpolated.replace(/\{\{repo\}\}/g, context.repo);
  interpolated = interpolated.replace(
    /\{\{recentCommits\}\}/g,
    context.recentCommits.join(', ')
  );
  interpolated = interpolated.replace(
    /\{\{techStack\}\}/g,
    context.techStack.join(', ')
  );
  interpolated = interpolated.replace(
    /\{\{existingIssueCount\}\}/g,
    context.existingIssueCount.toString()
  );

  return interpolated;
}

/**
 * Install category prompts to ~/.claude/commands/category-prompts/
 * Copies all template files to the Claude commands directory
 * @returns Promise resolving when installation is complete
 */
export async function installCategoryPrompts(): Promise<void> {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }

  const targetDir = path.join(homeDir, '.claude', 'commands', 'category-prompts');

  // Create target directory if it doesn't exist
  await fs.promises.mkdir(targetDir, { recursive: true });

  const extensionPath = vscode.extensions.getExtension('your-extension-id')?.extensionPath || '';
  const sourceDir = path.join(extensionPath, 'commands', 'category-prompts');

  // Copy all category templates
  const copyPromises = CATEGORIES.map(async (category) => {
    const sourcePath = path.join(sourceDir, `${category}.md`);
    const targetPath = path.join(targetDir, `${category}.md`);

    try {
      await fs.promises.copyFile(sourcePath, targetPath);
    } catch (err) {
      console.warn(`Failed to install category prompt ${category}:`, err);
    }
  });

  await Promise.all(copyPromises);
}

/**
 * Validate that all category template files exist
 * @returns Object with validation results
 */
export async function validateCategoryTemplates(): Promise<{
  valid: boolean;
  missing: string[];
  total: number;
}> {
  const missing: string[] = [];

  const validationPromises = CATEGORIES.map(async (category) => {
    const templatePath = getCategoryPromptPath(category);
    try {
      await fs.promises.access(templatePath, fs.constants.R_OK);
      return true;
    } catch {
      missing.push(category);
      return false;
    }
  });

  await Promise.all(validationPromises);

  return {
    valid: missing.length === 0,
    missing,
    total: CATEGORIES.length,
  };
}

/**
 * Get enabled categories based on workspace settings
 * @returns Array of enabled category names
 */
export function getEnabledCategories(): string[] {
  return CATEGORIES.filter((category) => isCategoryEnabled(category));
}

/**
 * Load all enabled category templates with interpolation
 * @param context - The ideation context to inject
 * @returns Promise resolving to map of category name to interpolated prompt
 */
export async function loadAllEnabledPrompts(
  context: IdeationContext
): Promise<Map<string, string>> {
  const enabledCategories = getEnabledCategories();
  const prompts = new Map<string, string>();

  const loadPromises = enabledCategories.map(async (category) => {
    try {
      const prompt = await interpolateCategoryPrompt(category, context);
      prompts.set(category, prompt);
    } catch (err) {
      console.warn(`Skipping category ${category}:`, err);
    }
  });

  await Promise.all(loadPromises);

  return prompts;
}
