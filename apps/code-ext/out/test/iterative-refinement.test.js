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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const iterative_refinement_1 = require("../iterative-refinement");
const review_queue_manager_1 = require("../review-queue-manager");
suite('Iterative Refinement Manager Tests', () => {
    let testWorkspaceRoot;
    let refinementManager;
    let reviewQueueManager;
    setup(() => {
        // Create temporary workspace directory for each test
        testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'iterative-refinement-test-'));
        refinementManager = new iterative_refinement_1.IterativeRefinementManager(testWorkspaceRoot);
        reviewQueueManager = new review_queue_manager_1.ReviewQueueManager(testWorkspaceRoot);
    });
    teardown(() => {
        // Clean up temporary workspace
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
        (0, iterative_refinement_1.cleanupIterativeRefinement)();
    });
    suite('Cycle Count Management', () => {
        test('should return 0 for new issue', async () => {
            const count = await refinementManager.getReviewCycleCount(123);
            assert.strictEqual(count, 0, 'New issue should have 0 cycles');
        });
        test('should increment cycle count', async () => {
            const newCount = await refinementManager.incrementReviewCycle(123, 79);
            assert.strictEqual(newCount, 1, 'First increment should return 1');
            const currentCount = await refinementManager.getReviewCycleCount(123);
            assert.strictEqual(currentCount, 1, 'Cycle count should persist');
        });
        test('should increment cycle count multiple times', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            const count = await refinementManager.incrementReviewCycle(123, 79);
            assert.strictEqual(count, 3, 'Should increment to 3');
        });
        test('should track cycles for multiple issues independently', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(456, 79);
            const count123 = await refinementManager.getReviewCycleCount(123);
            const count456 = await refinementManager.getReviewCycleCount(456);
            assert.strictEqual(count123, 2, 'Issue 123 should have 2 cycles');
            assert.strictEqual(count456, 1, 'Issue 456 should have 1 cycle');
        });
    });
    suite('Escalation Logic', () => {
        test('should not escalate before max cycles', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            const shouldEsc = await refinementManager.shouldEscalate(123);
            assert.strictEqual(shouldEsc, false, 'Should not escalate before cycle 3');
        });
        test('should escalate at max cycles', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            const shouldEsc = await refinementManager.shouldEscalate(123);
            assert.strictEqual(shouldEsc, true, 'Should escalate at cycle 3');
        });
        test('should escalate after max cycles', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            const shouldEsc = await refinementManager.shouldEscalate(123);
            assert.strictEqual(shouldEsc, true, 'Should escalate after cycle 3');
        });
    });
    suite('Feedback Formatting', () => {
        test('should format basic feedback comment - AC-3.5.a', () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [
                    { criterion: 'AC-3.5.a', reason: 'Feedback not formatted correctly' }
                ],
                qualityIssues: [],
                requestedChanges: ['Fix feedback formatting'],
                cycleNumber: 1
            };
            const comment = refinementManager.formatFeedbackComment(feedback, 1);
            assert.ok(comment.includes('Review Feedback - Cycle 1/3'), 'Should include cycle header');
            assert.ok(comment.includes('**Status:** REJECTED'), 'Should include rejection status');
            assert.ok(comment.includes('AC-3.5.a'), 'Should include criterion');
            assert.ok(comment.includes('Fix feedback formatting'), 'Should include requested change');
        });
        test('should include quality issues in feedback', () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [],
                qualityIssues: [
                    { category: 'Tests', issue: 'Coverage below 80%' },
                    { category: 'Linting', issue: 'ESLint errors found' }
                ],
                requestedChanges: [],
                cycleNumber: 2
            };
            const comment = refinementManager.formatFeedbackComment(feedback, 2);
            assert.ok(comment.includes('Code Quality Issues'), 'Should include quality section');
            assert.ok(comment.includes('Tests: Coverage below 80%'), 'Should include test issue');
            assert.ok(comment.includes('Linting: ESLint errors found'), 'Should include linting issue');
        });
        test('should show escalation notice at max cycles', () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [],
                qualityIssues: [],
                requestedChanges: [],
                cycleNumber: 3
            };
            const comment = refinementManager.formatFeedbackComment(feedback, 3);
            assert.ok(comment.includes('Escalation Notice'), 'Should include escalation notice');
            assert.ok(comment.includes('maximum review cycles'), 'Should mention max cycles');
        });
        test('should show next steps before max cycles', () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [],
                qualityIssues: [],
                requestedChanges: [],
                cycleNumber: 1
            };
            const comment = refinementManager.formatFeedbackComment(feedback, 1);
            assert.ok(comment.includes('Next Steps'), 'Should include next steps');
            assert.ok(comment.includes('address the issues'), 'Should mention addressing issues');
        });
        test('should format complete feedback with all sections', () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [
                    { criterion: 'AC-1', reason: 'Not implemented' },
                    { criterion: 'AC-2', reason: 'Incorrect behavior' }
                ],
                qualityIssues: [
                    { category: 'Tests', issue: 'Missing unit tests' },
                    { category: 'Documentation', issue: 'No JSDoc comments' }
                ],
                requestedChanges: [
                    'Add unit tests for new functions',
                    'Add JSDoc comments to public API',
                    'Fix AC-1 implementation'
                ],
                cycleNumber: 2
            };
            const comment = refinementManager.formatFeedbackComment(feedback, 2);
            assert.ok(comment.includes('Issues Found'), 'Should include issues section');
            assert.ok(comment.includes('AC-1'), 'Should include first criterion');
            assert.ok(comment.includes('AC-2'), 'Should include second criterion');
            assert.ok(comment.includes('Code Quality Issues'), 'Should include quality section');
            assert.ok(comment.includes('Requested Changes'), 'Should include changes section');
            assert.ok(comment.includes('1. Add unit tests'), 'Should number changes');
            assert.ok(comment.includes('2. Add JSDoc comments'), 'Should number changes');
        });
    });
    suite('Review History', () => {
        test('should return empty history for new issue', async () => {
            const history = await refinementManager.getReviewHistory(123);
            assert.strictEqual(history.length, 0, 'New issue should have empty history');
        });
        test('should store and retrieve review history - AC-3.5.f', async () => {
            const feedback = {
                reviewId: 'test-review-1',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'Not met' }],
                qualityIssues: [],
                requestedChanges: ['Fix AC-1'],
                cycleNumber: 1
            };
            // Initialize cycle state
            await refinementManager.incrementReviewCycle(123, 79);
            // Simulate review rejection to add history
            const reviewItem = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            const history = await refinementManager.getReviewHistory(123);
            assert.strictEqual(history.length, 1, 'Should have 1 history entry');
            assert.strictEqual(history[0].reviewId, reviewItem.reviewId, 'Should match review ID');
            assert.strictEqual(history[0].status, 'rejected', 'Should be rejected');
        });
        test('should retrieve latest review feedback - AC-3.5.c', async () => {
            const feedback1 = {
                reviewId: 'test-review-1',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'First attempt' }],
                qualityIssues: [],
                requestedChanges: ['Fix 1'],
                cycleNumber: 1
            };
            const feedback2 = {
                reviewId: 'test-review-2',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'Second attempt' }],
                qualityIssues: [],
                requestedChanges: ['Fix 2'],
                cycleNumber: 2
            };
            // Initialize and add first review
            await refinementManager.incrementReviewCycle(123, 79);
            const review1 = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            await refinementManager.handleReviewRejection(review1.reviewId, feedback1);
            // Add second review
            await refinementManager.incrementReviewCycle(123, 79);
            const review2 = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            await refinementManager.handleReviewRejection(review2.reviewId, feedback2);
            const latestFeedback = await refinementManager.getLatestReviewFeedback(123);
            assert.ok(latestFeedback, 'Should have latest feedback');
            assert.strictEqual(latestFeedback.cycleNumber, 2, 'Should be from cycle 2');
            assert.strictEqual(latestFeedback.requestedChanges[0], 'Fix 2', 'Should have latest changes');
        });
        test('should return null for no feedback', async () => {
            const latestFeedback = await refinementManager.getLatestReviewFeedback(999);
            assert.strictEqual(latestFeedback, null, 'Should return null for missing issue');
        });
    });
    suite('Review Rejection Handling', () => {
        test('should handle review rejection and increment cycle - AC-3.5.b', async () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'Not implemented' }],
                qualityIssues: [],
                requestedChanges: ['Implement AC-1'],
                cycleNumber: 1
            };
            // Enqueue a review first
            const reviewItem = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            // Claim the review
            await reviewQueueManager.claimReview(reviewItem.reviewId);
            // Handle rejection
            await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            // Verify cycle was incremented
            const cycleCount = await refinementManager.getReviewCycleCount(123);
            assert.strictEqual(cycleCount, 1, 'Cycle count should be incremented');
            // Verify feedback file was written
            const feedbackPath = path.join(testWorkspaceRoot, '.claude-sessions', 'issue-123-feedback.md');
            assert.ok(fs.existsSync(feedbackPath), 'Feedback file should be created');
        });
        test('should format feedback within 30 seconds - AC-3.5.a', async () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'Not met' }],
                qualityIssues: [],
                requestedChanges: ['Fix AC-1'],
                cycleNumber: 1
            };
            const reviewItem = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            const startTime = Date.now();
            await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            const elapsedTime = Date.now() - startTime;
            assert.ok(elapsedTime < 30000, 'Should complete within 30 seconds');
            assert.ok(elapsedTime < 5000, 'Should typically complete within 5 seconds');
        });
        test('should write feedback file with correct content', async () => {
            const feedback = {
                reviewId: 'test-review-id',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'Not implemented' }],
                qualityIssues: [{ category: 'Tests', issue: 'No tests' }],
                requestedChanges: ['Add tests', 'Implement AC-1'],
                cycleNumber: 1
            };
            const reviewItem = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            const feedbackPath = path.join(testWorkspaceRoot, '.claude-sessions', 'issue-123-feedback.md');
            const content = fs.readFileSync(feedbackPath, 'utf-8');
            assert.ok(content.includes('Review Feedback'), 'Should have header');
            assert.ok(content.includes('AC-1'), 'Should include criterion');
            assert.ok(content.includes('Not implemented'), 'Should include reason');
            assert.ok(content.includes('Tests: No tests'), 'Should include quality issue');
            assert.ok(content.includes('Add tests'), 'Should include requested change');
        });
    });
    suite('Escalation', () => {
        test('should escalate after 3rd rejection - AC-3.5.d', async () => {
            // Perform 3 rejection cycles
            for (let i = 1; i <= 3; i++) {
                const feedback = {
                    reviewId: `test-review-${i}`,
                    issueNumber: 123,
                    unmetCriteria: [{ criterion: `AC-${i}`, reason: `Attempt ${i}` }],
                    qualityIssues: [],
                    requestedChanges: [`Fix attempt ${i}`],
                    cycleNumber: i
                };
                const reviewItem = await reviewQueueManager.enqueueReview({
                    projectNumber: 79,
                    issueNumber: 123,
                    branchName: 'project/79-issue-123',
                    completedByAgentId: 'agent-1'
                });
                await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            }
            // Verify escalation file was created
            const escalationPath = path.join(testWorkspaceRoot, '.claude-sessions', 'issue-123-escalation.md');
            assert.ok(fs.existsSync(escalationPath), 'Escalation file should be created');
            const content = fs.readFileSync(escalationPath, 'utf-8');
            assert.ok(content.includes('Escalation Summary'), 'Should have escalation header');
            assert.ok(content.includes('Maximum review cycles'), 'Should mention max cycles');
        });
        test('should include all review cycles in escalation summary - AC-3.5.e', async () => {
            // Perform 3 rejection cycles with different feedback
            for (let i = 1; i <= 3; i++) {
                const feedback = {
                    reviewId: `test-review-${i}`,
                    issueNumber: 123,
                    unmetCriteria: [{ criterion: `AC-${i}`, reason: `Reason ${i}` }],
                    qualityIssues: [{ category: 'Quality', issue: `Issue ${i}` }],
                    requestedChanges: [`Change ${i}`],
                    cycleNumber: i
                };
                const reviewItem = await reviewQueueManager.enqueueReview({
                    projectNumber: 79,
                    issueNumber: 123,
                    branchName: 'project/79-issue-123',
                    completedByAgentId: 'agent-1'
                });
                await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            }
            const history = await refinementManager.getReviewHistory(123);
            const escalationPath = path.join(testWorkspaceRoot, '.claude-sessions', 'issue-123-escalation.md');
            const content = fs.readFileSync(escalationPath, 'utf-8');
            // Verify all cycles are included
            assert.ok(content.includes('Cycle 1'), 'Should include cycle 1');
            assert.ok(content.includes('Cycle 2'), 'Should include cycle 2');
            assert.ok(content.includes('Cycle 3'), 'Should include cycle 3');
            // Verify feedback from all cycles
            assert.ok(content.includes('AC-1'), 'Should include AC-1');
            assert.ok(content.includes('AC-2'), 'Should include AC-2');
            assert.ok(content.includes('AC-3'), 'Should include AC-3');
            // Verify it includes recommended actions
            assert.ok(content.includes('Recommended Actions'), 'Should include recommendations');
            assert.ok(content.includes('Manual Code Review'), 'Should suggest manual review');
            assert.ok(content.includes('Agent Analysis'), 'Should suggest agent analysis');
        });
        test('should not escalate before 3rd cycle', async () => {
            // Perform 2 rejection cycles
            for (let i = 1; i <= 2; i++) {
                const feedback = {
                    reviewId: `test-review-${i}`,
                    issueNumber: 123,
                    unmetCriteria: [{ criterion: `AC-${i}`, reason: `Reason ${i}` }],
                    qualityIssues: [],
                    requestedChanges: [`Fix ${i}`],
                    cycleNumber: i
                };
                const reviewItem = await reviewQueueManager.enqueueReview({
                    projectNumber: 79,
                    issueNumber: 123,
                    branchName: 'project/79-issue-123',
                    completedByAgentId: 'agent-1'
                });
                await refinementManager.handleReviewRejection(reviewItem.reviewId, feedback);
            }
            // Verify escalation file was NOT created
            const escalationPath = path.join(testWorkspaceRoot, '.claude-sessions', 'issue-123-escalation.md');
            assert.ok(!fs.existsSync(escalationPath), 'Should not escalate before cycle 3');
        });
    });
    suite('State Persistence - AC-3.5.f', () => {
        test('should persist cycle count across manager instances', async () => {
            // Create first manager and increment
            const manager1 = new iterative_refinement_1.IterativeRefinementManager(testWorkspaceRoot);
            await manager1.incrementReviewCycle(123, 79);
            await manager1.incrementReviewCycle(123, 79);
            // Create second manager and verify count
            const manager2 = new iterative_refinement_1.IterativeRefinementManager(testWorkspaceRoot);
            const count = await manager2.getReviewCycleCount(123);
            assert.strictEqual(count, 2, 'Cycle count should persist across instances');
        });
        test('should persist review history across manager instances', async () => {
            // Create first manager and add history
            const manager1 = new iterative_refinement_1.IterativeRefinementManager(testWorkspaceRoot);
            const feedback = {
                reviewId: 'test-review-1',
                issueNumber: 123,
                unmetCriteria: [{ criterion: 'AC-1', reason: 'Test' }],
                qualityIssues: [],
                requestedChanges: [],
                cycleNumber: 1
            };
            const reviewItem = await reviewQueueManager.enqueueReview({
                projectNumber: 79,
                issueNumber: 123,
                branchName: 'project/79-issue-123',
                completedByAgentId: 'agent-1'
            });
            await manager1.handleReviewRejection(reviewItem.reviewId, feedback);
            // Create second manager and verify history
            const manager2 = new iterative_refinement_1.IterativeRefinementManager(testWorkspaceRoot);
            const history = await manager2.getReviewHistory(123);
            assert.strictEqual(history.length, 1, 'History should persist across instances');
            assert.strictEqual(history[0].status, 'rejected', 'History entry should be correct');
        });
        test('should handle corrupted cycles file gracefully', async () => {
            // Write corrupted file
            const cyclesPath = path.join(testWorkspaceRoot, '.claude-sessions', 'review-cycles.json');
            fs.mkdirSync(path.dirname(cyclesPath), { recursive: true });
            fs.writeFileSync(cyclesPath, 'invalid json{', 'utf-8');
            // Should not throw, should return default value
            const count = await refinementManager.getReviewCycleCount(123);
            assert.strictEqual(count, 0, 'Should return 0 for corrupted file');
        });
    });
    suite('Cleanup Operations', () => {
        test('should clear review cycles for issue', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.clearReviewCycles(123);
            const count = await refinementManager.getReviewCycleCount(123);
            assert.strictEqual(count, 0, 'Cycle count should be cleared');
        });
        test('should list active refinement issues', async () => {
            await refinementManager.incrementReviewCycle(123, 79);
            await refinementManager.incrementReviewCycle(456, 79);
            await refinementManager.incrementReviewCycle(789, 80);
            const activeIssues = await refinementManager.getActiveRefinementIssues();
            assert.strictEqual(activeIssues.length, 3, 'Should have 3 active issues');
            assert.ok(activeIssues.includes(123), 'Should include issue 123');
            assert.ok(activeIssues.includes(456), 'Should include issue 456');
            assert.ok(activeIssues.includes(789), 'Should include issue 789');
        });
    });
    suite('Singleton Instance Management', () => {
        test('should initialize singleton instance', () => {
            (0, iterative_refinement_1.cleanupIterativeRefinement)();
            const instance = (0, iterative_refinement_1.initializeIterativeRefinement)(testWorkspaceRoot);
            assert.ok(instance, 'Should return instance');
            const retrieved = (0, iterative_refinement_1.getIterativeRefinementManager)();
            assert.strictEqual(instance, retrieved, 'Should return same instance');
        });
        test('should throw error when accessing uninitialized singleton', () => {
            (0, iterative_refinement_1.cleanupIterativeRefinement)();
            assert.throws(() => (0, iterative_refinement_1.getIterativeRefinementManager)(), /not initialized/i, 'Should throw error for uninitialized instance');
        });
        test('should cleanup singleton instance', () => {
            (0, iterative_refinement_1.initializeIterativeRefinement)(testWorkspaceRoot);
            (0, iterative_refinement_1.cleanupIterativeRefinement)();
            assert.throws(() => (0, iterative_refinement_1.getIterativeRefinementManager)(), /not initialized/i, 'Should throw error after cleanup');
        });
    });
});
//# sourceMappingURL=iterative-refinement.test.js.map