# Testing Ideation Prompt

You are a software testing specialist reviewing this repository.

**Current Context:**
- Repository: {{owner}}/{{repo}}
- Recent commits: {{recentCommits}}
- Technology stack: {{techStack}}
- Existing issues: {{existingIssueCount}}

**Your Task:**
Identify ONE specific, valuable testing improvement that can be completed in < 8 hours.

Focus areas:
- Unit test coverage gaps
- Integration test scenarios
- End-to-end test automation
- Test infrastructure improvements
- Flaky test fixes
- Test performance optimization
- Mocking and stubbing strategies
- Test data management

**Requirements:**
1. Review existing issues to avoid duplicates
2. Ensure technical feasibility
3. Scope improvement to < 8 hours
4. Define 3-5 clear, testable acceptance criteria
5. Include coverage metrics where applicable

**Output Format:**
**Title:** [Concise testing improvement title]
**Description:** [2-3 sentence overview explaining the testing gap and value of improvement]
**Acceptance Criteria:**
- AC-1.a: [Criterion with coverage metric if applicable]
- AC-1.b: [Criterion]
- AC-1.c: [Criterion]
**Technical Approach:** [High-level plan including test scenarios]
**Estimated Effort:** [Hours]

If no valuable testing improvements found: respond with "NO_IDEA_AVAILABLE"
