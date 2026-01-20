import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

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
  private tools: Tool[] = [];

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

    this.setupHandlers();
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Tool execution will be implemented in future work items
      throw new Error(`Tool not implemented: ${name}`);
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
