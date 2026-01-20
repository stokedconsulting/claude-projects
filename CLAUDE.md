# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo containing:
- **`apps/code-ext/`** - VSCode extension for GitHub Projects management
- **`packages/state-tracking-api/`** - NestJS API for Claude session state tracking
- **`examples/`** - Integration scripts and documentation

## Build Commands

### VSCode Extension (`apps/code-ext`)

```bash
cd apps/code-ext

# Install dependencies
pnpm install

# Development build
pnpm run build

# Watch mode (auto-rebuild on changes)
pnpm run watch

# Production build
pnpm run package

# Lint
pnpm run lint

# After building, reload VSCode window
# Cmd+Shift+P → "Developer: Reload Window"
```

### State Tracking API (`packages/state-tracking-api`)

```bash
cd packages/state-tracking-api

# Install dependencies
npm install

# Development mode (auto-reload)
npm run start:dev

# Production build
npm run build

# Run tests
npm test

# Deploy to AWS
npm run deploy
```

### Testing Review Commands

```bash
# Test review command installation
./examples/test-review-commands.sh

# Test update notification system
./examples/test-update.sh
```

## Development Rules

### Always Build After Code Changes

**CRITICAL**: Whenever you make changes to code files, you **MUST** run the build command before considering the task complete.

**For VSCode Extension changes:**
```bash
cd apps/code-ext
npm run compile
```

**Verification:**
- Check that the build completes successfully with `compiled successfully` message
- Fix any TypeScript errors before finishing
- Never leave the user with broken/unbuildable code

**Why this matters:**
- Catches TypeScript compilation errors immediately
- Prevents runtime errors from type mismatches
- Ensures code changes are valid before user tests them
- Saves debugging time by catching issues early

## Architecture Overview

### VSCode Extension Architecture

The extension follows a **webview-based architecture** with bidirectional communication:

**Core Components:**
1. **`extension.ts`** - Entry point, registers providers and commands, installs Claude commands to `~/.claude/commands/`
2. **`projects-view-provider.ts`** - Main controller managing webview, data fetching, and user actions
3. **`github-api.ts`** - GitHub GraphQL API client using VSCode authentication
4. **`cache-manager.ts`** - Workspace-scoped caching (5-minute TTL) stored in VSCode's `workspaceState`
5. **`claude-monitor.ts`** - File-based IPC for Claude session monitoring and auto-continuation
6. **`media/main.js`** - Frontend webview logic (vanilla JS, no framework)
7. **`media/style.css`** - Webview styling

**Data Flow:**
```
GitHub API (GraphQL)
  ↓ (fetch projects/items)
github-api.ts
  ↓ (transform)
projects-view-provider.ts
  ↓ (cache)
cache-manager.ts
  ↓ (postMessage)
media/main.js
  ↓ (render)
Webview UI
```

**Project Filtering Logic:**
- **Repo Projects**: Fetched via `getLinkedProjects(owner, repo)` - projects linked to current workspace repo
- **Org Projects**: Fetched via `getOrganizationProjects(owner)` - all org projects, then filtered to exclude repo-linked ones
- **UI Toggle**: `state.showOrgProjects` controls visibility (true = org view, false = repo view)
- **Critical**: Projects are marked with `isRepoLinked` boolean, and `toggleOrgProjectsVisibility()` filters display accordingly

### Phase-Based Organization

The extension uses a **hierarchical phase system** defined in `phase-logic.ts`:

**Phase Master Items:**
- Titles matching patterns: `[Phase N]`, `(Phase N)`, `Phase N:`, or containing `MASTER`
- Represent entire phases (e.g., "[Phase 1] Database Schema")

**Work Items:**
- Titles matching patterns: `[PN-WX]` (e.g., `[P1-W1]`), `(Phase N.M)`, `[PN.M]`, or `(N.M)`
- Grouped under their parent phase
- Decimal notation indicates sub-tasks (e.g., Phase 1.1 = Phase 1, Work Item 1)

**Auto-Status Updates:**
- Phase masters auto-update status based on work item completion
- Logic in `calculatePhaseStatus()`: all work items done → master becomes "Done"
- Implemented during `processProjectList()` in projects-view-provider.ts

### Claude Integration & Session Monitoring

**File-Based IPC via Signal Files:**
- Location: `.claude-sessions/{session_id}.signal`
- Format: JSON with state (`responding`, `stopped`, `idle`) and optional `project_update` events
- `claude-monitor.ts` watches signal files and triggers extension refresh on project updates

**Auto-Continuation:**
- Monitors response files (`.claude-sessions/{session_id}.response.md`) for completion
- Sends continuation prompts after 10-second delay when Claude stops
- 2-minute cooldown between continuation attempts
- Integrates with `examples/claude-session-wrapper.sh` for seamless session management

**Session Types:**
1. **Execution sessions** - `/project-start` command, works on existing projects
2. **Creation sessions** - `/project-create` command, creates new GitHub projects

### Cache Management

**Storage:**
- Per-workspace cache using VSCode's `workspaceState` API
- Location: `~/Library/Application Support/Code/User/workspaceStorage/[workspace-id]/state.vscdb` (macOS)
- Key format: `ghProjects.cache.{owner}.{repo}`

**Cache Strategy:**
- **TTL**: 5 minutes (stale after expiry, but still shown while refreshing)
- **Versioning**: Cache includes version number, auto-invalidates on version mismatch
- **Validation**: Checks owner/repo match before serving cache
- **Diff Detection**: Uses `diff-calculator.ts` to detect changes and avoid unnecessary re-renders

### GitHub API Integration

**Authentication:**
- Uses VSCode's built-in GitHub authentication (`vscode.authentication.getSession`)
- Required scopes: `repo`, `read:org`, `read:project`, `project`

**GraphQL Queries:**
- **Repo-linked projects**: Query repository's `projectsV2` field
- **Org projects**: Query organization's `projectsV2` field
- **Project items**: Fetch via project ID, includes field values (Status, Phase, etc.)

**Project Linking:**
- `linkProjectToRepository()` - Links org project to repo via `linkProjectV2ToRepository` mutation
- `unlinkProjectFromRepository()` - Removes link via `unlinkProjectV2FromRepository` mutation
- Extension automatically moves projects between views after link/unlink

## Common Development Workflows

### Fixing Project Filtering Issues

If projects appear in wrong view (org vs repo):
1. Check `toggleOrgProjectsVisibility()` in `media/main.js` - this controls visibility
2. Verify `isRepoLinked` flag is correctly set in `renderAllProjects()`
3. Check deduplication logic in `loadData()` - removes projects appearing in both lists
4. Debug via Output panel: View → Output → Claude Projects (shows raw project lists)

### Adding New GitHub Project Fields

1. Update GraphQL query in `github-api.ts` to fetch the field
2. Add field to `ProjectItem` interface
3. Update `processProjectList()` in `projects-view-provider.ts` to process field
4. Modify `createProjectElement()` in `media/main.js` to display field
5. Rebuild: `pnpm run build`

### Modifying Webview UI

**Frontend files are NOT bundled by webpack:**
- `media/main.js` - Copied as-is, no transpilation
- `media/style.css` - Copied as-is
- Changes require: `pnpm run build` then "Reload Window"

**Communication Pattern:**
```javascript
// Frontend → Extension
vscode.postMessage({ type: 'actionName', ...data });

// Extension → Frontend (in projects-view-provider.ts)
this._view.webview.postMessage({ type: 'eventName', ...data });
```

### Testing Review Commands

The repo includes three hierarchical review commands:
- **`/review-item`** - Review individual issue (e.g., `/review-item 72 1.1`)
- **`/review-phase`** - Review all items in phase using parallel agents (e.g., `/review-phase 72 1`)
- **`/review-project`** - Full project review with executive summary (e.g., `/review-project 72`)

Commands are auto-installed to `~/.claude/commands/` on extension activation.

## Important Patterns

### Error Handling in Extension

- All GitHub API errors are caught and sent to webview via `postMessage({ type: 'error' })`
- Cache failures are logged but don't block data fetching (graceful degradation)
- Authentication failures show VSCode error messages with actionable prompts

### State Management in Webview

```javascript
// State persisted across webview reloads
const state = vscode.getState() || {
    expandedProjects: {},
    expandedPhases: {},
    showCompleted: false,
    showOrgProjects: true  // Toggle between org/repo view
};

// Always save after state changes
vscode.setState(state);
```

### Project Update Notifications

When Claude completes tasks, `examples/update-project.sh` should be called:
```bash
# Close issue and notify extension
./examples/update-project.sh --close-issue 5 --project 70

# Update status and notify
./examples/update-project.sh --issue 5 --status "Done" --project 70
```

This writes a signal file that triggers automatic extension refresh.

## Debugging

### Extension Debugging
- Open Debug panel (Cmd+Shift+D)
- Select "Run Extension" configuration
- Press F5 to launch Extension Development Host
- Set breakpoints in TypeScript files
- Console logs appear in Debug Console

### Webview Debugging
- In Extension Development Host, open Command Palette
- Run "Developer: Open Webview Developer Tools"
- Inspect `media/main.js` execution, DOM, and network requests
- `console.log()` statements appear in webview DevTools, not main console

### GitHub API Debugging
- Enable verbose logging in Output panel: View → Output → Claude Projects
- Check raw responses in `this._outputChannel.appendLine()`
- Test queries directly with `gh api graphql` command

### Cache Debugging
- Clear cache via toolbar button (trash icon) in extension panel
- Check cache keys: stored in `ExtensionContext.workspaceState`
- Cache age displayed in UI when serving stale data

## Requirements

- **VSCode**: 1.96.0+
- **GitHub CLI**: Authenticated (`gh auth status`)
- **Claude Code**: Installed for `/review-*` and `/project-*` commands
- **Node.js**: 18+ (for API development)
- **pnpm**: For extension development (monorepo workspace)
