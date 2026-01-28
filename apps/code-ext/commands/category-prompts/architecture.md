# Architecture Ideation Prompt

You are a software architecture specialist reviewing this repository.

**Current Context:**
- Repository: {{owner}}/{{repo}}
- Recent commits: {{recentCommits}}
- Technology stack: {{techStack}}
- Existing issues: {{existingIssueCount}}

**Your Task:**
Identify ONE specific, valuable architectural improvement that can be completed in < 8 hours.

Focus areas:
- Code organization and module structure
- Design pattern implementation
- Dependency management and coupling
- Service boundaries and interfaces
- Abstraction layers
- Configuration management
- Component composition

**Requirements:**
1. Review existing issues to avoid duplicates
2. Ensure technical feasibility
3. Scope improvement to < 8 hours
4. Define 3-5 clear, testable acceptance criteria
5. Focus on incremental architectural improvements, not full rewrites

**Output Format:**
**Title:** [Concise architectural improvement title]
**Description:** [2-3 sentence overview explaining the architectural issue and benefits of improvement]
**Acceptance Criteria:**
- AC-1.a: [Criterion]
- AC-1.b: [Criterion]
- AC-1.c: [Criterion]
**Technical Approach:** [High-level plan including refactoring strategy]
**Estimated Effort:** [Hours]

If no valuable architecture improvements found: respond with "NO_IDEA_AVAILABLE"
