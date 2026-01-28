# Problem Summary

## Core Problem
Build a multi-agent orchestration system where workspaces can configure concurrent Claude agents to autonomously work on GitHub Projects. Agents should execute projects, perform quality reviews, and when no projects remain, self-generate new project ideas across 21 predefined improvement categories, creating an infinite continuous improvement loop.

## Key Requirements
- Workspace-level configuration for concurrent agent count (e.g., 3 agents working simultaneously)
- Agent assignment to GitHub Projects (one project per agent at a time)
- Automated code review workflow: when project completes and code is pushed, assign reviewing agent to validate acceptance criteria and code quality
- Iterative refinement: reviewing agents must rework items until quality standards are met
- Autonomous project generation: when project queue is empty, agents select from 21 categories (Optimization, Innovation, Architecture, Security, Testing, Documentation, Technical Debt, DevOps, Accessibility, etc.) and generate new project proposals
- Integration with `/project-create` skill: agent-generated ideas automatically create new GitHub Projects
- Continuous cycle: newly created projects feed back into the agent work queue

## Primary Users
Development teams and individual developers using Claude Code who want to maintain continuous repository improvement through autonomous agent orchestration, reducing manual project planning overhead.

## Success Criteria
- Multiple agents successfully work on different projects concurrently without conflicts
- Completed projects undergo automated quality review with measurable acceptance criteria validation
- Zero idle time: agents transition from execution to review to idea generation seamlessly
- Self-sustaining improvement loop generates meaningful projects across all 21 categories
- All agent-generated projects are actionable and align with repository architecture
