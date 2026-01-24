import { JSONSchemaType } from 'ajv';
import { ToolDefinition, ToolResult } from './registry.js';
import { GitHubClient } from '../github-client.js';

export interface UpdateIssueParams {
  owner: string;
  repo: string;
  issueNumber: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  assignees?: string[];
  labels?: string[];
}

const updateIssueSchema: JSONSchemaType<UpdateIssueParams> = {
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
    issueNumber: {
      type: 'number',
      description: 'Issue number',
    },
    title: {
      type: 'string',
      nullable: true,
      description: 'New issue title',
    },
    body: {
      type: 'string',
      nullable: true,
      description: 'New issue description',
    },
    state: {
      type: 'string',
      enum: ['open', 'closed'],
      nullable: true,
      description: 'Issue state',
    },
    assignees: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Array of assignees',
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
      description: 'Array of labels',
    },
  },
  required: ['owner', 'repo', 'issueNumber'],
  additionalProperties: false,
};

export function createGitHubUpdateIssueTool(
  client: GitHubClient
): ToolDefinition<UpdateIssueParams> {
  return {
    name: 'github_update_issue',
    description: 'Update a GitHub issue (title, body, state, assignees, labels)',
    inputSchema: updateIssueSchema,
    handler: async (params: UpdateIssueParams): Promise<ToolResult> => {
      try {
        const result = await client.updateIssue(params);

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
                  error: 'Failed to update issue',
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
