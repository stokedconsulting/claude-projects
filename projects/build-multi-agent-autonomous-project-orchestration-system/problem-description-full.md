# Full Problem Description

each individual workspace can specify the number of concurrent agents it would like to assign.. each agent will work one gh project at a time.. once a project is done.. and code pushed to remote.. another agent should be assigned to review the completed project and validate that each project item's acceptance criteria has been met.. and that that new work meets a reasonable standard of quality.. anything that needs work should be worked on by the agent until they deem that the project is complete.. once there are no more projects left to work.. the agent should be given a pre canned prompt instructing them to examine the project and determine one of the following categories to choose from:

  - Optimization - Performance tuning, query optimization, asset optimization
  - Innovation - New features, experimental technologies, R&D
  - Architecture - System design, scalability patterns, service boundaries
  - Front End Improvements - UI/UX enhancements, responsive design, component refactoring
  - Back End Improvements - API design, service optimization, data layer enhancements
  - Security - Vulnerability patches, dependency audits, penetration testing, authentication/authorization hardening
  - Testing - Test coverage expansion, E2E tests, load testing, test automation
  - Documentation - Code documentation, API docs, architecture diagrams, runbooks, onboarding guides
  - Technical Debt - Refactoring, code cleanup, removing deprecated features, modernizing legacy code
  - Developer Experience (DX) - Tooling improvements, build optimization, local dev setup, debugging tools
  - Monitoring & Observability - Logging, metrics, alerting, tracing, dashboards
  - DevOps/Infrastructure - CI/CD pipelines, deployment automation, infrastructure as code, container optimization
  - Accessibility (a11y) - WCAG compliance, screen reader support, keyboard navigation, color contrast
  - Dependency Management - Package upgrades, security patches, compatibility checks, license compliance
  - Data Management - Schema migrations, backup strategies, data validation, archival policies
  - Internationalization (i18n) - Multi-language support, localization, currency/date formatting
  - Error Handling & Resilience - Better error messages, retry logic, circuit breakers, graceful degradation
  - Code Quality - Linting rules, formatting standards, code review processes, static analysis
  - Compliance & Governance - GDPR, SOC2, HIPAA, audit logging, data retention policies
  - Scalability - Load balancing, caching strategies, database sharding, horizontal scaling
  - API Evolution - Versioning, backwards compatibility, deprecation strategies, GraphQL/REST optimization

each of those categories will need a precanned prompt that will instruct an agent to come up with a project idea for this repo in the category type.. and the output of the agents idea.. will be passed to /project-create [agent idea].. then the next agent will pickup this project and implement it..

---
**Created:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Word Count:** 420 words
