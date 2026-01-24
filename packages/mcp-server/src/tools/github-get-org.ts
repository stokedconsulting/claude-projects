import { JSONSchemaType } from 'ajv';
import { ToolDefinition, ToolResult } from './registry.js';
import { GitHubClient } from '../github-client.js';

export interface GetOrgParams {
  org: string;
}

const getOrgSchema: JSONSchemaType<GetOrgParams> = {
  type: 'object',
  properties: {
    org: {
      type: 'string',
      description: 'Organization name',
    },
  },
  required: ['org'],
  additionalProperties: false,
};

export function createGitHubGetOrgTool(
  client: GitHubClient
): ToolDefinition<GetOrgParams> {
  return {
    name: 'github_get_org',
    description: 'Get metadata for a GitHub organization',
    inputSchema: getOrgSchema,
    handler: async (params: GetOrgParams): Promise<ToolResult> => {
      try {
        const result = await client.getOrg(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  organization: result,
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
                  error: 'Failed to get organization',
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
