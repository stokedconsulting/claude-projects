# Claude Code Prompts for Project Management

Complete collection of sample prompts demonstrating how to use Claude Code for managing Claude Projects. Each prompt shows the intended Claude action and expected response.

---

## Table of Contents

1. [Health Checks](#health-checks)
2. [Project Reading](#project-reading)
3. [Issue Listing](#issue-listing)
4. [Issue Creation](#issue-creation)
5. [Issue Updates](#issue-updates)
6. [Phase Management](#phase-management)
7. [Error Recovery](#error-recovery)
8. [Complex Workflows](#complex-workflows)
9. [Analysis and Reporting](#analysis-and-reporting)
10. [Batch Operations](#batch-operations)

---

## Health Checks

### Prompt 1: Verify API Connection

**Purpose**: Confirm Claude can connect to the state tracking API and authenticate

**Prompt:**
```
Check the health of the state tracking API. Verify connectivity and authentication.
```

**Expected Claude Action:**
- Calls `health_check` tool
- No parameters required

**Expected Response:**
```
The API is healthy and responding correctly:
- API Available: Yes
- Authenticated: Yes
- Response Time: 145ms
- API Version: 1.0.0

Your Claude Code integration is working properly!
```

### Prompt 2: Test All Tools

**Purpose**: Verify all MCP tools are available and discoverable

**Prompt:**
```
What project management tools do you have available? List all tools and briefly describe what each one does.
```

**Expected Claude Action:**
- Claude lists all 9 available tools with descriptions
- No tool calls needed (uses internal tool registry)

**Expected Response:**
```
I have access to the following Claude Projects management tools:

1. health_check - Verify API connectivity and authentication
2. read_project - Get complete project metadata, phases, and statistics
3. get_project_phases - List all phases in a project
4. list_issues - Query issues with status and phase filters
5. get_issue_details - Get detailed information about a specific issue
6. create_issue - Create new issues in a project
7. update_issue - Update multiple fields of an issue
8. update_issue_status - Change issue status (backlog, todo, in_progress, done)
9. update_issue_phase - Move issues between project phases

With these tools, I can help manage your GitHub Projects completely through Claude Code!
```

---

## Project Reading

### Prompt 3: Read Project Overview

**Purpose**: Get high-level project information

**Prompt:**
```
Read project 70 and give me a summary. Include:
1. Project title and description
2. Total number of issues
3. How many are completed vs in progress
4. URL to the project
```

**Expected Claude Action:**
- Calls `read_project` with projectNumber=70
- Extracts relevant fields from response

**Expected Response:**
```
Project 70 Summary:

Title: Claude Projects State Tracking
Description: Comprehensive state management system for GitHub Projects with real-time synchronization

Issue Statistics:
- Total Issues: 45
- Completed: 22 (48%)
- In Progress: 18 (40%)
- Backlog: 5 (12%)

URL: https://github.com/orgs/example/projects/70

The project is progressing well with approximately half of the work completed. Currently focusing on the development phase with 18 active items.
```

### Prompt 4: Get Project Phases

**Purpose**: List all phases and their completion status

**Prompt:**
```
Show me all the phases in project 70. For each phase, tell me the name, order, and current status.
```

**Expected Claude Action:**
- Calls `get_project_phases` with projectNumber=70
- Formats phase information clearly

**Expected Response:**
```
Project 70 Phases:

1. Phase 1: Planning (Status: Completed)
   - Initial planning and design phase

2. Phase 2: Development (Status: In Progress)
   - Core feature implementation

3. Phase 3: Testing (Status: Pending)
   - Quality assurance and testing

4. Phase 4: Documentation (Status: Pending)
   - Complete documentation and guides

5. Phase 5: Deployment (Status: Pending)
   - Production release and monitoring

Current Focus: Phase 2: Development
```

### Prompt 5: Compare Projects

**Purpose**: Get metrics for multiple projects at once

**Prompt:**
```
Read projects 70, 71, and 72. Show me a comparison table with:
- Project number and title
- Total issues in each
- Percentage complete
- Current phase
```

**Expected Claude Action:**
- Calls `read_project` three times (projects 70, 71, 72)
- Formats results in comparison table
- Notes: This demonstrates parallel/chained tool usage

**Expected Response:**
```
Project Comparison:

| Project | Title | Total Issues | Completed | Phase |
|---------|-------|--------------|-----------|-------|
| #70 | State Tracking | 45 | 48% | Phase 2 |
| #71 | VSCode Extension | 32 | 65% | Phase 3 |
| #72 | MCP Server | 28 | 75% | Phase 4 |

Project #72 (MCP Server) is furthest along, while #70 (State Tracking) needs more development effort.
```

---

## Issue Listing

### Prompt 6: List Issues by Status

**Purpose**: See what issues are in a specific status

**Prompt:**
```
Show me all "in progress" issues in project 70. Include issue number, title, and assignee.
```

**Expected Claude Action:**
- Calls `list_issues` with projectNumber=70, status="in_progress"
- Formats results as list with key fields

**Expected Response:**
```
In Progress Issues (Project 70):

#42 - Implement user authentication
   Assignee: alice

#43 - Add user profile page
   Assignee: bob

#44 - Database optimization
   Assignee: charlie

#45 - Setup CI/CD pipeline
   Assignee: alice

Total: 4 in-progress items
```

### Prompt 7: List Issues by Phase

**Purpose**: See what's in a specific phase

**Prompt:**
```
List all issues in "Phase 3: Testing" in project 70. Show me status breakdown.
```

**Expected Claude Action:**
- Calls `list_issues` with projectNumber=70, phase="Phase 3: Testing"
- Provides status breakdown
- Notes: Demonstrates phase filtering

**Expected Response:**
```
Phase 3: Testing Issues (Project 70):

Status Breakdown:
- Backlog: 3 issues
- Todo: 2 issues
- In Progress: 5 issues
- Done: 2 issues

Issues in Progress (5):
#50 - User auth testing
#51 - API endpoint tests
#52 - UI component testing
#53 - Integration testing
#54 - Performance testing

No critical blockers. Testing phase is on track.
```

### Prompt 8: Find Issues by Assignee

**Purpose**: See what one person is working on

**Prompt:**
```
Show me all issues assigned to alice in project 70. Group by status.
```

**Expected Claude Action:**
- Calls `list_issues` with projectNumber=70, assignee="alice"
- Groups results by status

**Expected Response:**
```
Issues Assigned to alice (Project 70):

In Progress (3):
#42 - Implement user authentication
#45 - Setup CI/CD pipeline
#60 - Security audit

Todo (2):
#61 - API documentation
#62 - Release notes

Done (1):
#32 - Migrate to NestJS

Total: 6 issues assigned to alice
Workload: Moderate (3 active, 2 planned)
```

### Prompt 9: Find Blocked Issues

**Purpose**: Identify issues needing attention

**Prompt:**
```
In project 70, show me all issues that are either:
1. In progress for more than 3 days without updates, or
2. Have "blocked" in the title or description
3. Or are in "backlog" with high priority

Give me actionable insights.
```

**Expected Claude Action:**
- Calls `list_issues` multiple times with different filters
- For backlog items, calls `get_issue_details` to check for priority
- Synthesizes results into actionable list

**Expected Response:**
```
Issues Requiring Attention (Project 70):

Potentially Stalled:
#44 - Database optimization
   Status: In Progress
   Insight: No updates in 4 days - may need help
   Recommendation: Check with charlie on blockers

High Priority Backlog:
#70 - Security hardening
   Status: Backlog
   Priority: High
   Recommendation: Schedule for next sprint

Blocked Items:
None currently identified

Next Actions:
1. Follow up with charlie on #44
2. Move #70 to Todo if capacity available
3. All others on track
```

---

## Issue Creation

### Prompt 10: Create Simple Issue

**Purpose**: Add a new task to the project

**Prompt:**
```
Create a new issue in project 70 with:
- Title: "Implement password reset functionality"
- Description: "Add email-based password reset with token validation"
```

**Expected Claude Action:**
- Calls `create_issue` with title and body
- Uses defaults for status (backlog) and phase

**Expected Response:**
```
Created issue #75: Implement password reset functionality

Details:
- Status: Backlog
- Phase: Unassigned
- URL: https://github.com/owner/repo/issues/75

The issue is ready to be worked on. You can now assign it, add labels, or move it to a specific phase.
```

### Prompt 11: Create Issue with Full Details

**Purpose**: Add a fully configured issue

**Prompt:**
```
In project 70, create a new issue:
- Title: "Setup monitoring and alerting"
- Description: "Add Prometheus metrics and Grafana dashboards for production monitoring"
- Phase: "Phase 4: Documentation" (wait, that's wrong - Phase 2: Development)
- Status: "todo"
- Assign to: "devops-team"
- Labels: ["infrastructure", "monitoring", "production"]
```

**Expected Claude Action:**
- Calls `create_issue` with all provided parameters
- Corrects phase if user made error
- Creates with specified configuration

**Expected Response:**
```
Created issue #76: Setup monitoring and alerting

Configuration:
- Status: Todo
- Phase: Phase 2: Development
- Assignee: devops-team
- Labels: infrastructure, monitoring, production
- URL: https://github.com/owner/repo/issues/76

The issue is now in the Dev backlog and assigned to the DevOps team. It's ready to start when they have capacity.
```

### Prompt 12: Create Multiple Related Issues

**Purpose**: Add a suite of related tasks

**Prompt:**
```
In project 70, create 4 related issues for API authentication:

1. "API Key Generation Service" - in Phase 2, assigned to backend-dev
2. "API Key Validation Middleware" - in Phase 2, assigned to backend-dev
3. "API Rate Limiting" - in Phase 2, assigned to backend-dev
4. "API Documentation" - in Phase 4, assigned to docs-team

Mark them all "todo" and label them "api-auth"
```

**Expected Claude Action:**
- Calls `create_issue` 4 times with specified parameters
- Executes in sequence to create all issues
- Notes issue numbers created

**Expected Response:**
```
Created 4 related issues for API authentication:

Backend Development (#77-#79):
#77 - API Key Generation Service
#78 - API Key Validation Middleware
#79 - API Rate Limiting

All assigned to backend-dev, status: todo, label: api-auth

Documentation (#80):
#80 - API Documentation
Assigned to docs-team, status: todo, label: api-auth

All issues are ready. The backend team can start with #77, which is a prerequisite for #78 and #79.
```

---

## Issue Updates

### Prompt 13: Update Single Issue Status

**Purpose**: Mark work as complete

**Prompt:**
```
I just finished issue #42 "Implement user authentication". Mark it as done.
```

**Expected Claude Action:**
- Calls `update_issue_status` with issueNumber=42, status="done"

**Expected Response:**
```
Updated issue #42: Implement user authentication
Status: in_progress → done

The issue is now marked as complete. If there are tests or documentation related to this feature, those can be moved forward.
```

### Prompt 14: Update to In Progress

**Purpose**: Mark issue as actively being worked on

**Prompt:**
```
I'm starting work on issue #43 "Add user profile page". Mark it as in_progress.
```

**Expected Claude Action:**
- Calls `update_issue_status` with issueNumber=43, status="in_progress"

**Expected Response:**
```
Updated issue #43: Add user profile page
Status: todo → in_progress

The issue is now active. Great! Feel free to ask me for help or updates as you work on it.
```

### Prompt 15: Update Multiple Fields

**Purpose**: Change multiple aspects of an issue at once

**Prompt:**
```
Update issue #44 "Database optimization":
- Change status to "in_progress"
- Assign to: "charlie"
- Add labels: "performance", "database", "critical"
- Update description to include: "Target: 50% query time reduction"
```

**Expected Claude Action:**
- Calls `update_issue` with multiple parameters
- status, assignee, labels, body fields

**Expected Response:**
```
Updated issue #44: Database optimization

Changes:
✓ Status: todo → in_progress
✓ Assignee: unassigned → charlie
✓ Labels: added [performance, database, critical]
✓ Description: updated with performance target

Charlie is now actively working on this critical performance issue. The clear goal of 50% query time reduction is documented.
```

### Prompt 16: Bulk Update Issue Statuses

**Purpose**: Mark multiple issues as done

**Prompt:**
```
I completed several issues. Mark these as done:
- Issue #50: User auth testing
- Issue #51: API endpoint tests
- Issue #52: UI component testing

And update their phase to "Phase 4: Documentation" since testing is complete.
```

**Expected Claude Action:**
- Calls `update_issue_status` for each issue (3 calls)
- Calls `update_issue_phase` for each issue (3 calls)
- Notes: Demonstrates sequential bulk operations

**Expected Response:**
```
Updated 3 issues:

#50 - User auth testing
✓ Status: in_progress → done
✓ Phase: Phase 3: Testing → Phase 4: Documentation

#51 - API endpoint tests
✓ Status: in_progress → done
✓ Phase: Phase 3: Testing → Phase 4: Documentation

#52 - UI component testing
✓ Status: in_progress → done
✓ Phase: Phase 3: Testing → Phase 4: Documentation

Great progress! Three test items are complete and ready for documentation.
```

---

## Phase Management

### Prompt 17: Move Issue to Next Phase

**Purpose**: Progress work through project phases

**Prompt:**
```
Move issue #45 "Setup CI/CD pipeline" from Phase 2: Development to Phase 3: Testing.
```

**Expected Claude Action:**
- Calls `update_issue_phase` with issueNumber=45, phase="Phase 3: Testing"

**Expected Response:**
```
Updated issue #45: Setup CI/CD pipeline
Phase: Phase 2: Development → Phase 3: Testing

The CI/CD infrastructure is ready for testing. The testing team can now validate the pipeline setup.
```

### Prompt 18: Phase Progression Summary

**Purpose**: Understand which issues to move next

**Prompt:**
```
In project 70:
1. Show me all issues in "Phase 2: Development" with status "done"
2. For each one, tell me which is the recommended next phase
3. Suggest the order to move them
```

**Expected Claude Action:**
- Calls `get_project_phases` to understand phase flow
- Calls `list_issues` with phase="Phase 2: Development", status="done"
- Provides sequencing recommendation

**Expected Response:**
```
Completed Development Work Ready to Move:

#42 - Implement user authentication
   Recommended Next: Phase 3: Testing
   Reason: Core feature needs QA validation

#43 - Add user profile page
   Recommended Next: Phase 3: Testing
   Reason: Feature complete, requires UI testing

#45 - Setup CI/CD pipeline
   Recommended Next: Phase 3: Testing
   Reason: Infrastructure testing before production

Recommended Order:
1. Move #45 first (dependencies: none)
2. Move #42 next (depends on testing infrastructure)
3. Move #43 after #42 (depends on auth being tested)

This sequence ensures testing infrastructure is ready before testing features that depend on it.
```

### Prompt 19: Complete Phase Graduation

**Purpose**: Mark all issues in a phase as done and understand readiness

**Prompt:**
```
Phase 1: Planning is complete. Show me:
1. What was planned vs what was delivered
2. Any blockers that should be noted for Phase 2
3. When Phase 2 actually started
4. Recommend moving Phase 1 issues to archive
```

**Expected Claude Action:**
- Calls `list_issues` with phase="Phase 1: Planning"
- Analyzes statuses and timestamps
- Provides completion summary

**Expected Response:**
```
Phase 1: Planning Completion Summary:

Planning Items Delivered: 12/13 (92%)
- ✓ Architecture design
- ✓ API specification
- ✓ Database schema
- ✓ User stories
- ✗ Risk analysis (pending - low priority)

Phase Transition:
- Phase 1 started: Jan 1, 2026
- Phase 1 completed: Jan 15, 2026
- Phase 2 started: Jan 10, 2026 (overlap is normal)
- Duration: 15 days

Blockers to Note:
None identified. Clean transition to Phase 2.

Recommendation:
Phase 1 is ready to be archived. All critical planning items are documented and Phase 2 development is progressing well.
```

---

## Error Recovery

### Prompt 20: Handle Invalid Project Number

**Purpose**: Demonstrate error handling

**Prompt:**
```
Read project 99999.
```

**Expected Claude Action:**
- Calls `read_project` with projectNumber=99999
- Receives 404 error
- Provides helpful error recovery

**Expected Response:**
```
I encountered an error: Project #99999 not found

This could happen because:
1. The project number is incorrect (maybe you meant #70, #71, or #72?)
2. The project has been deleted
3. Your API key doesn't have access to the project

Could you verify the project number? If you need to see all projects you have access to, I can help with that too.
```

### Prompt 21: Recover from API Timeout

**Purpose**: Demonstrate timeout handling with retry

**Prompt:**
```
List all issues in project 70. (Assume the API is slow)
```

**Expected Claude Action:**
- Calls `list_issues` with projectNumber=70
- If timeout occurs (after 10s), automatically retries
- Responds with results or error after retries exhausted

**Expected Response (on success after retry):**
```
Found 45 issues in project 70:

[Lists issues...]

Note: The API was slow to respond but recovered after retry. If you consistently see slow responses, please check the API status or contact your administrator.
```

**Expected Response (on persistent timeout):**
```
The API request timed out after 3 retry attempts. This typically means:

1. The API server is overloaded
2. Your network connection is slow
3. Project 70 is very large and takes too long to load

Options:
1. Try again in a few minutes
2. Use filters to query specific statuses/phases instead of all issues
3. Check API status page for outages

Would you like me to try a filtered query instead?
```

### Prompt 22: Handle Authentication Error

**Purpose**: Demonstrate API key validation

**Prompt:**
```
Check the API health. (Assume API key is invalid)
```

**Expected Claude Action:**
- Calls `health_check` tool
- Receives 401 Unauthorized error
- Provides clear recovery steps

**Expected Response:**
```
Authentication failed: Invalid or expired API key

The state tracking API rejected the authentication. This means:

1. The API key may have expired (they rotate regularly)
2. The configuration has the wrong key
3. The key doesn't have necessary permissions

Steps to fix:
1. Contact your administrator for a new API key
2. Update the configuration in Claude Code settings
3. Restart Claude Desktop
4. Try again

Once you have a new API key, I'll be able to access all project management tools.
```

### Prompt 23: Handle Rate Limiting

**Purpose**: Demonstrate backoff behavior

**Prompt:**
```
Create 50 new issues in project 70. (Assume hitting rate limits)
```

**Expected Claude Action:**
- Starts creating issues
- Hits rate limit (429 Too Many Requests)
- Implements exponential backoff
- Resumes creation when safe

**Expected Response:**
```
Creating 50 issues in project 70...

[Creates issues 1-10]

Rate limit encountered at issue #11. Backing off and retrying...

[Pauses for ~2 seconds]

[Creates issues 11-20]

Rate limit encountered again. Using longer backoff...

[Pauses for ~4 seconds]

[Creates issues 21-50]

Successfully created all 50 issues!

Summary:
- Total created: 50
- Retry count: 2
- Backoff timing: Exponential (1s → 2s → 4s)

Note: The API rate limits are in effect to protect the service. This is normal and expected behavior.
```

---

## Complex Workflows

### Workflow 1: Full Issue Lifecycle

**Purpose**: Track an issue from creation through completion

**Prompt:**
```
Walk me through the complete lifecycle of a new issue in project 70:

1. Create a new issue titled "Add dark mode support"
2. Assign it to alice and set it to Phase 2: Development, status: todo
3. After it's created, pretend I started working on it: mark it as in_progress
4. Assume development took 2 days and is complete: mark it as done
5. Move it to Phase 3: Testing
6. After testing (assume passed): move it to Phase 4: Documentation
7. After documentation: mark it as done in Phase 4

Show me each step and the final state.
```

**Expected Claude Action:**
- Sequential tool calls showing lifecycle progression
- Creates issue, updates status, updates phase multiple times
- Demonstrates workflow orchestration

**Expected Response:**
```
Full Issue Lifecycle - "Add dark mode support"

Step 1: Created issue
#81 - Add dark mode support
Status: Backlog → Todo
Phase: Unassigned → Phase 2: Development
Assignee: Unassigned → alice

Step 2: Started development
#81 - Add dark mode support
Status: Todo → In Progress

Step 3: Development complete
#81 - Add dark mode support
Status: In Progress → Done

Step 4: Moved to testing
#81 - Add dark mode support
Phase: Phase 2: Development → Phase 3: Testing

Step 5: Testing passed
(No status change - already marked done)

Step 6: Moved to documentation
#81 - Add dark mode support
Phase: Phase 3: Testing → Phase 4: Documentation

Final State:
- Issue #81: Add dark mode support
- Status: Done
- Phase: Phase 4: Documentation
- Assignee: alice
- Timeline: 2 days from start to finish

This represents a normal feature workflow through the project phases.
```

### Workflow 2: Sprint Planning

**Purpose**: Prepare a sprint/phase with issues

**Prompt:**
```
Let's plan Phase 2: Development work.

1. Show me all current issues in "Phase 2: Development" that are "todo" or "backlog"
2. For each issue without an assignee, suggest who should work on it based on the title
3. Create 3 new issues that I tell you about:
   - "Add email notifications" (assign to alice, 5 story points)
   - "Implement caching layer" (assign to charlie, 8 story points)
   - "Add audit logging" (assign to bob, 3 story points)
4. Show me the complete Phase 2: Development plan with work distribution
```

**Expected Claude Action:**
- Lists current Phase 2 issues
- Suggests assignments (backend/frontend/devops)
- Creates 3 new issues
- Provides summary with work distribution

**Expected Response:**
```
Phase 2: Development Planning

Current Unstarted Issues (5):
#35 - User authentication (suggested: backend-dev)
#36 - Password reset flow (suggested: backend-dev)
#40 - Frontend dashboards (suggested: frontend-dev)
#41 - API documentation (suggested: docs-team)
#44 - Database optimization (suggested: devops-team)

New Issues Created:
#82 - Add email notifications (alice, 5 pts)
#83 - Implement caching layer (charlie, 8 pts)
#84 - Add audit logging (bob, 3 pts)

Complete Phase 2 Workload:
Backend Dev (alice, charlie):
  #35 - User authentication (8pts)
  #36 - Password reset flow (5pts)
  #82 - Email notifications (5pts)
  #83 - Caching layer (8pts)
  Total: 26 story points

Frontend Dev (bob):
  #40 - Frontend dashboards (8pts)
  #84 - Audit logging (3pts)
  Total: 11 story points

DevOps/Docs:
  #41 - API documentation (3pts)
  #44 - Database optimization (8pts)
  Total: 11 story points

Grand Total: 48 story points across Phase 2

Status: Phase ready for execution. Work is well-distributed across the team.
```

### Workflow 3: Project Milestone Review

**Purpose**: Check project health at a milestone

**Prompt:**
```
Give me a project milestone review for project 70:

1. What's our overall progress percentage?
2. Which phase are we currently in?
3. How many issues are blocked or at risk?
4. What's the burndown rate (issues completed per day)?
5. If we keep this pace, when will we finish?
6. Any recommendations for improvement?
```

**Expected Claude Action:**
- Calls read_project for metadata and counts
- Calls list_issues with various filters for analysis
- Performs calculations on timing/burndown
- Synthesizes recommendations

**Expected Response:**
```
Project 70 Milestone Review

Overall Progress:
- Completed: 22/45 issues (49%)
- In Progress: 18/45 issues (40%)
- Backlog: 5/45 issues (11%)
- Status: On Track

Current Phase:
Phase 2: Development (of 5 total phases)
- Estimated Phase Completion: Jan 25, 2026
- Actual Progress: 12/18 items done (67%)

Risk Assessment:
- Blocked Issues: 0
- Issues at Risk: 2 (#44 database optimization, #50 user testing)
- Overall Health: Good

Burndown Analysis:
- Start Date: Jan 1, 2026
- Issues Completed to Date: 22
- Days Elapsed: 20
- Daily Rate: 1.1 issues/day
- Remaining Issues: 23
- Projected Completion: 21 days from now (Feb 10, 2026)

Recommendations:
1. Monitor issues #44 and #50 closely - assign resources
2. Current pace is healthy - maintain momentum
3. Consider starting Phase 3 items soon to avoid bottlenecks
4. Schedule Phase 4 resources now (documentation prep)

Next Review: Jan 25, 2026 (when Phase 2 completes)
```

---

## Analysis and Reporting

### Prompt 24: Team Workload Report

**Purpose**: Understand who's busy with what

**Prompt:**
```
Generate a team workload report for project 70:

For each person assigned issues:
1. How many issues do they have (active vs done)?
2. What percentage of project work is theirs?
3. Are they overloaded, on track, or underutilized?
4. Recommend workload rebalancing if needed
```

**Expected Claude Action:**
- Calls `list_issues` with different assignee filters
- Analyzes workload distribution
- Provides recommendations

**Expected Response:**
```
Project 70 Team Workload Report

Team Member: alice
- Active Issues: 3 (issues #35, #42, #82)
- Completed: 5
- Total: 8 (18% of project)
- Status: On Track
- Capacity: Good

Team Member: bob
- Active Issues: 2 (issues #40, #84)
- Completed: 3
- Total: 5 (11% of project)
- Status: Underutilized
- Capacity: Available

Team Member: charlie
- Active Issues: 4 (issues #44, #50, #51, #83)
- Completed: 6
- Total: 10 (22% of project)
- Status: Overloaded
- Recommended Action: Move one item to bob

Team Member: devops-team
- Active Issues: 2 (infrastructure items)
- Completed: 2
- Total: 4 (9% of project)
- Status: On Track

Unassigned Issues: 18 (40% of project)

Workload Rebalancing Recommendation:
1. Assign 4-5 unassigned issues to bob (currently underutilized)
2. Move issue #83 (caching layer) from charlie to bob
3. This brings charlie to 9% and bob to 15-16%
4. Leaves charlie capacity for emergency support

Next Steps:
1. Discuss workload with team
2. Reassign issues as recommended
3. Review again on Jan 25, 2026
```

### Prompt 25: Dependency Report

**Purpose**: Understand what's blocking what

**Prompt:**
```
Create a dependency report for project 70. Show:

1. Which issues are dependencies for other issues (like user auth is needed for profile page)
2. Which issues have no dependencies and could start immediately
3. Critical path (longest chain of dependencies)
4. Bottleneck issues that many others depend on
```

**Expected Claude Action:**
- Analyzes issue titles and descriptions to infer dependencies
- Lists dependency chains
- Identifies critical path

**Expected Response:**
```
Project 70 Dependency Analysis

Critical Dependencies:
1. #42 - Implement user authentication
   Needed by: #43, #45, #60, #62
   Status: Done ✓
   Impact: Core feature, many dependents

2. #44 - Database optimization
   Needed by: #50, #51, #53
   Status: In Progress
   Impact: High - required for testing performance

3. #35 - User authentication (duplicate? merged?)
   Dependencies: #42 (related work)

No Blocking Issues Detected ✓

Independent Issues (can start anytime):
#41 - API documentation
#61 - Release notes
#70 - Security hardening
#75 - Password reset functionality
... (8 more independent issues)

Critical Path (longest dependency chain):
#44 (Database opt) → #50 (Auth test) → #51 (API test) → #52 (UI test) → Phase 4
Duration: ~5 days remaining
Status: On track for completion by Jan 25

Bottleneck Analysis:
#42 - Implement user authentication (4 dependent issues)
#44 - Database optimization (3 dependent issues)

Recommendation:
- Current bottlenecks are on the critical path and being actively worked
- No blocking dependencies identified
- Good parallelization of work across team
- Project structure is healthy
```

---

## Batch Operations

### Prompt 26: Bulk Issue Creation from Template

**Purpose**: Create many similar issues at once

**Prompt:**
```
In project 70, create comprehensive test coverage issues for Phase 3: Testing.

Create 12 issues following this pattern:
Component | Test Type | Module
----------|-----------|-------
API | Unit Tests | Authentication
API | Integration Tests | Authentication
API | E2E Tests | Authentication
UI | Unit Tests | Dashboard
UI | Integration Tests | Dashboard
UI | E2E Tests | Dashboard
Database | Query Tests | Schema
Database | Performance Tests | Schema
Infra | Load Tests | Services
Infra | Security Tests | Services
Docs | Example Tests | API Reference
Docs | Example Tests | User Guide

For each issue:
- Title: "[TestType] [Component] - [Module]"
- Assign to: qa-team
- Status: todo
- Phase: Phase 3: Testing
- Label: testing, qa
```

**Expected Claude Action:**
- Creates 12 issues with systematic naming
- Assigns all to qa-team
- Sets up testing phase backlog

**Expected Response:**
```
Created 12 Testing Phase Issues:

API Testing (#85-#87):
#85 - [Unit Tests] API - Authentication
#86 - [Integration Tests] API - Authentication
#87 - [E2E Tests] API - Authentication

UI Testing (#88-#90):
#88 - [Unit Tests] UI - Dashboard
#89 - [Integration Tests] UI - Dashboard
#90 - [E2E Tests] UI - Dashboard

Database Testing (#91-#92):
#91 - [Query Tests] Database - Schema
#92 - [Performance Tests] Database - Schema

Infrastructure Testing (#93-#94):
#93 - [Load Tests] Infrastructure - Services
#94 - [Security Tests] Infrastructure - Services

Documentation Testing (#95-#96):
#95 - [Example Tests] Docs - API Reference
#96 - [Example Tests] Docs - User Guide

All 12 issues assigned to qa-team, status: todo, phase: Phase 3: Testing

QA Team Testing Plan:
- Total test items: 12
- Estimated effort: 30-40 hours
- Recommended timeline: Jan 26 - Feb 2, 2026
- Team: qa-team

Ready for QA execution!
```

### Prompt 27: Bulk Status Update

**Purpose**: Mark many issues as done after a milestone

**Prompt:**
```
All of these issues are now complete. Mark them all as "done":

#42 - Implement user authentication
#43 - Add user profile page
#45 - Setup CI/CD pipeline
#48 - API rate limiting
#49 - User session management

Also move them all to Phase 4: Documentation.
```

**Expected Claude Action:**
- Calls `update_issue_status` for each issue (5 calls)
- Calls `update_issue_phase` for each issue (5 calls)
- Confirms all updates

**Expected Response:**
```
Updated 5 completed issues:

#42 - Implement user authentication
✓ Status: in_progress → done
✓ Phase: Phase 2: Development → Phase 4: Documentation

#43 - Add user profile page
✓ Status: in_progress → done
✓ Phase: Phase 2: Development → Phase 4: Documentation

#45 - Setup CI/CD pipeline
✓ Status: in_progress → done
✓ Phase: Phase 2: Development → Phase 4: Documentation

#48 - API rate limiting
✓ Status: in_progress → done
✓ Phase: Phase 2: Development → Phase 4: Documentation

#49 - User session management
✓ Status: in_progress → done
✓ Phase: Phase 2: Development → Phase 4: Documentation

Summary:
- Phase 2 Development: 17 items done (up from 12)
- Phase 4 Documentation: 5 new items to document
- Overall Progress: 27/45 items done (60%)

Excellent progress! Phase 2 development is nearing completion.
```

---

## Best Practices

### When Using Claude Code for Project Management

1. **Always verify project number** before operations (avoid typos)
2. **Use filters** when querying large projects (faster results)
3. **Chain related operations** for efficiency (create then update)
4. **Review critical changes** before confirming (especially bulk updates)
5. **Check health** if operations seem slow (API might be struggling)
6. **Group related issues** when creating (easier to manage)
7. **Keep descriptions clear** for future reference
8. **Regular phase reviews** to maintain project health

### Prompt Writing Tips

1. **Be specific** - Use exact issue numbers, project numbers
2. **State desired outcome** - "Mark as done" not "Update status"
3. **Provide context** - "I finished this task so..." explains intent
4. **Use natural language** - Claude understands intention
5. **Ask for summaries** - Get helpful insights along with actions
6. **Batch when possible** - Multiple operations are efficient
7. **Handle errors gracefully** - Ask Claude for suggestions

---

## Summary

This collection demonstrates the full range of Claude Code capabilities for project management:

- **Simple operations**: Check health, read projects, list issues
- **Creation workflows**: Create single or bulk issues
- **Update workflows**: Modify statuses, phases, assignees
- **Complex workflows**: Multi-step orchestration
- **Analysis**: Reporting, dependencies, workload
- **Error recovery**: Handling timeouts, auth issues, rate limits

Start with simple prompts and build to more complex workflows as you become comfortable with the tools!

---

For complete tool documentation, see [docs/api-reference.md](../docs/api-reference.md).

For setup instructions, see [docs/claude-code-setup.md](../docs/claude-code-setup.md).

For integration tests, see [tests/integration/claude-code-integration.test.ts](../tests/integration/claude-code-integration.test.ts).
