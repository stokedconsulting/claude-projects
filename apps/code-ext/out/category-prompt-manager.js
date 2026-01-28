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
exports.getCategoryPromptPath = getCategoryPromptPath;
exports.getAllCategories = getAllCategories;
exports.isCategoryEnabled = isCategoryEnabled;
exports.loadCategoryPromptTemplate = loadCategoryPromptTemplate;
exports.interpolateCategoryPrompt = interpolateCategoryPrompt;
exports.installCategoryPrompts = installCategoryPrompts;
exports.validateCategoryTemplates = validateCategoryTemplates;
exports.getEnabledCategories = getEnabledCategories;
exports.loadAllEnabledPrompts = loadAllEnabledPrompts;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * All 21 categories for project ideation
 */
const CATEGORIES = [
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
];
/**
 * Get the absolute path to the category prompt template file
 * @param category - The category name
 * @returns Absolute path to the template file
 */
function getCategoryPromptPath(category) {
    const extensionPath = vscode.extensions.getExtension('your-extension-id')?.extensionPath || '';
    return path.join(extensionPath, 'commands', 'category-prompts', `${category}.md`);
}
/**
 * Get list of all available categories
 * @returns Array of all category names
 */
function getAllCategories() {
    return [...CATEGORIES];
}
/**
 * Check if a category is enabled in workspace settings
 * @param category - The category name to check
 * @returns True if enabled, false otherwise
 */
function isCategoryEnabled(category) {
    const config = vscode.workspace.getConfiguration('claudeProjects');
    const disabledCategories = config.get('disabledIdeationCategories', []);
    return !disabledCategories.includes(category);
}
/**
 * Load a category prompt template from disk
 * @param category - The category name
 * @returns Promise resolving to the template content
 * @throws Error if template file doesn't exist or can't be read
 */
async function loadCategoryPromptTemplate(category) {
    const templatePath = getCategoryPromptPath(category);
    return new Promise((resolve, reject) => {
        fs.readFile(templatePath, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    reject(new Error(`Category template not found: ${category}`));
                }
                else {
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
async function interpolateCategoryPrompt(category, context) {
    const template = await loadCategoryPromptTemplate(category);
    // Replace all placeholders with context values
    let interpolated = template;
    interpolated = interpolated.replace(/\{\{owner\}\}/g, context.owner);
    interpolated = interpolated.replace(/\{\{repo\}\}/g, context.repo);
    interpolated = interpolated.replace(/\{\{recentCommits\}\}/g, context.recentCommits.join(', '));
    interpolated = interpolated.replace(/\{\{techStack\}\}/g, context.techStack.join(', '));
    interpolated = interpolated.replace(/\{\{existingIssueCount\}\}/g, context.existingIssueCount.toString());
    return interpolated;
}
/**
 * Install category prompts to ~/.claude/commands/category-prompts/
 * Copies all template files to the Claude commands directory
 * @returns Promise resolving when installation is complete
 */
async function installCategoryPrompts() {
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
        }
        catch (err) {
            console.warn(`Failed to install category prompt ${category}:`, err);
        }
    });
    await Promise.all(copyPromises);
}
/**
 * Validate that all category template files exist
 * @returns Object with validation results
 */
async function validateCategoryTemplates() {
    const missing = [];
    const validationPromises = CATEGORIES.map(async (category) => {
        const templatePath = getCategoryPromptPath(category);
        try {
            await fs.promises.access(templatePath, fs.constants.R_OK);
            return true;
        }
        catch {
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
function getEnabledCategories() {
    return CATEGORIES.filter((category) => isCategoryEnabled(category));
}
/**
 * Load all enabled category templates with interpolation
 * @param context - The ideation context to inject
 * @returns Promise resolving to map of category name to interpolated prompt
 */
async function loadAllEnabledPrompts(context) {
    const enabledCategories = getEnabledCategories();
    const prompts = new Map();
    const loadPromises = enabledCategories.map(async (category) => {
        try {
            const prompt = await interpolateCategoryPrompt(category, context);
            prompts.set(category, prompt);
        }
        catch (err) {
            console.warn(`Skipping category ${category}:`, err);
        }
    });
    await Promise.all(loadPromises);
    return prompts;
}
//# sourceMappingURL=category-prompt-manager.js.map