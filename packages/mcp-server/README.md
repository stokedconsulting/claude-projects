# @claude-projects/mcp-server

MCP (Model Context Protocol) server for Claude Projects API and extension communication.

## Overview

This package provides an MCP server that enables communication between:
- Claude Desktop and the state tracking API
- Browser extensions and the orchestration system
- External tools and the project management workflow

## Installation

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Usage

### Start the server

```bash
pnpm start
```

Or use the dev mode (build + start):

```bash
pnpm start:dev
```

### Integration with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "claude-projects": {
      "command": "node",
      "args": ["/path/to/claude-projects-project-72/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Architecture

- **Transport**: stdio (standard input/output)
- **Protocol**: MCP 2024-11-05
- **Capabilities**: Tools (for API operations)

## Development Status

**Phase 1.1 Complete**: MCP Server Package Initialization
- ✓ TypeScript configuration
- ✓ MCP SDK integration (v1.6.1)
- ✓ Stdio transport setup
- ✓ Protocol handshake validation

**Next**: Phase 1.2 - Basic tool definitions (status management, workflow triggers)

## Testing

Test the initialization handshake:

```bash
node test-handshake.js
```

## Files

- `src/index.ts` - Main entry point
- `src/server.ts` - MCP server implementation
- `test-handshake.js` - Integration test for MCP protocol

## License

UNLICENSED - Private package for Stoked Consulting
