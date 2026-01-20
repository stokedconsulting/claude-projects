import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from './tools/registry.js';

/**
 * MCP Server for Claude Projects API and Extension Communication
 *
 * This server provides the Model Context Protocol interface for:
 * - State tracking API communication
 * - Browser extension integration
 * - Project orchestration workflows
 */
export class MCPServer {
  private server: Server;
  private registry: ToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-projects-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registry = new ToolRegistry();
    this.setupHandlers();
  }

  /**
   * Get the tool registry (for testing and tool registration)
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.registry.listTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Execute tool through registry with validation and error handling
      const result = await this.registry.executeTool(name, args || {});

      return result;
    });
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('MCP Server started successfully');
    console.error('Server name: claude-projects-mcp-server');
    console.error('Server version: 0.1.0');
    console.error('Protocol: MCP via stdio transport');
    console.error('Capabilities: tools');
  }

  /**
   * Get the server instance (for testing)
   */
  getServer(): Server {
    return this.server;
  }
}
