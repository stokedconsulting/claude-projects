import { JSONSchemaType } from 'ajv';
import { ToolDefinition, ToolResult } from './registry.js';
import { GitHubClient } from '../github-client.js';

export interface ListProjectsParams {
  owner: string;
  repo?: string;
}

const listProjectsSchema: JSONSchemaType<ListProjectsParams> = {
  type: 'object',
  properties: {
    owner: {
      type: 'string',
      description: 'Repository owner or organization',
    },
    repo: {
      type: 'string',
      nullable: true,
      description: 'Repository name (omit for org projects)',
    },
  },
  required: ['owner'],
  additionalProperties: false,
};

export function createGitHubListProjectsTool(
  client: GitHubClient
): ToolDefinition<ListProjectsParams> {
  return {
    name: 'github_list_projects',
    description: 'List GitHub projects for a repository or organization',
    inputSchema: listProjectsSchema,
    handler: async (params: ListProjectsParams): Promise<ToolResult> => {
      try {
        const projects = await client.listProjects(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  count: projects.length,
                  projects,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Failed to list projects',
                  message: errorMessage,
                  retryable: errorMessage.includes('rate limit'),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
  };
}
