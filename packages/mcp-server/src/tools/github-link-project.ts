import { JSONSchemaType } from 'ajv';
import { ToolDefinition, ToolResult } from './registry.js';
import { GitHubClient } from '../github-client.js';

export interface LinkProjectParams {
  projectId: string;
  repositoryId: string;
}

const linkProjectSchema: JSONSchemaType<LinkProjectParams> = {
  type: 'object',
  properties: {
    projectId: {
      type: 'string',
      description: 'Project node ID (ProjectsV2)',
    },
    repositoryId: {
      type: 'string',
      description: 'Repository node ID',
    },
  },
  required: ['projectId', 'repositoryId'],
  additionalProperties: false,
};

export function createGitHubLinkProjectTool(
  client: GitHubClient
): ToolDefinition<LinkProjectParams> {
  return {
    name: 'github_link_project',
    description: 'Link a GitHub project to a repository (ProjectsV2 only)',
    inputSchema: linkProjectSchema,
    handler: async (params: LinkProjectParams): Promise<ToolResult> => {
      try {
        const result = await client.linkProjectToRepo(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result.success,
                  message: 'Project linked to repository successfully',
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
                  error: 'Failed to link project to repository',
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
