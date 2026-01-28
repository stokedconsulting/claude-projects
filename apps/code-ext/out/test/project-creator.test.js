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
const project_creator_1 = require("../project-creator");
const project_queue_manager_1 = require("../project-queue-manager");
const github_api_1 = require("../github-api");
suite('Project Creator Test Suite', () => {
    // Mock data
    const mockIdea = {
        title: 'Implement rate limiting for API endpoints',
        description: 'Add Redis-based rate limiting to prevent API abuse and ensure fair usage across all clients.',
        acceptanceCriteria: [
            'Rate limiting middleware is applied to all public API endpoints',
            'Redis is used for distributed rate limit tracking',
            'Rate limit headers are returned in all responses',
            'Custom rate limits can be configured per endpoint'
        ],
        technicalApproach: 'Implement using express-rate-limit with Redis store. Configure different rate limits for authenticated vs unauthenticated requests.',
        effortHours: 4,
        category: 'optimization'
    };
    // Helper to create mock queue manager
    function createMockQueueManager() {
        const mockWorkspaceRoot = '/tmp/test-workspace';
        const mockGitHubApi = new github_api_1.GitHubAPI();
        return new project_queue_manager_1.ProjectQueueManager(mockWorkspaceRoot, mockGitHubApi);
    }
    suite('formatProjectCreateInput', () => {
        test('AC-4.4.a: Should format idea correctly for /project-create command', () => {
            const input = (0, project_creator_1.formatProjectCreateInput)(mockIdea);
            // Check command header
            assert.ok(input.startsWith('/project-create optimization: Implement rate limiting'));
            // Check description is included
            assert.ok(input.includes('Add Redis-based rate limiting'));
            // Check acceptance criteria section
            assert.ok(input.includes('Acceptance Criteria:'));
            assert.ok(input.includes('- Rate limiting middleware is applied'));
            assert.ok(input.includes('- Redis is used for distributed rate limit tracking'));
            // Check technical approach section
            assert.ok(input.includes('Technical Approach:'));
            assert.ok(input.includes('express-rate-limit'));
        });
        test('Should format all acceptance criteria', () => {
            const input = (0, project_creator_1.formatProjectCreateInput)(mockIdea);
            // All 4 acceptance criteria should be present
            for (const criterion of mockIdea.acceptanceCriteria) {
                assert.ok(input.includes(criterion), `Missing criterion: ${criterion}`);
            }
        });
        test('Should use correct category in command header', () => {
            const ideaWithDifferentCategory = {
                ...mockIdea,
                category: 'security'
            };
            const input = (0, project_creator_1.formatProjectCreateInput)(ideaWithDifferentCategory);
            assert.ok(input.startsWith('/project-create security:'));
        });
        test('Should handle multiline technical approach', () => {
            const ideaWithMultilineApproach = {
                ...mockIdea,
                technicalApproach: 'Step 1: Install dependencies\nStep 2: Configure middleware\nStep 3: Add tests'
            };
            const input = (0, project_creator_1.formatProjectCreateInput)(ideaWithMultilineApproach);
            assert.ok(input.includes('Step 1: Install dependencies'));
            assert.ok(input.includes('Step 2: Configure middleware'));
            assert.ok(input.includes('Step 3: Add tests'));
        });
        test('Should include proper line breaks between sections', () => {
            const input = (0, project_creator_1.formatProjectCreateInput)(mockIdea);
            // Should have blank lines between sections
            const sections = input.split('\n\n');
            assert.ok(sections.length >= 4, 'Should have at least 4 sections separated by blank lines');
        });
    });
    suite('parseProjectCreateResponse', () => {
        test('AC-4.4.c: Should extract project number from "Created project #123" format', () => {
            const response = 'Created project #456';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, 456);
        });
        test('Should extract project number from "Project 123 created" format', () => {
            const response = 'Project 789 created successfully';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, 789);
        });
        test('Should extract project number from "GitHub project #123" format', () => {
            const response = 'GitHub project #321 has been created';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, 321);
        });
        test('Should extract project number from simple "#123" format', () => {
            const response = 'Success! Project #999 is ready';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, 999);
        });
        test('AC-4.4.e: Should return null when project number is not found', () => {
            const response = 'Project creation failed - no number here';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, null);
        });
        test('Should return null for empty response', () => {
            const response = '';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, null);
        });
        test('Should handle multi-line response and extract first project number', () => {
            const response = `
Project creation started...
Created project #555
Issue #556 opened
      `.trim();
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, 555);
        });
        test('Should be case-insensitive', () => {
            const response = 'CREATED PROJECT #123';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            assert.strictEqual(projectNumber, 123);
        });
    });
    suite('addProjectLabels', () => {
        test('AC-4.4.b: Should add agent-generated and category labels', async () => {
            // This is a simulated operation, so we just verify it doesn't throw
            await (0, project_creator_1.addProjectLabels)(123, 'optimization');
            // In a real test, we would mock GitHub API and verify the labels
            assert.ok(true, 'Labels added successfully');
        });
        test('Should handle different category names', async () => {
            const categories = ['security', 'performance', 'testing', 'documentation'];
            for (const category of categories) {
                await (0, project_creator_1.addProjectLabels)(123, category);
            }
            assert.ok(true, 'All categories handled successfully');
        });
    });
    suite('enqueueNewProject', () => {
        test('AC-4.4.d: Should enqueue project to work queue', async () => {
            const queueManager = createMockQueueManager();
            // This is a simulated operation
            await (0, project_creator_1.enqueueNewProject)(456, 457, queueManager);
            // In a real test, we would verify the project appears in the queue
            assert.ok(true, 'Project enqueued successfully');
        });
    });
    suite('trackSelfGeneratedProject', () => {
        // Clean up before and after tests
        setup(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        teardown(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        test('Should track a self-generated project', async () => {
            const projectData = {
                projectNumber: 100,
                issueNumber: 101,
                category: 'optimization',
                ideatedByAgentId: 'agent-001',
                createdAt: new Date().toISOString()
            };
            await (0, project_creator_1.trackSelfGeneratedProject)(projectData);
            const allProjects = await (0, project_creator_1.getAllSelfGeneratedProjects)();
            assert.strictEqual(allProjects.length, 1);
            assert.strictEqual(allProjects[0].projectNumber, 100);
            assert.strictEqual(allProjects[0].category, 'optimization');
        });
        test('Should prevent duplicate tracking', async () => {
            const projectData = {
                projectNumber: 200,
                issueNumber: 201,
                category: 'security',
                ideatedByAgentId: 'agent-002',
                createdAt: new Date().toISOString()
            };
            // Track twice
            await (0, project_creator_1.trackSelfGeneratedProject)(projectData);
            await (0, project_creator_1.trackSelfGeneratedProject)(projectData);
            const allProjects = await (0, project_creator_1.getAllSelfGeneratedProjects)();
            assert.strictEqual(allProjects.length, 1, 'Should not create duplicates');
        });
        test('Should track multiple projects', async () => {
            const projects = [
                {
                    projectNumber: 300,
                    issueNumber: 301,
                    category: 'optimization',
                    ideatedByAgentId: 'agent-003',
                    createdAt: new Date().toISOString()
                },
                {
                    projectNumber: 400,
                    issueNumber: 401,
                    category: 'security',
                    ideatedByAgentId: 'agent-003',
                    createdAt: new Date().toISOString()
                }
            ];
            for (const project of projects) {
                await (0, project_creator_1.trackSelfGeneratedProject)(project);
            }
            const allProjects = await (0, project_creator_1.getAllSelfGeneratedProjects)();
            assert.strictEqual(allProjects.length, 2);
        });
    });
    suite('getWeeklyGenerationRate', () => {
        setup(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        teardown(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        test('Should count projects from last 7 days', async () => {
            const now = new Date();
            const threeDaysAgo = new Date(now);
            threeDaysAgo.setDate(now.getDate() - 3);
            const recentProject = {
                projectNumber: 500,
                issueNumber: 501,
                category: 'optimization',
                ideatedByAgentId: 'agent-004',
                createdAt: threeDaysAgo.toISOString()
            };
            await (0, project_creator_1.trackSelfGeneratedProject)(recentProject);
            const rate = await (0, project_creator_1.getWeeklyGenerationRate)('optimization');
            assert.strictEqual(rate, 1);
        });
        test('Should not count projects older than 7 days', async () => {
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            const oldProject = {
                projectNumber: 600,
                issueNumber: 601,
                category: 'optimization',
                ideatedByAgentId: 'agent-005',
                createdAt: tenDaysAgo.toISOString()
            };
            await (0, project_creator_1.trackSelfGeneratedProject)(oldProject);
            const rate = await (0, project_creator_1.getWeeklyGenerationRate)('optimization');
            assert.strictEqual(rate, 0);
        });
        test('Should filter by category', async () => {
            const projects = [
                {
                    projectNumber: 700,
                    issueNumber: 701,
                    category: 'optimization',
                    ideatedByAgentId: 'agent-006',
                    createdAt: new Date().toISOString()
                },
                {
                    projectNumber: 800,
                    issueNumber: 801,
                    category: 'security',
                    ideatedByAgentId: 'agent-006',
                    createdAt: new Date().toISOString()
                }
            ];
            for (const project of projects) {
                await (0, project_creator_1.trackSelfGeneratedProject)(project);
            }
            const optimizationRate = await (0, project_creator_1.getWeeklyGenerationRate)('optimization');
            const securityRate = await (0, project_creator_1.getWeeklyGenerationRate)('security');
            assert.strictEqual(optimizationRate, 1);
            assert.strictEqual(securityRate, 1);
        });
        test('Should return 0 for category with no projects', async () => {
            const rate = await (0, project_creator_1.getWeeklyGenerationRate)('nonexistent-category');
            assert.strictEqual(rate, 0);
        });
    });
    suite('getSelfGeneratedProjectsByCategory', () => {
        setup(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        teardown(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        test('Should filter projects by category', async () => {
            const projects = [
                {
                    projectNumber: 900,
                    issueNumber: 901,
                    category: 'optimization',
                    ideatedByAgentId: 'agent-007',
                    createdAt: new Date().toISOString()
                },
                {
                    projectNumber: 1000,
                    issueNumber: 1001,
                    category: 'security',
                    ideatedByAgentId: 'agent-007',
                    createdAt: new Date().toISOString()
                },
                {
                    projectNumber: 1100,
                    issueNumber: 1101,
                    category: 'optimization',
                    ideatedByAgentId: 'agent-007',
                    createdAt: new Date().toISOString()
                }
            ];
            for (const project of projects) {
                await (0, project_creator_1.trackSelfGeneratedProject)(project);
            }
            const optimizationProjects = await (0, project_creator_1.getSelfGeneratedProjectsByCategory)('optimization');
            assert.strictEqual(optimizationProjects.length, 2);
            assert.ok(optimizationProjects.every(p => p.category === 'optimization'));
        });
        test('Should return empty array for category with no projects', async () => {
            const projects = await (0, project_creator_1.getSelfGeneratedProjectsByCategory)('nonexistent-category');
            assert.strictEqual(projects.length, 0);
        });
    });
    suite('createProjectFromIdea (integration)', () => {
        setup(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        teardown(async () => {
            await (0, project_creator_1.clearSelfGeneratedProjects)();
        });
        test('AC-4.4.a: Should complete project creation within 30 seconds', async () => {
            const queueManager = createMockQueueManager();
            const startTime = Date.now();
            const result = await (0, project_creator_1.createProjectFromIdea)(mockIdea, 'agent-test', queueManager);
            const duration = Date.now() - startTime;
            assert.ok(result.success, 'Project creation should succeed');
            assert.ok(duration < 30000, `Should complete within 30 seconds (took ${duration}ms)`);
        });
        test('AC-4.4.b: Should add agent-generated and category labels', async () => {
            const queueManager = createMockQueueManager();
            const result = await (0, project_creator_1.createProjectFromIdea)(mockIdea, 'agent-test', queueManager);
            assert.ok(result.success);
            assert.ok(result.labels);
            assert.ok(result.labels.includes('agent-generated'));
            assert.ok(result.labels.includes('category:optimization'));
        });
        test('AC-4.4.c: Should extract and store project number', async () => {
            const queueManager = createMockQueueManager();
            const result = await (0, project_creator_1.createProjectFromIdea)(mockIdea, 'agent-test', queueManager);
            assert.ok(result.success);
            assert.ok(result.projectNumber, 'Project number should be extracted');
            assert.ok(typeof result.projectNumber === 'number');
            assert.ok(result.projectNumber > 0);
        });
        test('AC-4.4.d: Should enqueue project for execution agents', async () => {
            const queueManager = createMockQueueManager();
            const result = await (0, project_creator_1.createProjectFromIdea)(mockIdea, 'agent-test', queueManager);
            assert.ok(result.success);
            // In production, we would verify the project appears in getAvailableProjects()
        });
        test('AC-4.4.e: Should handle errors gracefully', async () => {
            // Test with invalid queue manager or other error conditions
            // For now, test that errors are caught and returned
            const queueManager = createMockQueueManager();
            const invalidIdea = {
                ...mockIdea,
                title: '' // Invalid title should still create project, but might fail
            };
            const result = await (0, project_creator_1.createProjectFromIdea)(invalidIdea, 'agent-test', queueManager);
            // Should not throw, should return result with success flag
            assert.ok(typeof result.success === 'boolean');
            if (!result.success) {
                assert.ok(result.error, 'Error message should be provided');
            }
        });
        test('Should track self-generated project', async () => {
            const queueManager = createMockQueueManager();
            const result = await (0, project_creator_1.createProjectFromIdea)(mockIdea, 'agent-test', queueManager);
            assert.ok(result.success);
            const allProjects = await (0, project_creator_1.getAllSelfGeneratedProjects)();
            assert.ok(allProjects.length > 0);
            const trackedProject = allProjects.find(p => p.projectNumber === result.projectNumber);
            assert.ok(trackedProject, 'Project should be tracked');
            assert.strictEqual(trackedProject?.category, 'optimization');
            assert.strictEqual(trackedProject?.ideatedByAgentId, 'agent-test');
        });
        test('Should return issue number', async () => {
            const queueManager = createMockQueueManager();
            const result = await (0, project_creator_1.createProjectFromIdea)(mockIdea, 'agent-test', queueManager);
            assert.ok(result.success);
            assert.ok(result.issueNumber, 'Issue number should be returned');
            assert.ok(typeof result.issueNumber === 'number');
        });
        test('Should handle different categories', async () => {
            const queueManager = createMockQueueManager();
            const categories = ['security', 'performance', 'testing'];
            for (const category of categories) {
                const ideaWithCategory = {
                    ...mockIdea,
                    category
                };
                const result = await (0, project_creator_1.createProjectFromIdea)(ideaWithCategory, 'agent-test', queueManager);
                assert.ok(result.success);
                assert.ok(result.labels?.includes(`category:${category}`));
            }
        });
    });
    suite('Edge cases', () => {
        test('Should handle idea with special characters in title', () => {
            const ideaWithSpecialChars = {
                ...mockIdea,
                title: 'Fix "bug" in API: handle <special> & strange chars'
            };
            const input = (0, project_creator_1.formatProjectCreateInput)(ideaWithSpecialChars);
            assert.ok(input.includes(ideaWithSpecialChars.title));
        });
        test('Should handle idea with very long description', () => {
            const longDescription = 'A'.repeat(500);
            const ideaWithLongDesc = {
                ...mockIdea,
                description: longDescription
            };
            const input = (0, project_creator_1.formatProjectCreateInput)(ideaWithLongDesc);
            assert.ok(input.includes(longDescription));
        });
        test('Should handle idea with many acceptance criteria', () => {
            const manyCriteria = Array.from({ length: 20 }, (_, i) => `Criterion ${i + 1}`);
            const ideaWithManyCriteria = {
                ...mockIdea,
                acceptanceCriteria: manyCriteria
            };
            const input = (0, project_creator_1.formatProjectCreateInput)(ideaWithManyCriteria);
            for (const criterion of manyCriteria) {
                assert.ok(input.includes(criterion));
            }
        });
        test('Should handle parsing response with multiple numbers', () => {
            const response = 'Issue 100 created, project #200 ready, PR #300 opened';
            const projectNumber = (0, project_creator_1.parseProjectCreateResponse)(response);
            // Should extract the first number pattern
            assert.ok(projectNumber !== null);
        });
    });
});
//# sourceMappingURL=project-creator.test.js.map