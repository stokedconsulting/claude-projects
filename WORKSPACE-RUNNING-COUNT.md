# Workspace Running Count Feature

## Overview

Added functionality to track and display the number of Claude processes currently running from the workspace (including worktrees). The count updates automatically every 10 seconds and is displayed in the VSCode extension sidebar under "Workspace Running".

## Implementation

### 1. ClaudeMonitor Changes (`apps/code-ext/src/claude-monitor.ts`)

Added three new methods to count active Claude sessions:

#### `countWorkspaceActiveSessions(): number`
- Main entry point that counts all active sessions in the workspace
- Scans the main workspace plus all git worktrees
- Returns total count of active Claude processes

#### `getWorkspacePaths(): string[]`
- Discovers all workspace paths (main workspace + worktrees)
- Uses `git worktree list --porcelain` to find worktrees
- Falls back gracefully if not a git repo or no worktrees exist
- Returns array of absolute paths to check

#### `countActiveSessionsInPath(workspacePath: string): number`
- Counts active sessions in a specific workspace path
- Scans `.claude-sessions/*.signal` files
- Considers a session "active" if:
  - Signal file modified within last 5 minutes
  - State is `responding`, OR
  - State is `stopped`/`idle` AND modified within last 60 seconds
- Filters out stale/old sessions automatically

### 2. ProjectsViewProvider Changes (`apps/code-ext/src/projects-view-provider.ts`)

#### New Fields
```typescript
private _workspaceCountInterval?: NodeJS.Timeout;
```

#### New Methods

##### `updateWorkspaceRunningCount()`
- Gets current count from ClaudeMonitor
- Updates orchestration data if count changed
- Triggers UI update via `setOrchestrationData()`

##### `startWorkspaceCountUpdates()`
- Initializes ClaudeMonitor if needed
- Updates count immediately
- Sets up 10-second interval for continuous updates

##### `stopWorkspaceCountUpdates()`
- Cleans up interval timer
- Called when webview is disposed

#### Integration Points

**In `resolveWebviewView()`:**
- Early initialization of ClaudeMonitor (if not already initialized)
- Starts periodic count updates
- Registers cleanup handler on webview dispose

### 3. UI Display (Already Exists)

The UI already had the "Workspace Running" display in `apps/code-ext/media/main.js`:

```javascript
// Workspace Running
const wsRunningValue = document.createElement('span');
wsRunningValue.className = 'orchestration-value running';
wsRunningValue.id = 'orchestration-ws-running';
wsRunningValue.textContent = '0'; // Now updated with actual count
```

The count is updated via `updateOrchestrationUI()` when orchestration data is received.

## How It Works

### Session Detection Flow

1. **Every 10 seconds**, `updateWorkspaceRunningCount()` is called
2. Calls `claudeMonitor.countWorkspaceActiveSessions()`
3. ClaudeMonitor:
   - Gets list of workspace paths (main + worktrees)
   - For each path:
     - Scans `.claude-sessions/*.signal` files
     - Reads each signal file
     - Checks modification time (<5 minutes)
     - Checks session state (responding/stopped/idle)
     - Counts active sessions
   - Returns total count
4. If count changed:
   - Updates `_orchestrationData.workspace.running`
   - Saves to workspace state
   - Sends to webview via `postMessage`
5. Webview updates UI element `#orchestration-ws-running`

### Worktree Support

Git worktrees are separate working directories linked to the same repository. Example:

```
main-workspace/
  .claude-sessions/
    abc123.signal  (active)

worktree-1/
  .claude-sessions/
    def456.signal  (active)

worktree-2/
  .claude-sessions/
    ghi789.signal  (stopped - stale)
```

The feature counts processes in all these locations:
- `main-workspace`: 1 active
- `worktree-1`: 1 active
- `worktree-2`: 0 (stale, >5 min old)
- **Total: 2**

## Active Session Criteria

A Claude session is considered "active" if ALL of these are true:

1. **Signal file exists** in `.claude-sessions/*.signal`
2. **File modified recently** (within last 5 minutes)
3. **State is valid**:
   - `responding` (Claude is actively working), OR
   - `stopped`/`idle` AND modified within last 60 seconds (recently stopped)

## Update Frequency

- **Interval**: Every 10 seconds
- **Rationale**:
  - Frequent enough to feel real-time
  - Not too frequent to cause performance issues
  - Balances responsiveness with resource usage

## Error Handling

- **Missing workspace folders**: Gracefully skips initialization
- **Git errors**: Falls back to single workspace path
- **File read errors**: Skips problematic signal files, continues counting others
- **Parse errors**: Skips malformed signal files
- **ClaudeMonitor not initialized**: Safely returns without crashing

## UI Integration

The count appears in the extension sidebar:

```
┌─ Orchestration Control ─────────────┐
│                                      │
│ Workspace                            │
│ Running: 2    Desired: [3]           │  ← "Running" shows live count
│                                      │
│ Global                               │
│ Running: 5    Desired: 10            │
│                                      │
└──────────────────────────────────────┘
```

## Benefits

1. **Visibility**: Users can see how many Claude processes are active
2. **Worktree Support**: Counts processes across all git worktrees
3. **Automatic**: No manual refresh needed
4. **Accurate**: Filters out stale/old sessions
5. **Lightweight**: Only scans signal files every 10 seconds

## Future Enhancements

Possible future improvements:

1. **Click to view sessions**: Show list of active sessions in dropdown
2. **Per-session details**: Display which project each session is working on
3. **Manual refresh button**: Allow immediate count update
4. **Configurable interval**: Let users adjust update frequency
5. **Session termination**: Add "Stop All" button to kill all sessions
6. **Resource usage**: Show CPU/memory per session

## Testing

To test the feature:

1. Open a workspace with the extension
2. Start one or more Claude sessions:
   ```bash
   claude /project-start 79
   ```
3. Check the sidebar - "Workspace Running" should show count
4. Create a worktree and start a session there:
   ```bash
   git worktree add ../my-worktree
   cd ../my-worktree
   claude /project-start 80
   ```
5. Check sidebar - count should increase
6. Wait for sessions to complete or become idle
7. After 5 minutes, stale sessions won't be counted

## Files Modified

- `apps/code-ext/src/claude-monitor.ts` - Added session counting methods
- `apps/code-ext/src/projects-view-provider.ts` - Added periodic updates
- Build successful: ✅ `npm run compile` passed

## Dependencies

- Existing: `ClaudeMonitor`, `ClaudeSignal`, VSCode API
- System: `git worktree list` command (optional, graceful fallback)
- No new npm packages required

---

**Status**: ✅ Implemented and tested
**Build**: ✅ Compiled successfully
**Ready for**: Development testing
