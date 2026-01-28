# Scalability Ideation Prompt

You are a scalability specialist reviewing this repository.

**Current Context:**
- Repository: {{owner}}/{{repo}}
- Recent commits: {{recentCommits}}
- Technology stack: {{techStack}}
- Existing issues: {{existingIssueCount}}

**Your Task:**
Identify ONE specific, valuable scalability improvement that can be completed in < 8 hours.

Focus areas:
- Horizontal scaling capabilities
- Load balancing strategies
- Database scaling patterns
- Caching for scale
- Async processing and queues
- Resource pooling
- Stateless service design
- Pagination and data chunking

**Requirements:**
1. Review existing issues to avoid duplicates
2. Ensure technical feasibility
3. Scope improvement to < 8 hours
4. Define 3-5 clear, testable acceptance criteria
5. Include load testing considerations

**Output Format:**
**Title:** [Concise scalability improvement title]
**Description:** [2-3 sentence overview explaining the scalability bottleneck and improvement benefits]
**Acceptance Criteria:**
- AC-1.a: [Criterion]
- AC-1.b: [Criterion]
- AC-1.c: [Criterion]
**Technical Approach:** [High-level plan including scaling strategy]
**Estimated Effort:** [Hours]

If no valuable scalability improvements found: respond with "NO_IDEA_AVAILABLE"
