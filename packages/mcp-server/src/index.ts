#!/usr/bin/env node

import { MCPServer } from './server.js';

/**
 * Main entry point for the MCP server
 *
 * Starts the server with stdio transport for communication with Claude Desktop
 * or other MCP clients.
 */
async function main() {
  try {
    const server = new MCPServer();
    await server.start();

    // Keep the process alive
    process.on('SIGINT', () => {
      console.error('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
