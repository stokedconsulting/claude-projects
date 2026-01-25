# Centralize GitHub CLI Through Unified Service Layer

## 1. Feature Overview
**Feature Name:** Centralized GitHub Service Layer
**Owner:** Engineering Team / Infrastructure
**Status:** Proposed
**Target Release:** TBD

### Summary
Create a unified service layer that centralizes all GitHub CLI interactions across the codebase. The service will expose GitHub operations through both an HTTP API (for the VSCode extension) and an MCP server (for Claude/LLM interactions), replacing scattered `gh` CLI command usage with a consistent, auditable, and maintainable architecture.

---

## 2. Problem Statement
### What problem are we solving?
Currently, GitHub CLI (`gh`) commands are scattered throughout the codebase in multiple locations:
- VSCode extension uses TypeScript GitHub API wrappers with VSCode auth
- Shell scripts use direct `gh` CLI commands via `child_process.exec`
- Project creation scripts use `gh` CLI for project and issue management
- No centralized error handling, logging, or rate limiting
- Difficult to audit GitHub operations
- Inconsistent authentication approaches
- Hard to test and mock GitHub interactions

### Who is affected?
- **Primary users:** Developers maintaining the codebase and extending GitHub integration features
- **Secondary users:**
  - Claude/LLM agents performing GitHub operations via automation
  - VSCode extension users experiencing GitHub integration issues
  - DevOps teams troubleshooting GitHub-related errors

### Why now?
- Growing complexity in GitHub integration features (projects, issues, automation)
- Need for MCP server to expose GitHub operations to Claude
- Reliability issues with scattered `gh` CLI calls
- Difficulty adding new GitHub features consistently
- Strategic need for better observability and auditability of GitHub operations

---

## 3. Goals & Success Metrics
### Goals
- Centralize all GitHub CLI interactions through a unified service
- Provide consistent API for both extension UI and LLM/Claude access
- Improve reliability, testability, and observability of GitHub operations
- Enable gradual migration without breaking existing functionality

### Success Metrics (How we'll know it worked)
- **Code Centralization:** 100% of GitHub CLI interactions routed through unified service (baseline: scattered across 5+ files → target: single service layer)
- **API Reliability:** Service uptime > 99.5% (baseline: TBD → target: 99.5%+)
- **Performance:** API response time < 500ms for 95th percentile operations (baseline: TBD → target: <500ms)
- **Error Reduction:** 50% reduction in GitHub-related bugs/errors (baseline: current bug count → target: 50% reduction)
- **Auditability:** 100% of GitHub operations logged with operation type, user, timestamp, and outcome
- **Test Coverage:** >80% code coverage for service layer

---

## 4. User Experience & Scope
### In Scope
- **GitHub Projects v2 Operations:**
  - Create, update, list projects
  - Link/unlink projects to repositories
  - Manage project items (add, remove, update fields)

- **GitHub Issues Operations:**
  - Create, update, close, list issues
  - Link issues to projects
  - Update issue fields (status, labels, assignees)

- **Repository & Organization Queries:**
  - Get repository information
  - List organization projects
  - Query repository-linked projects

- **Service Components:**
  - HTTP REST API (NestJS) for extension access
  - MCP Server for Claude/LLM access
  - Unified GitHub client wrapper
  - Authentication abstraction layer
  - Logging and error handling middleware

- **Migration Path:**
  - Gradual migration strategy
  - Backward compatibility during transition
  - Documentation for developers

### Out of Scope
- Pull Request operations (create, merge, review) - future enhancement
- Repository management (create repos, update settings) - future enhancement
- GitHub Actions/Workflows management - future enhancement
- Releases and deployment operations - future enhancement
- Webhooks and event subscriptions - future enhancement
- Real-time GitHub event streaming - future enhancement

---

## 5. Assumptions & Constraints
### Assumptions
- GitHub API rate limits are sufficient for anticipated usage patterns
- VSCode authentication can be translated to PAT tokens for API calls
- MCP server will run as a separate process/service
- Developers have appropriate GitHub permissions (read:org, read:project, project scopes)
- Existing shell scripts can be migrated incrementally

### Constraints
**Technical:**
- Must maintain backward compatibility during migration period
- GitHub GraphQL API limitations (some operations only available via REST)
- Rate limiting: 5,000 requests/hour for authenticated users
- Token scopes must be carefully managed for security

**Legal / Compliance:**
- GitHub tokens must never be stored in code or version control
- Must comply with GitHub's Terms of Service for API usage
- Audit logging required for compliance with organizational policies

**Timeline:**
- TBD - to be determined during PRD and planning phase

**Resources:**
- Development effort: TBD
- Infrastructure: NestJS API already exists, needs extension
- No additional third-party services required

---

## 6. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API rate limits exceeded | Service degradation, failed operations | Implement request queuing, rate limiting, caching, and exponential backoff |
| Breaking changes during migration | Broken workflows, developer disruption | Gradual migration with feature flags, extensive testing, maintain backward compatibility |
| Authentication token exposure | Security breach, unauthorized access | Use environment variables, VSCode secrets API, never log tokens, implement token rotation |
| Service downtime affects multiple systems | Extension and automation failures | Build with high availability, implement fallback mechanisms, comprehensive monitoring |
| GraphQL API changes by GitHub | Service breakage | Version API client, monitor GitHub changelogs, implement adapter pattern for flexibility |
| Performance degradation with centralized service | Slower operations, poor UX | Implement caching, optimize queries, use connection pooling, monitor performance metrics |

---

## 7. Dependencies
**Team Dependencies:**
- Infrastructure team for API deployment and monitoring
- Extension development team for migration of VSCode extension
- Documentation team for developer guides

**External Systems / Vendors:**
- GitHub API (GraphQL and REST)
- GitHub CLI (during transition period)
- VSCode authentication API
- MCP (Model Context Protocol) specification

**Data or Infrastructure Dependencies:**
- NestJS API infrastructure (already exists)
- Environment variable management for tokens
- Logging infrastructure for audit trail
- Monitoring/alerting infrastructure

---

## 8. Open Questions
- What is the expected request volume per hour? (Need for capacity planning)
- Should we support multiple GitHub accounts/organizations simultaneously?
- What is the priority order for migrating existing components?
- Do we need webhooks for real-time project/issue updates in the future?
- Should the MCP server be a separate microservice or integrated into the NestJS API?
- What monitoring and alerting tools should we integrate with?
- How should we handle GitHub API deprecations and version upgrades?

---

## 9. Non-Goals
Explicitly state what success does **not** require:
- Complete feature parity with GitHub CLI (only implementing needed operations)
- Support for all GitHub API endpoints
- Real-time streaming of GitHub events
- Complex workflow automation (like GitHub Actions)
- Multi-tenant support for different GitHub instances (GitHub Enterprise)
- Custom GitHub App creation and management
- Advanced analytics or reporting dashboards
- Offline mode or local caching beyond basic request optimization

---

## 10. Notes & References
**Related Documentation:**
- GitHub GraphQL API: https://docs.github.com/en/graphql
- GitHub REST API: https://docs.github.com/en/rest
- Model Context Protocol: https://spec.modelcontextprotocol.io/
- VSCode Authentication API: https://code.visualstudio.com/api/references/vscode-api#authentication

**Existing Codebase References:**
- `apps/code-ext/src/github-api.ts` - Current GitHub GraphQL wrapper
- `apps/code-ext/src/github-project-creator.ts` - Uses `gh` CLI
- `examples/update-project.sh` - Shell script with `gh` commands
- `packages/api/` - NestJS API for state tracking (to be extended)

**Prior Art:**
- Octokit (GitHub's official SDK) - consider as implementation option
- Probot framework - for inspiration on GitHub API patterns

**Design Considerations:**
- Use dependency injection for testability
- Implement retry logic with exponential backoff
- Use TypeScript for type safety across all components
- Follow RESTful conventions for HTTP API
- Implement comprehensive error handling and logging
