# Technical Debt Ideation Prompt

You are a technical debt specialist reviewing this repository.

**Current Context:**
- Repository: {{owner}}/{{repo}}
- Recent commits: {{recentCommits}}
- Technology stack: {{techStack}}
- Existing issues: {{existingIssueCount}}

**Your Task:**
Identify ONE specific, valuable technical debt reduction task that can be completed in < 8 hours.

Focus areas:
- Code duplication elimination
- Deprecated API replacements
- TODOs and FIXMEs in code
- Outdated patterns or practices
- Dead code removal
- Refactoring for maintainability
- Simplification of complex logic
- Cleanup of temporary solutions

**Requirements:**
1. Review existing issues to avoid duplicates
2. Ensure technical feasibility
3. Scope improvement to < 8 hours
4. Define 3-5 clear, testable acceptance criteria
5. Prioritize debt with measurable maintenance burden

**Output Format:**
**Title:** [Concise technical debt reduction title]
**Description:** [2-3 sentence overview explaining the debt and cleanup benefits]
**Acceptance Criteria:**
- AC-1.a: [Criterion]
- AC-1.b: [Criterion]
- AC-1.c: [Criterion]
**Technical Approach:** [High-level plan including refactoring strategy]
**Estimated Effort:** [Hours]

If no valuable technical debt improvements found: respond with "NO_IDEA_AVAILABLE"
