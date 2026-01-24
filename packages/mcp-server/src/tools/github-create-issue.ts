import { JSONSchemaType } from 'ajv';
import { ToolDefinition, ToolResult } from './registry.js';
import { GitHubClient } from '../github-client.js';

export interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  assignees?: string[];
  labels?: string[];
}

const createIssueSchema: JSONSchemaType<CreateIssueParams> = {
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
    title: {
      type: 'string',
      description: 'Issue title',
    },
    body: {
      type: 'string',
      nullable: true,
      description: 'Issue description (markdown)',
    },
    assignees: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Array of GitHub usernames to assign',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Array of label names',
    },
  },
  required: ['owner', 'repo', 'title'],
  additionalProperties: false,
};

export function createGitHubCreateIssueTool(
  client: GitHubClient
): ToolDefinition<CreateIssueParams> {
  return {
    name: 'github_create_issue',
    description: 'Create a new GitHub issue in a repository',
    inputSchema: createIssueSchema,
    handler: async (params: CreateIssueParams): Promise<ToolResult> => {
      try {
        const result = await client.createIssue(params);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  issue: result,
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
                  error: 'Failed to create issue',
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
