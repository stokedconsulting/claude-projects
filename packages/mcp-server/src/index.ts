#!/usr/bin/env node

import { MCPServer } from './server.js';
import { loadConfig, createLogger, getLogger } from './config.js';

/**
 * Main entry point for the MCP server
 *
 * Starts the server with stdio transport for communication with Claude Desktop
 * or other MCP clients.
 */
async function main() {
  try {
    // Load and validate configuration
    const config = loadConfig();
    const logger = createLogger(config);

    logger.info('Configuration loaded successfully', {
      apiBaseUrl: config.apiBaseUrl,
      logLevel: config.logLevel,
      requestTimeout: config.requestTimeout,
      retryAttempts: config.retryAttempts,
    });

    // Start MCP server
    const server = new MCPServer(config, logger);
    await server.start();

    // Keep the process alive
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
