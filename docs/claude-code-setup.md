# Claude Code Setup Guide

Complete guide for setting up Claude Code integration with the Claude Projects MCP server for seamless project management capabilities.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start (5 minutes)](#quick-start-5-minutes)
4. [Detailed Setup](#detailed-setup)
   - [Step 1: Build the MCP Server](#step-1-build-the-mcp-server)
   - [Step 2: Configure Claude Desktop](#step-2-configure-claude-desktop)
   - [Step 3: Verify Tool Discovery](#step-3-verify-tool-discovery)
5. [MCP Server Configuration](#mcp-server-configuration)
6. [Environment Variables](#environment-variables)
7. [Tool Discovery Verification](#tool-discovery-verification)
8. [Usage Examples](#usage-examples)
   - [Basic Tool Usage](#basic-tool-usage)
   - [Project Management Workflows](#project-management-workflows)
   - [Error Handling](#error-handling)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Configuration](#advanced-configuration)

---

## Overview

Claude Code integration allows Claude to directly interact with GitHub Projects through the Model Context Protocol (MCP). The MCP Server acts as a bridge, exposing project management tools that Claude can discover and use autonomously.

### What is the Model Context Protocol (MCP)?

MCP is a standardized protocol for AI agents to interact with external tools and data sources. It enables:

- **Tool Discovery**: Claude automatically discovers available tools
- **Secure Communication**: Authenticated, type-safe interactions
- **Real-time Synchronization**: WebSocket notifications keep systems in sync
- **Error Handling**: Structured error responses with detailed diagnostics

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Claude Code                            │
│                    (AI Agent Interface)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ stdio (JSON-RPC)
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      MCP Server                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tool Registry                                             │  │
│  │ • health_check                                            │  │
│  │ • read_project          • create_issue                   │  │
│  │ • get_project_phases    • update_issue                   │  │
│  │ • list_issues           • update_issue_status            │  │
│  │ • get_issue_details     • update_issue_phase             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         │                                       │
│  ┌──────────────────────▼─────────────────────────────────┐   │
│  │ State Tracking API Client                              │   │
│  │ (with retries, timeouts, error handling)               │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │ WebSocket Server (notifications to VSCode)             │   │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS & WebSocket
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    State Tracking API                           │
│              (Backend service & GitHub API)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before setting up Claude Code integration, ensure you have:

### Required Software

| Component | Version | Purpose |
|-----------|---------|---------|
| **Claude Code** | Latest | AI agent runtime with MCP support |
| **Node.js** | 18.x or higher | Runtime for MCP server |
| **pnpm** | 8.x or higher | Package manager (monorepo support) |
| **Git** | 2.x or higher | Repository management |

**Check your versions:**

```bash
node --version        # Should show v18.x or higher
pnpm --version        # Should show 8.x or higher
git --version         # Should show 2.x or higher
```

### Required Access

1. **State Tracking API Key**
   - Format: `sk_live_...` or `sk_dev_...`
   - Contact your administrator to obtain
   - Used for project management operations

2. **WebSocket API Key** (optional but recommended)
   - Format: `ws_...`
   - Enables real-time VSCode extension notifications
   - Contact your administrator to obtain

### Repository Access

- Clone or access the claude-projects repository
- Must have `packages/mcp-server` directory available
- Must have read/write access for configuration

---

## Quick Start (5 minutes)

For experienced users, here's the fastest path to integration:

```bash
# 1. Build the MCP server
cd /path/to/claude-projects-project-72/packages/mcp-server
pnpm install && pnpm build

# 2. Get your configuration file location
# macOS:
open ~/Library/Application\ Support/Claude/

# Windows:
%APPDATA%\Claude\

# Linux:
~/.config/Claude/

# 3. Add to claude_desktop_config.json
{
  "mcpServers": {
    "claude-projects": {
      "command": "node",
      "args": ["/absolute/path/to/claude-projects-project-72/packages/mcp-server/dist/index.js"],
      "env": {
        "STATE_TRACKING_API_KEY": "sk_your_key_here",
        "WS_API_KEY": "ws_your_key_here"
      }
    }
  }
}

# 4. Restart Claude Code and verify tools appear
```

---

## Detailed Setup

### Step 1: Build the MCP Server

The MCP Server must be built before Claude can use it.

#### 1.1 Navigate to the Server Directory

```bash
cd /path/to/claude-projects-project-72/packages/mcp-server
```

Replace `/path/to/` with your actual repository location. You can find it by running:

```bash
# Find the repository location
find ~ -type d -name "claude-projects-project-72" 2>/dev/null | head -1
```

#### 1.2 Install Dependencies

```bash
pnpm install
```

This installs all required npm packages for the MCP server.

**Expected output:**
```
 WARN  deprecated @types/node@20.19.30: This is a stub types definition...
 WARN  deprecated ...
Done in 2.34s
```

(Warnings are normal; errors would indicate a problem)

#### 1.3 Create Configuration File

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```bash
# Required: State Tracking API key
STATE_TRACKING_API_KEY=sk_your_api_key_here

# Optional: WebSocket API key (for VSCode notifications)
WS_API_KEY=ws_your_websocket_key_here

# Optional: API URL (change for staging/self-hosted)
STATE_TRACKING_API_URL=https://claude-projects.truapi.com

# Optional: Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Optional: WebSocket port (change if 8080 is in use)
WS_PORT=8080
```

#### 1.4 Build the Server

```bash
pnpm build
```

**Expected output:**
```
✔ Compiled successfully in 12.5s
dist/
├── index.js
├── server.js
├── config.js
├── api-client.js
├── tools/
└── events/
```

**Troubleshooting:**
- If you see `tsconfig.json not found`, ensure you're in `packages/mcp-server` directory
- If build fails with `Cannot find module`, run `pnpm install` again
- If permission denied, ensure you have write access to the directory

#### 1.5 Verify the Build

```bash
ls -la dist/index.js
# Should show the compiled file exists
```

Note the absolute path to `dist/index.js` - you'll need it in the next step.

---

### Step 2: Configure Claude Desktop

Claude Desktop reads configuration from a JSON file that specifies which MCP servers to load.

#### 2.1 Locate the Configuration File

The location varies by operating system:

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

To open in your editor:

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```powershell
notepad $env:APPDATA\Claude\claude_desktop_config.json
```

**Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

#### 2.2 Add the MCP Server Configuration

If the file is empty or just has `{}`, replace it with:

```json
{
  "mcpServers": {
    "claude-projects": {
      "command": "node",
      "args": [
        "/absolute/path/to/claude-projects-project-72/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "STATE_TRACKING_API_KEY": "sk_your_api_key_here",
        "WS_API_KEY": "ws_your_websocket_key_here"
      }
    }
  }
}
```

**Critical:** Replace `/absolute/path/to/` with the actual full path to your repository.

**Getting the Absolute Path:**

```bash
# Find the repository
pwd  # while in the repository directory

# Example output: /Users/yourname/work/claude-projects-project-72
# Full path to dist: /Users/yourname/work/claude-projects-project-72/packages/mcp-server/dist/index.js
```

#### 2.3 Verify Configuration Syntax

Ensure the JSON is valid. You can test it:

```bash
# macOS/Linux
jq . ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Or use an online JSON validator: https://jsonlint.com/
```

Common mistakes:
- Missing commas between properties
- Trailing commas (not allowed in JSON)
- Using relative paths (`~/...`) instead of absolute paths
- Missing quotes around property names

#### 2.4 Restart Claude Desktop

**Critical:** Claude Desktop must be fully restarted to load the new configuration.

```bash
# macOS: Fully quit the application
killall -9 "Claude"

# Wait a few seconds, then relaunch Claude from Applications folder
open /Applications/Claude.app
```

**Windows:**
1. Right-click on Claude in taskbar → Close window
2. Wait a few seconds
3. Relaunch Claude

**Linux:**
```bash
pkill -9 claude
# Then relaunch from your application menu or:
claude &
```

---

### Step 3: Verify Tool Discovery

Verify that Claude has successfully discovered the MCP tools.

#### 3.1 Check Claude's Tool List

In Claude, start a new conversation and ask Claude to list available tools:

**Prompt:**
```
What tools do you have available? Show me the list of all project management tools you can access.
```

**Expected Response:**
Claude should list tools including:
- `health_check` - Check API connectivity
- `read_project` - Read project details
- `get_project_phases` - Get project phases
- `list_issues` - List project issues
- `get_issue_details` - Get issue details
- `create_issue` - Create new issues
- `update_issue` - Update issue fields
- `update_issue_status` - Change issue status
- `update_issue_phase` - Move issue to different phase

If tools don't appear, see the [Troubleshooting](#troubleshooting) section.

#### 3.2 Test Health Check

Ask Claude to verify the connection:

**Prompt:**
```
Run the health_check tool to verify the connection to the state tracking API.
```

**Expected Response:**
```json
{
  "apiAvailable": true,
  "authenticated": true,
  "responseTimeMs": 145,
  "apiVersion": "1.0.0"
}
```

If authentication fails:
- Verify API key is correct in configuration
- Check API key hasn't expired
- Ensure API key has necessary permissions

#### 3.3 Test Project Access

Ask Claude to read a project:

**Prompt:**
```
Read project 70. Show me the project title, description, and total number of issues.
```

**Expected Response:**
Claude returns project details including title, description, issue counts, and phases.

If project not found:
- Verify project number is correct
- Ensure API key has access to the repository
- Check project exists in GitHub

---

## MCP Server Configuration

The MCP Server can be configured through environment variables for different environments and use cases.

### Configuration Methods (in priority order)

1. **Claude Desktop config** (highest priority)
   - Set in `claude_desktop_config.json` under `env` section
   - Overrides all other settings

2. **Environment variables**
   - Set in shell before starting MCP server
   - Used when running standalone

3. **.env file**
   - Located in `packages/mcp-server/.env`
   - Used when building or starting the server

### Example Configurations

#### Development Setup (Verbose Logging)

```bash
# .env file or claude_desktop_config.json env section
STATE_TRACKING_API_KEY=sk_dev_your_key_here
WS_API_KEY=ws_dev_your_key_here
LOG_LEVEL=debug
REQUEST_TIMEOUT_MS=30000
RETRY_ATTEMPTS=5
```

Benefits:
- Detailed logging for debugging
- Longer timeouts for slow networks
- More retry attempts for reliability

#### Production Setup (Optimized)

```bash
STATE_TRACKING_API_KEY=sk_live_your_key_here
WS_API_KEY=ws_live_your_key_here
LOG_LEVEL=warn
REQUEST_TIMEOUT_MS=5000
RETRY_ATTEMPTS=2
```

Benefits:
- Minimal logging (faster, fewer false positives)
- Shorter timeouts (fail fast on unreachable servers)
- Fewer retries (avoid thundering herd)

#### Staging/Self-Hosted

```bash
STATE_TRACKING_API_KEY=sk_staging_your_key_here
STATE_TRACKING_API_URL=https://staging.claude-projects.example.com
WS_API_KEY=ws_staging_your_key_here
WS_PORT=8081
LOG_LEVEL=info
```

---

## Environment Variables

Complete reference for all configuration options.

### Required Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `STATE_TRACKING_API_KEY` | `sk_live_abc123xyz...` | Authentication key for state tracking API (required) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_API_KEY` | (none) | WebSocket API key for VSCode extension notifications |
| `STATE_TRACKING_API_URL` | `https://claude-projects.truapi.com` | Base URL for state tracking API |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `REQUEST_TIMEOUT_MS` | `10000` | Request timeout in milliseconds (10 seconds) |
| `RETRY_ATTEMPTS` | `3` | Number of times to retry failed requests |
| `WS_PORT` | `8080` | Port for WebSocket server (notifications) |

### Security Best Practices

1. **Never commit API keys to version control**
   ```bash
   # .gitignore should include:
   .env
   .env.local
   *.key
   *.secret
   ```

2. **Rotate API keys regularly**
   - Change keys every 90 days
   - Immediately rotate if compromised
   - Keep one backup key for zero-downtime rotation

3. **Use environment variables over config files**
   - Claude Desktop config can be read from disk
   - Environment variables are only in memory
   - For CI/CD, use secure variable storage

4. **Restrict API key permissions**
   - Request minimal necessary permissions
   - Use separate keys for dev/staging/prod
   - Enable API key rotation policies

---

## Tool Discovery Verification

Claude automatically discovers available tools when connecting to the MCP Server. Here's how to verify the process.

### How Tool Discovery Works

1. **Connection**: Claude connects to MCP Server via stdio
2. **Initialization**: Claude sends `initialize` request
3. **Tool Registry**: MCP Server returns list of available tools with full schemas
4. **Storage**: Claude caches tool definitions locally
5. **Availability**: Tools appear immediately in Claude's UI

### Verification Checklist

Use this checklist to diagnose tool discovery issues:

#### Configuration Verification

- [ ] `claude_desktop_config.json` file exists at correct location
- [ ] JSON syntax is valid (test with `jq` or online validator)
- [ ] `STATE_TRACKING_API_KEY` is set and non-empty
- [ ] Absolute path (not relative) to `dist/index.js` is correct
- [ ] Path uses forward slashes on all platforms
- [ ] File is readable (check permissions)

#### Build Verification

- [ ] `packages/mcp-server/dist/index.js` exists
- [ ] File size > 50KB (indicates successful build)
- [ ] Built recently (within last hour)
- [ ] No TypeScript compilation errors

```bash
ls -lh packages/mcp-server/dist/index.js
```

#### Runtime Verification

1. **Start MCP server in debug mode:**
```bash
cd packages/mcp-server
LOG_LEVEL=debug pnpm start:dev
```

2. **Look for these log messages:**
```
Tool registered: health_check
Tool registered: read_project
Tool registered: get_project_phases
Tool registered: list_issues
Tool registered: get_issue_details
Tool registered: create_issue
Tool registered: update_issue
Tool registered: update_issue_status
Tool registered: update_issue_phase
WebSocket server listening on port 8080
MCP server started
```

3. **If server won't start:**
   - Check `STATE_TRACKING_API_KEY` is set: `echo $STATE_TRACKING_API_KEY`
   - Check `.env` file has correct syntax
   - Check port 8080 is not in use: `lsof -i :8080`

#### Claude Connection Verification

1. **In Claude, run:**
```
Use the health_check tool to verify the MCP server is responding correctly.
```

2. **Expected response:**
```json
{
  "apiAvailable": true,
  "authenticated": true,
  "responseTimeMs": 150,
  "apiVersion": "1.0.0"
}
```

3. **If health_check fails:**
   - Verify API key is valid
   - Check API key hasn't expired
   - Confirm network connectivity to API server

---

## Usage Examples

### Basic Tool Usage

#### Example 1: Check API Health

**Claude Prompt:**
```
Check the health of the state tracking API to ensure we can access Claude Projects.
```

**What Claude Does:**
```
I'll use the health_check tool to verify the connection.
[Uses health_check tool]
```

**Claude Response:**
```
The API is healthy and responding correctly:
- API Available: Yes
- Authenticated: Yes (with valid API key)
- Response Time: 145ms
- API Version: 1.0.0

Everything looks good! You're ready to use Claude Projects management tools.
```

#### Example 2: Read Project Details

**Claude Prompt:**
```
Read project 70 and tell me:
1. The project title
2. How many total issues
3. How many are completed
4. What phase we're currently in
```

**Claude Response:**
```
Here's the project status:
1. Title: Claude Projects State Tracking
2. Total Issues: 45
3. Completed: 22 (48%)
4. Current Phase: Phase 2: Development (with 18 active issues)

The project is progressing well. We're roughly halfway through development.
```

#### Example 3: List Issues in Current Phase

**Claude Prompt:**
```
Show me all "in progress" issues in project 70. Include issue numbers, titles, and assignees.
```

**Claude Response:**
```
Found 8 in-progress issues:
1. #42 - Implement user authentication (assigned to developer123)
2. #43 - Add user profile page (assigned to frontend-dev)
3. #44 - Database optimization (assigned to backend-dev)
...
```

### Project Management Workflows

#### Workflow 1: Daily Standup Summary

**Claude Prompt:**
```
Generate a standup summary for project 70:
1. How many issues completed since yesterday?
2. How many are currently blocked?
3. Show the top 3 highest priority in-progress items
4. Estimate how many more days until current phase completes
```

**How Claude Works:**
1. Calls `read_project` to get project metadata
2. Calls `list_issues` with status filters to count completed/blocked
3. Calls `get_issue_details` for high priority items
4. Provides analysis and recommendations

#### Workflow 2: Bulk Status Update

**Claude Prompt:**
```
I've completed issues #42, #43, and #45 in project 70. Mark them as done.
```

**How Claude Works:**
1. Calls `update_issue_status` for each issue with status "done"
2. Optionally calls `update_issue_phase` to move to next phase
3. Reports success/failure for each update

#### Workflow 3: Create Issue from Requirements

**Claude Prompt:**
```
In project 70, Phase 2: Development, create a new issue:
- Title: Implement password reset functionality
- Description: Add email-based password reset with token validation
- Assign to: backend-dev
- Label: feature, security
```

**How Claude Works:**
1. Calls `create_issue` with all provided details
2. Returns issue number and confirmation

#### Workflow 4: Phase Progression

**Claude Prompt:**
```
Move issue #42 to the Testing phase (Phase 3). Update the status to "in_progress".
```

**How Claude Works:**
1. Calls `update_issue_phase` to move to new phase
2. Calls `update_issue_status` to update status
3. Confirms both changes succeeded

### Error Handling

Claude is equipped to handle and recover from errors gracefully.

#### Example: Invalid Project Number

**Claude Prompt:**
```
Read project 99999 to see its status.
```

**Claude Response:**
```
I encountered an error: Project #99999 not found.

This could mean:
1. The project number is incorrect
2. The API key doesn't have access to this project
3. The project was deleted

Could you verify the project number? Or if you need access to a private project, check that your API key has the necessary permissions.
```

#### Example: API Key Expiration

**Claude Prompt:**
```
List issues in project 70.
```

**Claude Response:**
```
I'm unable to authenticate with the state tracking API. This typically means:

1. API Key Expired: Your authentication key may have expired
2. Invalid Credentials: The API key configuration might be incorrect
3. Network Issue: There might be connectivity problems

Please verify your API key is current and correctly configured. Contact your administrator if you need a new key.
```

#### Example: Network Timeout

**Claude Prompt:**
```
Create a new issue in project 70.
```

**Claude Response:**
```
The API request timed out. The server took longer than 10 seconds to respond.

This can happen due to:
1. Slow network connection
2. API server overload
3. DNS resolution delays

Would you like me to:
- Try again (requests retry automatically)
- Check API health status first
- Switch to a different time when the server is less busy
```

---

## Troubleshooting

### Tools Not Appearing in Claude

**Symptom:** You don't see project management tools in Claude's tool list

**Diagnosis:**

1. **Verify configuration file exists:**
```bash
# macOS
test -f ~/Library/Application\ Support/Claude/claude_desktop_config.json && echo "File exists" || echo "File NOT found"

# Linux
test -f ~/.config/Claude/claude_desktop_config.json && echo "File exists" || echo "File NOT found"
```

2. **Check configuration syntax:**
```bash
jq . ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

If this fails with "parse error", the JSON is invalid.

3. **Verify the file was updated after configuration:**
```bash
# macOS
ls -l ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

4. **Check the path to dist/index.js:**
```bash
# Verify the file actually exists
test -f /path/to/claude-projects-project-72/packages/mcp-server/dist/index.js && echo "Found" || echo "NOT FOUND"
```

**Solutions:**

1. **Re-create the configuration file** with correct syntax:
```bash
cat > ~/Library/Application\ Support/Claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "claude-projects": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "STATE_TRACKING_API_KEY": "sk_your_key"
      }
    }
  }
}
EOF
```

2. **Rebuild the MCP server:**
```bash
cd packages/mcp-server
rm -rf dist node_modules
pnpm install && pnpm build
```

3. **Fully restart Claude Desktop:**
- Quit: `killall -9 "Claude"` (macOS) or task manager (Windows)
- Wait 10 seconds
- Relaunch Claude

4. **Clear Claude's cache:**
- macOS: `rm -rf ~/Library/Caches/Claude`
- Windows: Delete `%LOCALAPPDATA%\Claude\Cache`
- Linux: `rm -rf ~/.cache/claude`
- Then restart Claude

### "health_check" Tool Fails with 401 Unauthorized

**Symptom:** Tool runs but returns authentication error

**Cause:** API key is invalid, missing, or expired

**Solutions:**

1. **Verify API key is set:**
```bash
# Check in configuration file
grep STATE_TRACKING_API_KEY ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Or check environment
echo $STATE_TRACKING_API_KEY
```

2. **Test API key directly:**
```bash
curl -H "Authorization: Bearer sk_your_key_here" \
     https://claude-projects.truapi.com/api/projects
```

If you get `Unauthorized`, the key is invalid.

3. **Request new API key:**
- Contact your administrator
- They'll provide a new `sk_...` key
- Update your configuration immediately

4. **Ensure .env file has the key** (if running standalone):
```bash
# In packages/mcp-server/.env
STATE_TRACKING_API_KEY=sk_your_key_here
```

### Tools Timeout or Respond Slowly

**Symptom:** Tools take >10 seconds to respond or time out

**Cause:** Network latency or server overload

**Solutions:**

1. **Increase timeout value:**
```json
{
  "mcpServers": {
    "claude-projects": {
      "env": {
        "REQUEST_TIMEOUT_MS": "30000"
      }
    }
  }
}
```

Restart Claude after changing this.

2. **Check network connectivity:**
```bash
# Test latency to API
ping claude-projects.truapi.com

# Check DNS resolution
nslookup claude-projects.truapi.com
```

If ping times are >500ms, you have network issues.

3. **Reduce data requests:**
- Use filters in `list_issues` (e.g., status="in_progress")
- Avoid reading large projects with 1000+ issues
- Request specific issue details instead of listing all

4. **Run health check:**
```
In Claude: "Run the health_check tool and tell me the response time"
```

If response time is >500ms, the API server is slow.

### WebSocket Notifications Not Working

**Symptom:** VSCode extension doesn't update when Claude changes project status

**Cause:** WebSocket connection not established

**Solutions:**

1. **Ensure MCP server is running:**
```bash
cd packages/mcp-server
pnpm start
```

Look for: `WebSocket server listening on port 8080`

2. **Check firewall allows localhost connections:**
```bash
telnet localhost 8080
```

Should connect (you'll see blank screen). Press `Ctrl+]` then `quit` to exit.

3. **Verify WebSocket API key:**
```bash
# In .env or configuration
echo $WS_API_KEY
```

Should match the key in VSCode settings.

4. **Check VSCode extension settings:**
- Open VSCode Settings (Cmd+,)
- Search "Claude Projects"
- Verify `ghProjects.notifications.websocketUrl` is `ws://localhost:8080/notifications`

5. **Check browser console for errors:**
- Press `Ctrl+Shift+K` (VSCode extension dev tools)
- Look for connection errors
- WebSocket should show: `WebSocket connection established`

---

## Advanced Configuration

### Multiple MCP Servers

Run different servers for development and production:

```json
{
  "mcpServers": {
    "claude-projects-dev": {
      "command": "node",
      "args": ["/path/to/dev/packages/mcp-server/dist/index.js"],
      "env": {
        "STATE_TRACKING_API_KEY": "sk_dev_...",
        "WS_API_KEY": "ws_dev_...",
        "WS_PORT": "8080"
      }
    },
    "claude-projects-prod": {
      "command": "node",
      "args": ["/path/to/prod/packages/mcp-server/dist/index.js"],
      "env": {
        "STATE_TRACKING_API_KEY": "sk_live_...",
        "WS_API_KEY": "ws_live_...",
        "WS_PORT": "8081"
      }
    }
  }
}
```

### Combining with Other MCP Servers

```json
{
  "mcpServers": {
    "claude-projects": {
      "command": "node",
      "args": ["/path/to/claude-projects/packages/mcp-server/dist/index.js"],
      "env": {
        "STATE_TRACKING_API_KEY": "sk_..."
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/workspace"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

This allows Claude to manage projects AND access files and GitHub simultaneously.

### Enable Detailed Logging

For debugging connection issues:

```json
{
  "mcpServers": {
    "claude-projects": {
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

Then check Claude logs:
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\Logs\`
- Linux: `~/.config/Claude/logs/`

### Using Environment Variables Instead of Config File

For CI/CD or containerized environments:

```bash
export STATE_TRACKING_API_KEY="sk_..."
export WS_API_KEY="ws_..."
export LOG_LEVEL="info"

cd packages/mcp-server
pnpm start
```

Then configure Claude to connect to a different port or via script:

```json
{
  "mcpServers": {
    "claude-projects": {
      "command": "bash",
      "args": ["/path/to/start-mcp-server.sh"]
    }
  }
}
```

Where `start-mcp-server.sh`:
```bash
#!/bin/bash
export STATE_TRACKING_API_KEY="${STATE_TRACKING_API_KEY:?Missing API key}"
cd /path/to/packages/mcp-server
pnpm start
```

---

## Summary

You've now learned how to:

1. ✅ **Set up the MCP Server** - Build and configure the Node.js server
2. ✅ **Configure Claude Desktop** - Register the server in Claude's config
3. ✅ **Verify tool discovery** - Ensure Claude sees all available tools
4. ✅ **Use MCP tools** - Make Claude calls to manage projects
5. ✅ **Handle errors** - Gracefully recover from failures
6. ✅ **Troubleshoot issues** - Diagnose and fix common problems
7. ✅ **Advanced configuration** - Set up multiple servers and custom environments

## Next Steps

1. **Explore the API Reference** - See [api-reference.md](./api-reference.md) for complete tool documentation
2. **Review Example Prompts** - Check [examples/claude-prompts.md](../examples/claude-prompts.md) for common tasks
3. **Try Real Projects** - Start with a small project to test end-to-end workflows
4. **Read the Developer Guide** - See [mcp-development.md](./mcp-development.md) to extend functionality

## Support

For issues or questions:

- **MCP Server Documentation**: See [packages/mcp-server/README.md](../packages/mcp-server/README.md)
- **API Reference**: See [docs/api-reference.md](./api-reference.md)
- **Migration Guide**: See [docs/mcp-migration-guide.md](./mcp-migration-guide.md)
- **Integration Guide**: See [docs/mcp-integration.md](./mcp-integration.md)

---

Built with the [Model Context Protocol](https://modelcontextprotocol.io/) for seamless AI integration.
