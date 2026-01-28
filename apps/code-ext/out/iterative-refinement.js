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
exports.IterativeRefinementManager = void 0;
exports.initializeIterativeRefinement = initializeIterativeRefinement;
exports.getIterativeRefinementManager = getIterativeRefinementManager;
exports.cleanupIterativeRefinement = cleanupIterativeRefinement;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const review_queue_manager_1 = require("./review-queue-manager");
/**
 * Iterative Refinement Manager
 *
 * Manages the feedback loop between review agent and execution agent.
 * Supports maximum 3 review cycles before escalating to user.
 *
 * AC-3.5.a: When review agent rejects project → feedback is formatted for issue within 30 seconds
 * AC-3.5.b: When feedback is written → issue is re-enqueued with status "in_progress" and cycle count increments
 * AC-3.5.c: When execution agent picks up re-opened issue → latest review feedback is included in context
 * AC-3.5.d: When project is rejected for 3rd time → user is notified and issue is labeled `review-escalation`
 * AC-3.5.e: When escalation occurs → summary includes both review agent and execution agent perspectives
 * AC-3.5.f: When review cycle count is tracked → state persists across sessions
 */
class IterativeRefinementManager {
    SESSIONS_DIR = '.claude-sessions';
    CYCLES_FILE = 'review-cycles.json';
    MAX_CYCLES = 3;
    workspaceRoot;
    reviewQueueManager;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.reviewQueueManager = new review_queue_manager_1.ReviewQueueManager(workspaceRoot);
    }
    /**
     * Get the full path to the sessions directory
     */
    getSessionsDirectory() {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
    }
    /**
     * Get the full path to the review cycles file
     */
    getCyclesFilePath() {
        return path.join(this.getSessionsDirectory(), this.CYCLES_FILE);
    }
    /**
     * Ensure the sessions directory exists
     */
    ensureSessionsDirectory() {
        const sessionsPath = this.getSessionsDirectory();
        if (!fs.existsSync(sessionsPath)) {
            fs.mkdirSync(sessionsPath, { recursive: true });
        }
    }
    /**
     * Read review cycles file atomically
     * Returns empty object if file doesn't exist
     */
    readCyclesFile() {
        const filePath = this.getCyclesFilePath();
        if (!fs.existsSync(filePath)) {
            return {};
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            // Validate structure
            if (typeof parsed !== 'object' || parsed === null) {
                console.error('[IterativeRefinement] Invalid cycles file structure, resetting');
                return {};
            }
            return parsed;
        }
        catch (error) {
            console.error('[IterativeRefinement] Error reading cycles file:', error);
            return {};
        }
    }
    /**
     * Write review cycles file atomically using temp file + rename pattern
     */
    writeCyclesFileAtomic(storage) {
        this.ensureSessionsDirectory();
        const filePath = this.getCyclesFilePath();
        const tempPath = `${filePath}.tmp`;
        const content = JSON.stringify(storage, null, 2);
        // Write to temp file
        fs.writeFileSync(tempPath, content, 'utf-8');
        // Atomically rename temp file to target file
        fs.renameSync(tempPath, filePath);
    }
    /**
     * Get review cycle count for an issue
     *
     * @param issueNumber - GitHub issue number
     * @returns Current cycle count (0 if no cycles yet)
     */
    async getReviewCycleCount(issueNumber) {
        const storage = this.readCyclesFile();
        const state = storage[issueNumber];
        if (!state) {
            return 0;
        }
        console.log(`[IterativeRefinement] Issue ${issueNumber} has ${state.cycleCount} review cycle(s)`);
        return state.cycleCount;
    }
    /**
     * Increment review cycle for an issue
     *
     * @param issueNumber - GitHub issue number
     * @param projectNumber - GitHub project number
     * @returns New cycle count
     */
    async incrementReviewCycle(issueNumber, projectNumber) {
        const storage = this.readCyclesFile();
        let state = storage[issueNumber];
        if (!state) {
            // Initialize new state
            state = {
                issueNumber,
                projectNumber,
                cycleCount: 0,
                history: [],
                lastUpdated: new Date().toISOString()
            };
        }
        state.cycleCount += 1;
        state.lastUpdated = new Date().toISOString();
        storage[issueNumber] = state;
        this.writeCyclesFileAtomic(storage);
        console.log(`[IterativeRefinement] Incremented review cycle for issue ${issueNumber} to ${state.cycleCount}`);
        return state.cycleCount;
    }
    /**
     * Add review history entry for an issue
     *
     * @param issueNumber - GitHub issue number
     * @param entry - Review history entry to add
     */
    async addHistoryEntry(issueNumber, entry) {
        const storage = this.readCyclesFile();
        const state = storage[issueNumber];
        if (!state) {
            console.error(`[IterativeRefinement] Cannot add history entry: no state for issue ${issueNumber}`);
            return;
        }
        state.history.push(entry);
        state.lastUpdated = new Date().toISOString();
        storage[issueNumber] = state;
        this.writeCyclesFileAtomic(storage);
        console.log(`[IterativeRefinement] Added history entry for issue ${issueNumber}, cycle ${entry.cycleNumber}`);
    }
    /**
     * Get review history for an issue
     *
     * @param issueNumber - GitHub issue number
     * @returns Array of review history entries
     */
    async getReviewHistory(issueNumber) {
        const storage = this.readCyclesFile();
        const state = storage[issueNumber];
        if (!state) {
            return [];
        }
        return state.history;
    }
    /**
     * Check if issue should be escalated (reached max cycles)
     *
     * AC-3.5.d: When project is rejected for 3rd time → user is notified and issue is labeled `review-escalation`
     *
     * @param issueNumber - GitHub issue number
     * @returns True if should escalate, false otherwise
     */
    async shouldEscalate(issueNumber) {
        const cycleCount = await this.getReviewCycleCount(issueNumber);
        const shouldEsc = cycleCount >= this.MAX_CYCLES;
        if (shouldEsc) {
            console.log(`[IterativeRefinement] Issue ${issueNumber} reached max cycles (${this.MAX_CYCLES}), should escalate`);
        }
        return shouldEsc;
    }
    /**
     * Format feedback comment for GitHub issue
     *
     * AC-3.5.a: When review agent rejects project → feedback is formatted for issue within 30 seconds
     *
     * @param feedback - Review feedback data
     * @param cycleNumber - Current cycle number
     * @returns Formatted markdown comment
     */
    formatFeedbackComment(feedback, cycleNumber) {
        const lines = [];
        lines.push(`## Review Feedback - Cycle ${cycleNumber}/${this.MAX_CYCLES}`);
        lines.push('');
        lines.push('**Status:** REJECTED');
        lines.push('');
        // Unmet criteria section
        if (feedback.unmetCriteria.length > 0) {
            lines.push('**Issues Found:**');
            for (const criterion of feedback.unmetCriteria) {
                lines.push(`- ${criterion.criterion}: ${criterion.reason}`);
            }
            lines.push('');
        }
        // Quality issues section
        if (feedback.qualityIssues.length > 0) {
            lines.push('**Code Quality Issues:**');
            for (const issue of feedback.qualityIssues) {
                lines.push(`- ${issue.category}: ${issue.issue}`);
            }
            lines.push('');
        }
        // Requested changes section
        if (feedback.requestedChanges.length > 0) {
            lines.push('**Requested Changes:**');
            feedback.requestedChanges.forEach((change, index) => {
                lines.push(`${index + 1}. ${change}`);
            });
            lines.push('');
        }
        // Next steps
        if (cycleNumber < this.MAX_CYCLES) {
            lines.push('**Next Steps:**');
            lines.push('Please address the issues above and re-submit for review.');
        }
        else {
            lines.push('**Escalation Notice:**');
            lines.push(`This issue has reached the maximum review cycles (${this.MAX_CYCLES}). Manual review required.`);
            lines.push('A project maintainer will review this issue and provide guidance.');
        }
        const comment = lines.join('\n');
        console.log(`[IterativeRefinement] Formatted feedback comment (${comment.length} chars)`);
        return comment;
    }
    /**
     * Handle review rejection
     *
     * Processes a review rejection by:
     * 1. Incrementing cycle count
     * 2. Recording history
     * 3. Formatting feedback
     * 4. Posting comment to GitHub
     * 5. Re-enqueuing issue or escalating
     *
     * AC-3.5.a: When review agent rejects project → feedback is formatted for issue within 30 seconds
     * AC-3.5.b: When feedback is written → issue is re-enqueued with status "in_progress" and cycle count increments
     *
     * @param reviewId - UUID of the review
     * @param feedback - Review feedback data
     */
    async handleReviewRejection(reviewId, feedback) {
        console.log(`[IterativeRefinement] Handling rejection for review ${reviewId}, issue ${feedback.issueNumber}`);
        const startTime = Date.now();
        try {
            // Get review item to get project number
            const review = await this.reviewQueueManager.getReviewById(reviewId);
            if (!review) {
                throw new Error(`Review ${reviewId} not found`);
            }
            // Increment cycle count
            const newCycleCount = await this.incrementReviewCycle(feedback.issueNumber, review.projectNumber);
            // Create history entry
            const historyEntry = {
                cycleNumber: newCycleCount,
                reviewId,
                reviewedAt: new Date().toISOString(),
                status: 'rejected',
                feedback
            };
            await this.addHistoryEntry(feedback.issueNumber, historyEntry);
            // Format feedback comment
            const comment = this.formatFeedbackComment(feedback, newCycleCount);
            const elapsedTime = Date.now() - startTime;
            console.log(`[IterativeRefinement] Formatted feedback in ${elapsedTime}ms (AC-3.5.a)`);
            // Post comment to GitHub (would be implemented with GitHub API)
            // For now, write to file for testing
            await this.writeReviewFeedbackFile(feedback.issueNumber, comment);
            // Check if should escalate
            if (await this.shouldEscalate(feedback.issueNumber)) {
                // Escalate to user
                const history = await this.getReviewHistory(feedback.issueNumber);
                await this.escalateToUser(feedback.issueNumber, history);
            }
            else {
                // Re-enqueue for another attempt
                await this.reenqueueIssue(review);
            }
            console.log(`[IterativeRefinement] Completed rejection handling in ${Date.now() - startTime}ms`);
        }
        catch (error) {
            console.error('[IterativeRefinement] Error handling review rejection:', error);
            throw error;
        }
    }
    /**
     * Write review feedback to file (for testing and reference)
     *
     * @param issueNumber - GitHub issue number
     * @param comment - Formatted feedback comment
     */
    async writeReviewFeedbackFile(issueNumber, comment) {
        this.ensureSessionsDirectory();
        const feedbackPath = path.join(this.getSessionsDirectory(), `issue-${issueNumber}-feedback.md`);
        fs.writeFileSync(feedbackPath, comment, 'utf-8');
        console.log(`[IterativeRefinement] Wrote feedback to file: ${feedbackPath}`);
    }
    /**
     * Re-enqueue issue for another execution attempt
     *
     * AC-3.5.b: When feedback is written → issue is re-enqueued with status "in_progress" and cycle count increments
     *
     * @param review - Original review item
     */
    async reenqueueIssue(review) {
        console.log(`[IterativeRefinement] Re-enqueuing issue ${review.issueNumber} for refinement`);
        // Release the review claim (set back to pending would allow re-claiming, but we want to mark as rejected)
        await this.reviewQueueManager.updateReviewStatus(review.reviewId, 'rejected');
        // In a real implementation, this would update the GitHub issue status to "in_progress"
        // and notify the execution agent to pick it up again
        // For now, we log the action
        console.log(`[IterativeRefinement] Issue ${review.issueNumber} re-enqueued with updated cycle count`);
    }
    /**
     * Escalate issue to user after max cycles
     *
     * AC-3.5.d: When project is rejected for 3rd time → user is notified and issue is labeled `review-escalation`
     * AC-3.5.e: When escalation occurs → summary includes both review agent and execution agent perspectives
     *
     * @param issueNumber - GitHub issue number
     * @param reviewHistory - Full review history for the issue
     */
    async escalateToUser(issueNumber, reviewHistory) {
        console.log(`[IterativeRefinement] Escalating issue ${issueNumber} to user`);
        // Generate escalation summary
        const summary = this.generateEscalationSummary(issueNumber, reviewHistory);
        // Write escalation file
        this.ensureSessionsDirectory();
        const escalationPath = path.join(this.getSessionsDirectory(), `issue-${issueNumber}-escalation.md`);
        fs.writeFileSync(escalationPath, summary, 'utf-8');
        console.log(`[IterativeRefinement] Wrote escalation summary to: ${escalationPath}`);
        // Show VS Code notification
        const message = `Issue #${issueNumber} requires manual review after ${this.MAX_CYCLES} failed review cycles.`;
        const action = await vscode.window.showWarningMessage(message, 'View Summary', 'Dismiss');
        if (action === 'View Summary') {
            const doc = await vscode.workspace.openTextDocument(escalationPath);
            await vscode.window.showTextDocument(doc);
        }
        // In a real implementation, this would:
        // 1. Add "@review-escalation" label to GitHub issue
        // 2. Post escalation summary as a comment
        // 3. Potentially assign to project maintainer
        // 4. Send notification through configured channels
        console.log(`[IterativeRefinement] User notified about escalation for issue ${issueNumber}`);
    }
    /**
     * Generate escalation summary including all review cycles
     *
     * AC-3.5.e: When escalation occurs → summary includes both review agent and execution agent perspectives
     *
     * @param issueNumber - GitHub issue number
     * @param reviewHistory - Full review history
     * @returns Formatted escalation summary
     */
    generateEscalationSummary(issueNumber, reviewHistory) {
        const lines = [];
        lines.push(`# Escalation Summary - Issue #${issueNumber}`);
        lines.push('');
        lines.push(`**Status:** Escalated for Manual Review`);
        lines.push(`**Reason:** Maximum review cycles (${this.MAX_CYCLES}) reached`);
        lines.push(`**Date:** ${new Date().toISOString()}`);
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## Review Cycle History');
        lines.push('');
        if (reviewHistory.length === 0) {
            lines.push('No review history available.');
        }
        else {
            for (const entry of reviewHistory) {
                lines.push(`### Cycle ${entry.cycleNumber} - ${entry.status.toUpperCase()}`);
                lines.push(`**Review ID:** ${entry.reviewId}`);
                lines.push(`**Reviewed At:** ${entry.reviewedAt}`);
                lines.push('');
                if (entry.feedback) {
                    const feedback = entry.feedback;
                    if (feedback.unmetCriteria.length > 0) {
                        lines.push('**Unmet Criteria:**');
                        for (const criterion of feedback.unmetCriteria) {
                            lines.push(`- ${criterion.criterion}`);
                            lines.push(`  - Reason: ${criterion.reason}`);
                        }
                        lines.push('');
                    }
                    if (feedback.qualityIssues.length > 0) {
                        lines.push('**Quality Issues:**');
                        for (const issue of feedback.qualityIssues) {
                            lines.push(`- [${issue.category}] ${issue.issue}`);
                        }
                        lines.push('');
                    }
                    if (feedback.requestedChanges.length > 0) {
                        lines.push('**Requested Changes:**');
                        feedback.requestedChanges.forEach((change, index) => {
                            lines.push(`${index + 1}. ${change}`);
                        });
                        lines.push('');
                    }
                }
                lines.push('---');
                lines.push('');
            }
        }
        lines.push('## Recommended Actions');
        lines.push('');
        lines.push('1. **Manual Code Review:** Review the implementation against acceptance criteria');
        lines.push('2. **Agent Analysis:** Determine if review agent or execution agent has systematic issues');
        lines.push('3. **Criteria Clarity:** Verify acceptance criteria are clear and achievable');
        lines.push('4. **Agent Configuration:** Consider adjusting agent parameters or prompts');
        lines.push('5. **Direct Completion:** If work is acceptable, manually close the issue');
        lines.push('');
        lines.push('## Next Steps');
        lines.push('');
        lines.push('- [ ] Review the implementation code');
        lines.push('- [ ] Assess acceptance criteria clarity');
        lines.push('- [ ] Determine root cause of review failures');
        lines.push('- [ ] Decide on manual completion or agent re-configuration');
        lines.push('- [ ] Document findings for future improvement');
        lines.push('');
        return lines.join('\n');
    }
    /**
     * Get latest review feedback for an issue
     *
     * AC-3.5.c: When execution agent picks up re-opened issue → latest review feedback is included in context
     *
     * @param issueNumber - GitHub issue number
     * @returns Latest review feedback or null if no rejections
     */
    async getLatestReviewFeedback(issueNumber) {
        const history = await this.getReviewHistory(issueNumber);
        if (history.length === 0) {
            return null;
        }
        // Get the most recent entry
        const latestEntry = history[history.length - 1];
        if (!latestEntry.feedback) {
            return null;
        }
        console.log(`[IterativeRefinement] Retrieved latest feedback for issue ${issueNumber} (cycle ${latestEntry.cycleNumber})`);
        return latestEntry.feedback;
    }
    /**
     * Clear review cycle data for an issue (e.g., when manually completed)
     *
     * @param issueNumber - GitHub issue number
     */
    async clearReviewCycles(issueNumber) {
        const storage = this.readCyclesFile();
        if (storage[issueNumber]) {
            delete storage[issueNumber];
            this.writeCyclesFileAtomic(storage);
            console.log(`[IterativeRefinement] Cleared review cycles for issue ${issueNumber}`);
        }
    }
    /**
     * Get all issues currently in review refinement
     *
     * @returns Array of issue numbers with active review cycles
     */
    async getActiveRefinementIssues() {
        const storage = this.readCyclesFile();
        const issueNumbers = Object.keys(storage).map(key => parseInt(key, 10));
        console.log(`[IterativeRefinement] Found ${issueNumbers.length} issues in refinement`);
        return issueNumbers;
    }
}
exports.IterativeRefinementManager = IterativeRefinementManager;
/**
 * Singleton instance for global access
 */
let refinementManagerInstance = null;
/**
 * Initialize the iterative refinement manager with workspace root
 * Should be called during extension activation
 */
function initializeIterativeRefinement(workspaceRoot) {
    refinementManagerInstance = new IterativeRefinementManager(workspaceRoot);
    return refinementManagerInstance;
}
/**
 * Get the singleton iterative refinement manager instance
 * @throws Error if not initialized
 */
function getIterativeRefinementManager() {
    if (!refinementManagerInstance) {
        throw new Error('IterativeRefinementManager not initialized. Call initializeIterativeRefinement first.');
    }
    return refinementManagerInstance;
}
/**
 * Cleanup and reset the iterative refinement manager
 * Should be called during extension deactivation
 */
function cleanupIterativeRefinement() {
    refinementManagerInstance = null;
}
//# sourceMappingURL=iterative-refinement.js.map