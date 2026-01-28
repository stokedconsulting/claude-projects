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
exports.ReviewQueueManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
/**
 * Review Queue Manager
 *
 * Manages the review queue for completed projects, allowing review agents to claim
 * and process reviews atomically. Queue is stored in `.claude-sessions/review-queue.json`.
 *
 * AC-3.2.a: When execution agent completes project → review is enqueued within 30 seconds
 * AC-3.2.b: When review agent queries queue → pending reviews are returned sorted by completion time (oldest first)
 * AC-3.2.c: When review agent claims review → claim succeeds atomically and review status becomes "in_review"
 * AC-3.2.d: When review queue is empty → review agent status becomes "idle" and polls every 60 seconds
 * AC-3.2.e: When review claim is older than 2 hours → escalation notification is sent to user
 */
class ReviewQueueManager {
    SESSIONS_DIR = '.claude-sessions';
    QUEUE_FILE = 'review-queue.json';
    CLAIM_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
    COMPLETED_REVIEW_RETENTION_DAYS = 7;
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    /**
     * Get the full path to the sessions directory
     */
    getSessionsDirectory() {
        return path.join(this.workspaceRoot, this.SESSIONS_DIR);
    }
    /**
     * Get the full path to the review queue file
     */
    getQueueFilePath() {
        return path.join(this.getSessionsDirectory(), this.QUEUE_FILE);
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
     * Read review queue file atomically
     * Returns empty array if file doesn't exist
     */
    readQueueFile() {
        const filePath = this.getQueueFilePath();
        if (!fs.existsSync(filePath)) {
            return [];
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            // Validate structure
            if (!Array.isArray(parsed)) {
                console.error('[ReviewQueueManager] Invalid queue file structure, resetting');
                return [];
            }
            return parsed;
        }
        catch (error) {
            console.error('[ReviewQueueManager] Error reading queue file:', error);
            // Return empty queue on error (file corruption, parse error, etc.)
            return [];
        }
    }
    /**
     * Write review queue file atomically using temp file + rename pattern
     * This prevents file corruption from incomplete writes
     */
    writeQueueFileAtomic(queue) {
        this.ensureSessionsDirectory();
        const filePath = this.getQueueFilePath();
        const tempPath = `${filePath}.tmp`;
        const content = JSON.stringify(queue, null, 2);
        // Write to temp file
        fs.writeFileSync(tempPath, content, 'utf-8');
        // Atomically rename temp file to target file
        fs.renameSync(tempPath, filePath);
    }
    /**
     * Retry an async operation with exponential backoff
     * Backoff sequence: 1s, 2s, 4s (max 3 retries)
     */
    async retryWithBackoff(operation, context, maxRetries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                console.error(`[ReviewQueueManager] ${context} failed (attempt ${attempt + 1}/${maxRetries}):`, error);
                if (attempt < maxRetries - 1) {
                    console.log(`[ReviewQueueManager] Retrying in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }
        throw lastError;
    }
    /**
     * Validate review item structure
     */
    isValidReviewItem(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        const validStatuses = ['pending', 'in_review', 'approved', 'rejected'];
        return (typeof obj.reviewId === 'string' &&
            typeof obj.projectNumber === 'number' &&
            typeof obj.issueNumber === 'number' &&
            typeof obj.branchName === 'string' &&
            typeof obj.completedByAgentId === 'string' &&
            validStatuses.includes(obj.status) &&
            typeof obj.enqueuedAt === 'string' &&
            (obj.claimedAt === undefined || typeof obj.claimedAt === 'string') &&
            (obj.completedAt === undefined || typeof obj.completedAt === 'string') &&
            (obj.feedback === undefined || typeof obj.feedback === 'string'));
    }
    /**
     * Check if a review claim has timed out (older than 2 hours)
     */
    isClaimTimedOut(review) {
        if (!review.claimedAt || review.status !== 'in_review') {
            return false;
        }
        const claimedTime = new Date(review.claimedAt).getTime();
        const now = Date.now();
        return now - claimedTime > this.CLAIM_TIMEOUT_MS;
    }
    /**
     * Add a completed project to the review queue
     *
     * AC-3.2.a: When execution agent completes project → review is enqueued within 30 seconds
     *
     * @param reviewData - Data about the completed project
     * @returns The created review item
     */
    async enqueueReview(reviewData) {
        return await this.retryWithBackoff(async () => {
            const queue = this.readQueueFile();
            // Check if review already exists for this issue
            const existingReview = queue.find(r => r.projectNumber === reviewData.projectNumber &&
                r.issueNumber === reviewData.issueNumber &&
                (r.status === 'pending' || r.status === 'in_review'));
            if (existingReview) {
                console.log(`[ReviewQueueManager] Review already exists for issue ${reviewData.issueNumber}, returning existing`);
                return existingReview;
            }
            // Create new review item
            const reviewItem = {
                reviewId: (0, crypto_1.randomUUID)(),
                projectNumber: reviewData.projectNumber,
                issueNumber: reviewData.issueNumber,
                branchName: reviewData.branchName,
                completedByAgentId: reviewData.completedByAgentId,
                status: 'pending',
                enqueuedAt: new Date().toISOString()
            };
            queue.push(reviewItem);
            this.writeQueueFileAtomic(queue);
            console.log(`[ReviewQueueManager] Enqueued review ${reviewItem.reviewId} for issue ${reviewData.issueNumber}`);
            return reviewItem;
        }, `Enqueue review for issue ${reviewData.issueNumber}`, 3);
    }
    /**
     * Get all reviews in the queue, sorted by enqueue time (oldest first)
     *
     * AC-3.2.b: When review agent queries queue → pending reviews are returned sorted by completion time (oldest first)
     *
     * @returns Array of all review items sorted by enqueue time
     */
    async getReviewQueue() {
        const queue = this.readQueueFile();
        // Filter valid items and sort by enqueue time (oldest first)
        const validQueue = queue
            .filter(item => this.isValidReviewItem(item))
            .sort((a, b) => {
            const timeA = new Date(a.enqueuedAt).getTime();
            const timeB = new Date(b.enqueuedAt).getTime();
            return timeA - timeB;
        });
        console.log(`[ReviewQueueManager] Retrieved review queue with ${validQueue.length} items`);
        return validQueue;
    }
    /**
     * Get only pending reviews (not claimed)
     *
     * @returns Array of pending review items sorted by enqueue time
     */
    async getPendingReviews() {
        const queue = await this.getReviewQueue();
        return queue.filter(item => item.status === 'pending');
    }
    /**
     * Atomically claim a review for the review agent
     *
     * AC-3.2.c: When review agent claims review → claim succeeds atomically and review status becomes "in_review"
     *
     * @param reviewId - UUID of the review to claim
     * @returns The claimed review item, or null if already claimed or not found
     */
    async claimReview(reviewId) {
        return await this.retryWithBackoff(async () => {
            const queue = this.readQueueFile();
            const reviewIndex = queue.findIndex(r => r.reviewId === reviewId);
            if (reviewIndex === -1) {
                console.log(`[ReviewQueueManager] Review ${reviewId} not found`);
                return null;
            }
            const review = queue[reviewIndex];
            // Check if already claimed and not timed out
            if (review.status === 'in_review' && !this.isClaimTimedOut(review)) {
                console.log(`[ReviewQueueManager] Review ${reviewId} already claimed`);
                return null;
            }
            // Update review status to in_review
            review.status = 'in_review';
            review.claimedAt = new Date().toISOString();
            queue[reviewIndex] = review;
            this.writeQueueFileAtomic(queue);
            console.log(`[ReviewQueueManager] Successfully claimed review ${reviewId} for issue ${review.issueNumber}`);
            return review;
        }, `Claim review ${reviewId}`, 3);
    }
    /**
     * Update the status of a review
     *
     * @param reviewId - UUID of the review to update
     * @param status - New status value
     * @param feedback - Optional feedback (for rejected reviews)
     */
    async updateReviewStatus(reviewId, status, feedback) {
        await this.retryWithBackoff(async () => {
            const queue = this.readQueueFile();
            const reviewIndex = queue.findIndex(r => r.reviewId === reviewId);
            if (reviewIndex === -1) {
                throw new Error(`Review ${reviewId} not found`);
            }
            const review = queue[reviewIndex];
            review.status = status;
            if (feedback) {
                review.feedback = feedback;
            }
            if (status === 'approved' || status === 'rejected') {
                review.completedAt = new Date().toISOString();
            }
            queue[reviewIndex] = review;
            this.writeQueueFileAtomic(queue);
            console.log(`[ReviewQueueManager] Updated review ${reviewId} status to ${status}`);
        }, `Update review ${reviewId} status`, 3);
    }
    /**
     * Get a review by ID
     *
     * @param reviewId - UUID of the review
     * @returns The review item or null if not found
     */
    async getReviewById(reviewId) {
        const queue = this.readQueueFile();
        const review = queue.find(r => r.reviewId === reviewId);
        if (!review) {
            console.log(`[ReviewQueueManager] Review ${reviewId} not found`);
            return null;
        }
        return review;
    }
    /**
     * Release a review claim (set back to pending)
     *
     * @param reviewId - UUID of the review to release
     */
    async releaseReviewClaim(reviewId) {
        await this.retryWithBackoff(async () => {
            const queue = this.readQueueFile();
            const reviewIndex = queue.findIndex(r => r.reviewId === reviewId);
            if (reviewIndex === -1) {
                console.log(`[ReviewQueueManager] Review ${reviewId} not found, nothing to release`);
                return;
            }
            const review = queue[reviewIndex];
            // Only release if in_review status
            if (review.status !== 'in_review') {
                console.log(`[ReviewQueueManager] Review ${reviewId} is not in review status, skipping release`);
                return;
            }
            review.status = 'pending';
            review.claimedAt = undefined;
            queue[reviewIndex] = review;
            this.writeQueueFileAtomic(queue);
            console.log(`[ReviewQueueManager] Released claim for review ${reviewId}`);
        }, `Release review claim ${reviewId}`, 3);
    }
    /**
     * Get all reviews that have timed out (in_review for > 2 hours)
     *
     * AC-3.2.e: When review claim is older than 2 hours → escalation notification is sent to user
     *
     * @returns Array of timed-out review items
     */
    async getTimedOutReviews() {
        const queue = this.readQueueFile();
        const timedOut = queue.filter(review => this.isClaimTimedOut(review));
        if (timedOut.length > 0) {
            console.log(`[ReviewQueueManager] Found ${timedOut.length} timed-out review(s)`);
        }
        return timedOut;
    }
    /**
     * Clean up old completed reviews (older than 7 days)
     *
     * @returns Number of reviews removed
     */
    async cleanupOldReviews() {
        await this.retryWithBackoff(async () => {
            const queue = this.readQueueFile();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.COMPLETED_REVIEW_RETENTION_DAYS);
            const cutoffTime = cutoffDate.getTime();
            const filteredQueue = queue.filter(review => {
                // Keep if not completed
                if (review.status !== 'approved' && review.status !== 'rejected') {
                    return true;
                }
                // Keep if no completion date (shouldn't happen but be safe)
                if (!review.completedAt) {
                    return true;
                }
                // Keep if completed recently
                const completedTime = new Date(review.completedAt).getTime();
                return completedTime > cutoffTime;
            });
            const removedCount = queue.length - filteredQueue.length;
            if (removedCount > 0) {
                this.writeQueueFileAtomic(filteredQueue);
                console.log(`[ReviewQueueManager] Cleaned up ${removedCount} old completed review(s)`);
            }
        }, 'Clean up old reviews', 3);
    }
    /**
     * Get review statistics
     *
     * @returns Object with queue statistics
     */
    async getQueueStats() {
        const queue = await this.getReviewQueue();
        const timedOut = await this.getTimedOutReviews();
        return {
            total: queue.length,
            pending: queue.filter(r => r.status === 'pending').length,
            inReview: queue.filter(r => r.status === 'in_review').length,
            approved: queue.filter(r => r.status === 'approved').length,
            rejected: queue.filter(r => r.status === 'rejected').length,
            timedOut: timedOut.length
        };
    }
    /**
     * Clear all reviews from the queue (for testing purposes)
     * WARNING: This will remove ALL reviews from the system
     */
    async clearAllReviews() {
        await this.retryWithBackoff(async () => {
            this.writeQueueFileAtomic([]);
            console.log('[ReviewQueueManager] Cleared all reviews');
        }, 'Clear all reviews', 3);
    }
}
exports.ReviewQueueManager = ReviewQueueManager;
//# sourceMappingURL=review-queue-manager.js.map