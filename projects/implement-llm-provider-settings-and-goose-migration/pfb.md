# Product Feature Brief: LLM Provider Settings and Goose Migration

## 1. Feature Overview

| Attribute | Value |
|-----------|-------|
| **Feature Name** | LLM Provider Settings and Goose Migration |
| **Owner** | Development Team |
| **Status** | Proposed |
| **Target Release** | Q1 2026 |
| **Last Updated** | 2026-01-26 |

### Summary

Add a settings UI to the VSCode extension that allows users to choose between Claude Code and Goose as their LLM provider. Migrate all existing Claude custom slash commands to Goose's recipe and config.yaml format to ensure full functionality with both providers. This feature enables users to leverage Goose's open-source, extensible AI agent capabilities while maintaining seamless backward compatibility with existing Claude Code workflows.

---

## 2. Problem Statement

### What Problem Are We Solving?

Currently, the VSCode extension is tightly coupled to Claude Code as the only LLM provider. Users who prefer or require Goose (an open-source, extensible AI agent that supports multiple LLMs) have no way to use this extension with their preferred tooling. Additionally, organizations may have specific requirements around using open-source tools or self-hosted infrastructure that Claude Code doesn't support but Goose does.

### Who Is Affected?

- **Primary**: Developers who prefer Goose's open-source approach and extensibility
- **Secondary**: Organizations with policies requiring open-source tooling
- **Tertiary**: Development teams using both Claude Code and Goose in different contexts

### Why Now?

1. **Market Momentum**: Goose was contributed to the Linux Foundation's Agentic AI Foundation in December 2025, gaining significant traction
2. **User Demand**: Growing requests from users who want to use the extension with Goose
3. **Ecosystem Alignment**: With Goose, Anthropic's MCP, and OpenAI's AGENTS.md all under neutral governance, the AI agent ecosystem is converging
4. **Competitive Advantage**: Being the first GitHub Projects management extension to support multiple LLM providers differentiates us in the marketplace

---

## 3. Goals & Success Metrics

### Primary Goals

1. Enable users to choose between Claude Code and Goose as their LLM provider
2. Maintain 100% feature parity across both providers
3. Ensure seamless migration path for existing Claude Code users
4. Preserve all existing functionality without regression

### Success Metrics

| Metric | Target | Measurement Period |
|--------|--------|-------------------|
| Adoption rate of Goose provider option | 50% of active users try it | 30 days post-release |
| Zero regression in core functionality | 100% test pass rate | Continuous |
| Feature parity between providers | 90% equivalent functionality | At release |
| Provider switch time | < 2 seconds | Per operation |
| Backward compatibility | 100% existing projects work | Continuous |

### Key Results

- All existing custom slash commands (`/review-item`, `/review-phase`, `/review-project`, `/project-start`, `/project-create`) working with Goose recipes
- Settings UI integrated seamlessly into existing toolbar
- Per-workspace provider preference persistence
- Clear error messaging and installation guidance for missing dependencies

---

## 4. User Experience & Scope

### User Stories

**As a developer using Claude Code**, I want to continue using my existing workflows without any changes, so that I experience zero disruption.

**As a developer interested in Goose**, I want to switch to Goose provider through a simple settings UI, so that I can leverage its open-source capabilities.

**As a project manager**, I want all team members to be able to use their preferred LLM provider while collaborating on the same GitHub Projects, so that we don't fragment our workflows.

### In Scope

- **UI Changes**:
  - Add settings gear icon to the right of existing action buttons
  - Settings panel with "LLM Provider" dropdown (Claude Code/Goose)
  - Per-workspace provider preference storage

- **Provider Integration**:
  - Replace all direct Claude CLI calls with provider-abstracted calls
  - Implement Goose recipe equivalents for all custom commands
  - Create config.yaml templates for Goose configuration

- **Command Migration**:
  - `/review-item` → Goose recipe
  - `/review-phase` → Goose recipe
  - `/review-project` → Goose recipe
  - `/project-start` → Goose recipe
  - `/project-create` → Goose recipe

- **Error Handling**:
  - Detection of missing provider installations
  - Clear error messages with installation instructions
  - Graceful fallback messaging for unavailable features

### Out of Scope

- Support for additional LLM providers beyond Claude Code and Goose
- Custom model selection within each provider (use provider defaults)
- Provider-specific advanced settings beyond basic configuration
- Analytics/telemetry for provider usage (beyond basic logging)
- Real-time provider switching mid-session
- Multi-provider session management
- Provider performance benchmarking tools

### User Flow

```
1. User opens extension
2. User clicks settings gear icon
3. Settings panel opens with "LLM Provider" dropdown
4. User selects "Goose" (default: "Claude Code")
5. Extension validates Goose installation
   - If not installed: Show error with installation link
   - If installed: Save preference to workspaceState
6. User initiates project task (e.g., /project-start)
7. Extension invokes appropriate provider
   - Claude Code: Executes Claude CLI commands
   - Goose: Executes Goose recipes from config.yaml
8. Results displayed identically regardless of provider
```

---

## 5. Assumptions & Constraints

### Assumptions

1. Users have Goose installed locally if they choose that provider
2. Both providers support the same core functionality needed for GitHub Projects management
3. Session state is isolated per session (no switching mid-session)
4. Existing GitHub integration works identically with both providers
5. Goose recipe syntax remains stable across minor version updates
6. Users understand the difference between Claude Code and Goose
7. VSCode workspace storage is available for provider preferences

### Constraints

1. **Backward Compatibility**: Must maintain 100% backward compatibility with existing Claude Code projects
2. **Session Isolation**: Provider switch requires starting a new session (no mid-session switching allowed)
3. **Settings Persistence**: Settings persist per workspace (not globally) via `workspaceState` API
4. **Testing Requirements**: Must pass all existing integration tests with both providers before release
5. **No Breaking Changes**: Existing users should see zero changes unless they actively switch providers
6. **Error Handling**: Must gracefully handle provider unavailability without crashing extension
7. **VSCode Version**: Requires VSCode 1.96.0+ (current minimum version)

---

## 6. Risks & Mitigations

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Goose API changes breaking integration | High | Medium | Version lock Goose dependency; create abstraction layer |
| Provider switching mid-session causing state issues | High | Low | Enforce session restart on provider change |
| Different response formats between providers | Medium | High | Normalize responses through adapter pattern |
| Recipe syntax changes in future Goose versions | Medium | Medium | Document recipe version compatibility; test against multiple versions |
| Different error handling patterns | Low | High | Implement unified error handling wrapper |

### User Experience Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| User confusion about which provider to choose | Medium | High | Add tooltip with provider comparison; default to Claude Code |
| Goose not installed when selected | Medium | High | Show clear installation instructions with links |
| Feature unavailable in chosen provider | Low | Low | Mark unavailable features with clear messaging |
| Settings UI cluttering toolbar | Low | Medium | Use minimal gear icon; settings in modal panel |

### Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Increased support burden for two providers | Medium | High | Comprehensive documentation for both providers |
| Documentation maintenance for two providers | Medium | High | Automated documentation generation where possible |
| Fragmentation of user base | Low | Medium | Ensure feature parity; share best practices across providers |

---

## 7. Dependencies

### Technical Dependencies

| Dependency | Type | Status | Notes |
|-----------|------|--------|-------|
| Goose installation | External | User-managed | Required for Goose provider option |
| Goose recipe repository | External | Maintained | May need custom fork for extension-specific recipes |
| VSCode Extension API | Platform | Stable | workspaceState API for settings persistence |
| MCP server compatibility | Integration | Assumed | Must work with both providers |
| GitHub GraphQL API | Integration | Stable | Provider-agnostic |

### Internal Dependencies

| Dependency | Owner | Status | Notes |
|-----------|-------|--------|-------|
| Recipe templates for custom commands | Development Team | To create | All 5 custom commands need Goose recipes |
| Provider abstraction layer | Development Team | To implement | Clean interface for Claude/Goose calls |
| Settings UI components | Development Team | To design | Gear icon + modal panel |
| Workspace storage schema | Development Team | To define | Provider preference storage format |
| Integration test suite updates | Development Team | To update | Run tests against both providers |

### External Dependencies

| Dependency | Provider | SLA/Availability | Risk Level |
|-----------|----------|------------------|-----------|
| Goose CLI availability | Block/Linux Foundation | Open source, self-hosted | Low |
| Goose recipe syntax stability | Goose maintainers | Community-driven | Medium |
| Claude Code availability | Anthropic | Commercial SLA | Low |

---

## 8. Open Questions

### Resolved Questions

| Question | Answer | Decided By | Date |
|----------|--------|-----------|------|
| How should the extension handle switching providers mid-session? | Requires starting new session (cannot switch mid-session) | Product Team | 2026-01-26 |
| Should settings persist per workspace or globally? | Per workspace (stored in workspaceState) | Product Team | 2026-01-26 |
| What's the fallback behavior if Goose is selected but not installed? | Show error message with installation instructions | Product Team | 2026-01-26 |
| Should there be a migration assistant for existing Claude users? | Not in initial release (can be added later) | Product Team | 2026-01-26 |
| How should we handle provider-specific features that don't have equivalents? | Mark as unavailable with clear messaging | Product Team | 2026-01-26 |

### Outstanding Questions

| Question | Impact | Owner | Target Resolution |
|----------|--------|-------|------------------|
| What version of Goose should we target for compatibility? | Medium | Development Team | Week 1 |
| Should we maintain separate recipe repositories or fork Goose recipes? | Medium | Development Team | Week 1 |
| How do we handle Goose config.yaml conflicts with user's existing config? | Low | Development Team | Week 2 |
| Should settings gear icon be tooltip-enabled for first-time users? | Low | UX Team | Week 2 |
| Do we need telemetry to track provider usage (opt-in)? | Low | Product Team | Week 3 |

---

## 9. Non-Goals

The following are explicitly **NOT** goals for this feature:

### Not Included in Initial Release

- Building a custom LLM provider abstraction layer beyond basic interface
- Supporting local/self-hosted LLM models directly
- Real-time provider switching without session restart
- Provider performance benchmarking tools
- Multi-provider session management (using both simultaneously)
- Custom model selection UI within each provider
- Advanced provider configuration options (temperature, token limits, etc.)
- Provider-specific analytics dashboard
- Automated provider recommendation engine
- Cross-provider session migration tools

### Future Consideration (Post-V1)

- Migration assistant wizard for Claude → Goose users
- Support for additional providers (OpenAI, local models, etc.)
- Provider health monitoring and automatic fallback
- Usage analytics and provider performance comparison
- Shared recipe repository with community contributions
- Provider-specific optimization recommendations

### Permanently Out of Scope

- Removing Claude Code support (maintain both indefinitely)
- Building our own LLM provider
- Billing/licensing management for commercial providers
- Training custom models
- Provider vendor lock-in strategies

---

## 10. Notes & References

### Research References

- [Goose Configuration Files Documentation](https://block.github.io/goose/docs/guides/config-files/)
- [Goose GitHub Repository](https://github.com/block/goose)
- [Goose Overview - Z.AI Developer Document](https://docs.z.ai/devpack/tool/goose)
- [What Makes Goose Different From Other AI Coding Agents](https://dev.to/nickytonline/what-makes-goose-different-from-other-ai-coding-agents-2edc)
- [Building AI Agents with Goose and Docker](https://www.docker.com/blog/building-ai-agents-with-goose-and-docker/)

### Technical Notes

**Goose Recipe Structure:**
Goose recipes are YAML-based workflow definitions with actual capabilities, not just saved prompts. They can be invoked as custom slash commands when configured in config.yaml. The extension will need to:
1. Generate recipe files for all 5 custom commands
2. Create config.yaml template with command mappings
3. Provide installation/configuration instructions

**Provider Abstraction Pattern:**
```typescript
interface LLMProvider {
  name: 'claude' | 'goose';
  execute(command: string, args: any): Promise<Response>;
  isInstalled(): Promise<boolean>;
  getInstallationInstructions(): string;
}
```

**Settings Storage Schema:**
```typescript
interface WorkspaceSettings {
  llmProvider: 'claude' | 'goose';
  lastUpdated: string;
  version: string;
}
```

### Implementation Considerations

1. **Recipe Conversion Strategy**: Map each Claude command to equivalent Goose recipe structure
2. **Error Boundary**: Wrap all provider calls in try-catch with provider-specific error handling
3. **Config Management**: Extension should check for existing Goose config.yaml and merge settings, not overwrite
4. **Testing Strategy**: Parallel test suite execution against both providers in CI/CD
5. **Documentation**: Separate README sections for Claude Code and Goose setup instructions

### Related Features

- **Current State**: Extension fully integrated with Claude Code via custom slash commands
- **Related Projects**: Orchestration system already uses MCP servers (provider-agnostic)
- **Future Integration**: May extend to support Anthropic's MCP protocol directly

### Timeline Estimates

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Recipe development | 1 week | Goose documentation review |
| Provider abstraction layer | 1 week | Recipe completion |
| Settings UI implementation | 3 days | Design approval |
| Integration testing | 1 week | All components complete |
| Documentation | 3 days | Implementation complete |
| **Total** | **~3.5 weeks** | |

### Success Criteria Checklist

- [ ] Settings gear icon visible in toolbar
- [ ] LLM Provider dropdown functional with Claude Code/Goose options
- [ ] Provider preference persists across VSCode sessions
- [ ] All 5 custom commands work with Goose recipes
- [ ] Error handling for missing Goose installation
- [ ] Zero regression in existing Claude Code functionality
- [ ] All integration tests pass with both providers
- [ ] Documentation updated for both providers
- [ ] User adoption reaches 50% trial rate in 30 days

---

**Document Version**: 1.0
**Created**: 2026-01-26
**Last Modified**: 2026-01-26
**Status**: Proposed - Awaiting Approval
