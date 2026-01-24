import { JSONSchemaType } from 'ajv';
import { ToolDefinition, ToolResult } from './registry.js';
import { GitHubClient } from '../github-client.js';

export interface GetRepoParams {
  owner: string;
  repo: string;
}

const getRepoSchema: JSONSchemaType<GetRepoParams> = {
  type: 'object',
  properties: {
    owner: {
      type: 'string',
      description: 'Repository owner',
    },
    repo: {
      type: 'string',
      description: 'Repository name',
    },
  },
  required: ['owner', 'repo'],
  additionalProperties: false,
};

export function createGitHubGetRepoTool(
  client: GitHubClient
): ToolDefinition<GetRepoParams> {
  return {
    name: 'github_get_repo',
    description: 'Get metadata for a GitHub repository',
    inputSchema: getRepoSchema,
    handler: async (params: GetRepoParams): Promise<ToolResult> => {
      try {
        const result = await client.getRepo(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  repository: result,
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
                  error: 'Failed to get repository',
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
