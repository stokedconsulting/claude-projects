"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeIdeation = executeIdeation;
exports.parseIdeationResponse = parseIdeationResponse;
exports.validateIdea = validateIdea;
exports.checkForDuplicates = checkForDuplicates;
exports.isValidEffortEstimate = isValidEffortEstimate;
const category_prompt_manager_1 = require("./category-prompt-manager");
/**
 * Execute ideation for a given category
 *
 * This function:
 * 1. Loads and interpolates the category prompt
 * 2. Simulates executing Claude Code session (in production, this would actually call Claude)
 * 3. Parses the response
 * 4. Validates the idea
 *
 * @param category - The category to generate ideas for
 * @param context - The ideation context with repo info
 * @param existingIssues - List of existing issue titles for duplicate detection
 * @returns Promise resolving to IdeationResult
 */
async function executeIdeation(category, context, existingIssues = []) {
    try {
        // Step 1: Load and interpolate category prompt
        const prompt = await (0, category_prompt_manager_1.interpolateCategoryPrompt)(category, context);
        if (!prompt) {
            return {
                success: false,
                parseError: `Failed to load prompt for category: ${category}`
            };
        }
        // Step 2: Execute Claude Code session (simulated for now)
        // In production, this would actually call Claude Code via API
        const response = await simulateClaudeResponse(category, prompt);
        // Step 3: Check for NO_IDEA_AVAILABLE response
        if (response.trim() === 'NO_IDEA_AVAILABLE' || response.includes('NO_IDEA_AVAILABLE')) {
            return {
                success: true,
                noIdeaAvailable: true
            };
        }
        // Step 4: Parse the response
        const parsedIdea = parseIdeationResponse(response);
        if (!parsedIdea) {
            return {
                success: false,
                parseError: 'Failed to parse Claude response - missing required sections'
            };
        }
        // Add category to parsed idea
        parsedIdea.category = category;
        // Step 5: Validate the idea
        const validationResult = await validateIdea(parsedIdea, existingIssues);
        if (!validationResult.valid) {
            return {
                success: false,
                validationError: validationResult.error
            };
        }
        // Success!
        return {
            success: true,
            idea: parsedIdea
        };
    }
    catch (error) {
        return {
            success: false,
            parseError: `Ideation execution failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
/**
 * Simulate Claude response for testing
 * In production, this would be replaced with actual Claude Code API call
 */
async function simulateClaudeResponse(category, prompt) {
    // For now, return a mock response
    // In production, this would call the Claude Code API
    return `
**Title:** Implement rate limiting for API endpoints

**Description:** Add Redis-based rate limiting to prevent API abuse and ensure fair usage across all clients. This will protect the service from DDoS attacks and ensure system stability.

**Acceptance Criteria:**
- AC-1: Rate limiting middleware is applied to all public API endpoints
- AC-2: Redis is used for distributed rate limit tracking
- AC-3: Rate limit headers (X-RateLimit-*) are returned in all responses
- AC-4: Custom rate limits can be configured per endpoint
- AC-5: Unit tests verify rate limiting behavior

**Technical Approach:**
Implement using express-rate-limit with Redis store. Configure different rate limits for authenticated vs unauthenticated requests. Add middleware to all routes and implement custom error responses for rate limit exceeded.

**Estimated Effort:** 4 hours
`;
}
/**
 * Parse Claude's ideation response into structured data
 *
 * Expected format:
 * **Title:** <title>
 * **Description:** <description>
 * **Acceptance Criteria:**
 * - AC-1: <criterion>
 * - AC-2: <criterion>
 * **Technical Approach:** <approach>
 * **Estimated Effort:** <hours> hours
 *
 * @param response - Raw response from Claude
 * @returns ParsedIdea or null if parsing fails
 */
function parseIdeationResponse(response) {
    try {
        const lines = response.split('\n').map(line => line.trim());
        // Extract title
        const titleMatch = response.match(/\*\*Title:\*\*\s*(.+)/);
        if (!titleMatch) {
            return null;
        }
        const title = titleMatch[1].trim();
        // Extract description
        const descMatch = response.match(/\*\*Description:\*\*\s*([^\*]+)/s);
        if (!descMatch) {
            return null;
        }
        const description = descMatch[1].trim();
        // Extract acceptance criteria
        const acceptanceCriteria = [];
        const acSection = response.match(/\*\*Acceptance Criteria:\*\*\s*([\s\S]*?)(?:\*\*|$)/);
        if (acSection) {
            const acLines = acSection[1].split('\n');
            for (const line of acLines) {
                const trimmed = line.trim();
                // Match lines starting with "- AC-", "- [ ]", or just "- "
                if (trimmed.match(/^-\s*(AC-\d+:|(\[\s*\]))/)) {
                    acceptanceCriteria.push(trimmed.replace(/^-\s*(AC-\d+:|\[\s*\])\s*/, '').trim());
                }
                else if (trimmed.startsWith('- ') && !trimmed.includes('**')) {
                    acceptanceCriteria.push(trimmed.substring(2).trim());
                }
            }
        }
        if (acceptanceCriteria.length === 0) {
            return null;
        }
        // Extract technical approach
        const techMatch = response.match(/\*\*Technical Approach:\*\*\s*([^\*]+)/s);
        if (!techMatch) {
            return null;
        }
        const technicalApproach = techMatch[1].trim();
        // Extract effort estimate
        const effortMatch = response.match(/\*\*Estimated Effort:\*\*\s*(\d+)\s*hours?/i);
        if (!effortMatch) {
            return null;
        }
        const effortHours = parseInt(effortMatch[1], 10);
        return {
            title,
            description,
            acceptanceCriteria,
            technicalApproach,
            effortHours,
            category: '' // Will be set by caller
        };
    }
    catch (error) {
        console.error('[IdeationExecutor] Parse error:', error);
        return null;
    }
}
/**
 * Validate a parsed idea against business rules
 *
 * Rules:
 * - Title must be present and < 100 characters
 * - Description must be 20-500 characters
 * - At least 3 acceptance criteria required
 * - Effort estimate must be 1-8 hours
 * - No duplicates (title similarity > 80%)
 *
 * @param idea - The parsed idea to validate
 * @param existingIssues - List of existing issue titles
 * @returns ValidationResult
 */
async function validateIdea(idea, existingIssues) {
    // Validate title
    if (!idea.title || idea.title.length === 0) {
        return { valid: false, error: 'Title is required' };
    }
    if (idea.title.length > 100) {
        return { valid: false, error: 'Title must be less than 100 characters' };
    }
    // Validate description
    if (!idea.description || idea.description.length < 20) {
        return { valid: false, error: 'Description must be at least 20 characters' };
    }
    if (idea.description.length > 500) {
        return { valid: false, error: 'Description must be less than 500 characters' };
    }
    // Validate acceptance criteria
    if (idea.acceptanceCriteria.length < 3) {
        return {
            valid: false,
            error: `At least 3 acceptance criteria required (found ${idea.acceptanceCriteria.length})`
        };
    }
    // Validate effort estimate
    if (!isValidEffortEstimate(idea.effortHours)) {
        return {
            valid: false,
            error: `Effort estimate must be between 1-8 hours (got ${idea.effortHours})`
        };
    }
    // Check for duplicates
    const isDuplicate = await checkForDuplicates(idea.title, existingIssues);
    if (isDuplicate) {
        return {
            valid: false,
            error: 'Duplicate idea detected - similar issue already exists'
        };
    }
    return { valid: true };
}
/**
 * Check if a title is a duplicate of existing issues
 * Uses simple string similarity (> 80% match = duplicate)
 *
 * @param title - The title to check
 * @param existingIssues - List of existing issue titles
 * @returns Promise resolving to true if duplicate found
 */
async function checkForDuplicates(title, existingIssues) {
    const normalizedTitle = title.toLowerCase().trim();
    for (const existingTitle of existingIssues) {
        const normalizedExisting = existingTitle.toLowerCase().trim();
        const similarity = calculateStringSimilarity(normalizedTitle, normalizedExisting);
        if (similarity > 0.80) {
            console.log(`[IdeationExecutor] Duplicate detected: "${title}" is ${(similarity * 100).toFixed(1)}% similar to "${existingTitle}"`);
            return true;
        }
    }
    return false;
}
/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns value between 0 (completely different) and 1 (identical)
 */
function calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) {
        return 1.0;
    }
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}
/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}
/**
 * Check if effort estimate is within valid range (1-8 hours)
 *
 * @param hours - Effort estimate in hours
 * @returns True if valid, false otherwise
 */
function isValidEffortEstimate(hours) {
    return hours >= 1 && hours <= 8;
}
//# sourceMappingURL=ideation-executor.js.map