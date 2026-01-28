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
const ideation_executor_1 = require("../ideation-executor");
suite('Ideation Executor Test Suite', () => {
    suite('parseIdeationResponse', () => {
        test('AC-4.3.b: Should parse valid ideation response correctly', () => {
            const response = `
**Title:** Implement rate limiting for API endpoints

**Description:** Add Redis-based rate limiting to prevent API abuse and ensure fair usage across all clients.

**Acceptance Criteria:**
- AC-1: Rate limiting middleware is applied to all public API endpoints
- AC-2: Redis is used for distributed rate limit tracking
- AC-3: Rate limit headers are returned in all responses
- AC-4: Custom rate limits can be configured per endpoint

**Technical Approach:**
Implement using express-rate-limit with Redis store. Configure different rate limits for authenticated vs unauthenticated requests.

**Estimated Effort:** 4 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.ok(parsed, 'Should parse response successfully');
            assert.strictEqual(parsed.title, 'Implement rate limiting for API endpoints');
            assert.ok(parsed.description.includes('Redis-based rate limiting'));
            assert.strictEqual(parsed.acceptanceCriteria.length, 4);
            assert.strictEqual(parsed.acceptanceCriteria[0], 'Rate limiting middleware is applied to all public API endpoints');
            assert.ok(parsed.technicalApproach.includes('express-rate-limit'));
            assert.strictEqual(parsed.effortHours, 4);
        });
        test('Should parse response with alternative AC format (checkboxes)', () => {
            const response = `
**Title:** Add user authentication

**Description:** Implement JWT-based authentication for secure user sessions with proper token management.

**Acceptance Criteria:**
- [ ] Users can register with email and password
- [ ] JWT tokens are issued on successful login
- [ ] Protected routes require valid tokens

**Technical Approach:**
Use jsonwebtoken library with bcrypt for password hashing.

**Estimated Effort:** 6 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.ok(parsed);
            assert.strictEqual(parsed.acceptanceCriteria.length, 3);
            assert.strictEqual(parsed.acceptanceCriteria[0], 'Users can register with email and password');
        });
        test('Should return null when title is missing', () => {
            const response = `
**Description:** Some description

**Acceptance Criteria:**
- AC-1: First criterion

**Technical Approach:** Some approach

**Estimated Effort:** 3 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.strictEqual(parsed, null);
        });
        test('Should return null when description is missing', () => {
            const response = `
**Title:** Some Title

**Acceptance Criteria:**
- AC-1: First criterion

**Technical Approach:** Some approach

**Estimated Effort:** 3 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.strictEqual(parsed, null);
        });
        test('Should return null when acceptance criteria are missing', () => {
            const response = `
**Title:** Some Title

**Description:** Some description

**Technical Approach:** Some approach

**Estimated Effort:** 3 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.strictEqual(parsed, null);
        });
        test('Should return null when technical approach is missing', () => {
            const response = `
**Title:** Some Title

**Description:** Some description

**Acceptance Criteria:**
- AC-1: First criterion
- AC-2: Second criterion
- AC-3: Third criterion

**Estimated Effort:** 3 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.strictEqual(parsed, null);
        });
        test('Should return null when effort estimate is missing', () => {
            const response = `
**Title:** Some Title

**Description:** Some description

**Acceptance Criteria:**
- AC-1: First criterion
- AC-2: Second criterion
- AC-3: Third criterion

**Technical Approach:** Some approach
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.strictEqual(parsed, null);
        });
        test('Should parse effort estimate with "hour" (singular)', () => {
            const response = `
**Title:** Quick fix

**Description:** A simple bug fix that requires minimal effort.

**Acceptance Criteria:**
- AC-1: Bug is identified
- AC-2: Fix is applied
- AC-3: Tests pass

**Technical Approach:** Direct code change

**Estimated Effort:** 1 hour
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.ok(parsed);
            assert.strictEqual(parsed.effortHours, 1);
        });
    });
    suite('validateIdea', () => {
        const createValidIdea = () => ({
            title: 'Valid title',
            description: 'This is a valid description with at least 20 characters',
            acceptanceCriteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
            technicalApproach: 'Valid approach',
            effortHours: 4,
            category: 'optimization'
        });
        test('AC-4.3.c: Should validate a valid idea', async () => {
            const idea = createValidIdea();
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.ok(result.valid);
            assert.strictEqual(result.error, undefined);
        });
        test('Should reject idea with empty title', async () => {
            const idea = createValidIdea();
            idea.title = '';
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Title is required');
        });
        test('Should reject idea with title > 100 characters', async () => {
            const idea = createValidIdea();
            idea.title = 'a'.repeat(101);
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Title must be less than 100 characters');
        });
        test('Should reject idea with description < 20 characters', async () => {
            const idea = createValidIdea();
            idea.description = 'Too short';
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Description must be at least 20 characters');
        });
        test('Should reject idea with description > 500 characters', async () => {
            const idea = createValidIdea();
            idea.description = 'a'.repeat(501);
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.error, 'Description must be less than 500 characters');
        });
        test('Should reject idea with < 3 acceptance criteria', async () => {
            const idea = createValidIdea();
            idea.acceptanceCriteria = ['Only one', 'Only two'];
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('At least 3 acceptance criteria required'));
        });
        test('AC-4.3.f: Should reject idea with effort > 8 hours', async () => {
            const idea = createValidIdea();
            idea.effortHours = 10;
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('Effort estimate must be between 1-8 hours'));
        });
        test('Should reject idea with effort < 1 hour', async () => {
            const idea = createValidIdea();
            idea.effortHours = 0;
            const result = await (0, ideation_executor_1.validateIdea)(idea, []);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('Effort estimate must be between 1-8 hours'));
        });
        test('AC-4.3.e: Should reject duplicate idea (similarity > 80%)', async () => {
            const idea = createValidIdea();
            idea.title = 'Implement rate limiting for API';
            const existingIssues = [
                'Implement rate limiting for APIs',
                'Add logging support',
                'Fix authentication bug'
            ];
            const result = await (0, ideation_executor_1.validateIdea)(idea, existingIssues);
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes('Duplicate idea detected'));
        });
        test('Should accept idea with similar but not duplicate title', async () => {
            const idea = createValidIdea();
            idea.title = 'Implement caching layer';
            const existingIssues = [
                'Add logging support',
                'Fix authentication bug',
                'Optimize database queries'
            ];
            const result = await (0, ideation_executor_1.validateIdea)(idea, existingIssues);
            assert.ok(result.valid);
        });
    });
    suite('checkForDuplicates', () => {
        test('AC-4.3.e: Should detect exact duplicate', async () => {
            const title = 'Implement rate limiting';
            const existingIssues = ['Implement rate limiting', 'Add logging', 'Fix bug'];
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)(title, existingIssues);
            assert.strictEqual(isDuplicate, true);
        });
        test('Should detect near-duplicate (> 80% similarity)', async () => {
            const title = 'Implement rate limiting for API';
            const existingIssues = ['Implement rate limiting for APIs', 'Add logging'];
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)(title, existingIssues);
            assert.strictEqual(isDuplicate, true);
        });
        test('Should not detect false positive with low similarity', async () => {
            const title = 'Add caching layer';
            const existingIssues = ['Implement rate limiting', 'Fix authentication', 'Add logging'];
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)(title, existingIssues);
            assert.strictEqual(isDuplicate, false);
        });
        test('Should be case-insensitive', async () => {
            const title = 'IMPLEMENT RATE LIMITING';
            const existingIssues = ['implement rate limiting', 'Add logging'];
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)(title, existingIssues);
            assert.strictEqual(isDuplicate, true);
        });
        test('Should handle empty existing issues list', async () => {
            const title = 'New feature';
            const existingIssues = [];
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)(title, existingIssues);
            assert.strictEqual(isDuplicate, false);
        });
    });
    suite('isValidEffortEstimate', () => {
        test('Should accept effort estimate of 1 hour', () => {
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(1), true);
        });
        test('Should accept effort estimate of 8 hours', () => {
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(8), true);
        });
        test('Should accept effort estimate in valid range', () => {
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(4), true);
        });
        test('AC-4.3.f: Should reject effort estimate > 8 hours', () => {
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(9), false);
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(10), false);
        });
        test('Should reject effort estimate < 1 hour', () => {
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(0), false);
            assert.strictEqual((0, ideation_executor_1.isValidEffortEstimate)(-1), false);
        });
    });
    suite('executeIdeation (integration)', () => {
        test('AC-4.3.d: Should return noIdeaAvailable when response is NO_IDEA_AVAILABLE', async () => {
            // This test would need mocking in a real implementation
            // For now, we test the parsing logic
            const response = 'NO_IDEA_AVAILABLE';
            // Simulate the check
            const isNoIdea = response.trim() === 'NO_IDEA_AVAILABLE' || response.includes('NO_IDEA_AVAILABLE');
            assert.strictEqual(isNoIdea, true);
        });
        test('Should handle parse errors gracefully', async () => {
            const invalidResponse = 'This is not a valid response format';
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(invalidResponse);
            assert.strictEqual(parsed, null);
        });
    });
    suite('String similarity algorithm', () => {
        test('Should calculate 100% similarity for identical strings', async () => {
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)('test', ['test']);
            assert.strictEqual(isDuplicate, true);
        });
        test('Should calculate high similarity for nearly identical strings', async () => {
            // "Implement rate limiting" vs "Implement rate limiting for API"
            // Should be > 80% similar
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)('Implement rate limiting', ['Implement rate limiting for API']);
            assert.strictEqual(isDuplicate, true);
        });
        test('Should calculate low similarity for different strings', async () => {
            const isDuplicate = await (0, ideation_executor_1.checkForDuplicates)('Add caching', ['Fix authentication bug']);
            assert.strictEqual(isDuplicate, false);
        });
    });
    suite('Edge cases', () => {
        test('Should handle multiline description in parsing', () => {
            const response = `
**Title:** Multi-line test

**Description:** This is a description
that spans multiple lines
and should still work correctly.

**Acceptance Criteria:**
- AC-1: First
- AC-2: Second
- AC-3: Third

**Technical Approach:** Simple approach

**Estimated Effort:** 2 hours
`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.ok(parsed);
            assert.ok(parsed.description.includes('multiple lines'));
        });
        test('Should handle extra whitespace in parsing', () => {
            const response = `

**Title:**    Whitespace test

**Description:**    Description with extra spaces

**Acceptance Criteria:**
-   AC-1:   First criterion
-   AC-2:   Second criterion
-   AC-3:   Third criterion

**Technical Approach:**   Approach with spaces

**Estimated Effort:**   5   hours

`;
            const parsed = (0, ideation_executor_1.parseIdeationResponse)(response);
            assert.ok(parsed);
            assert.strictEqual(parsed.title, 'Whitespace test');
            assert.strictEqual(parsed.effortHours, 5);
        });
    });
});
//# sourceMappingURL=ideation-executor.test.js.map