import {
    ProjectCreationConfig,
    ProjectCreationResult,
    IssueDefinition,
    FailedTask
} from './project-flow-types';

/**
 * Callback for progress updates
 */
export type ProgressCallback = (step: string, current: number, total: number) => void;

/**
 * DEPRECATED: GitHub Project creator
 *
 * This class used `gh CLI` which has been deprecated as of January 2026.
 *
 * The gh CLI dependency has been removed from the codebase to centralize GitHub
 * operations through the unified MCP Server layer.
 *
 * Migration path: Use MCP Server tools instead:
 * - github_create_project: Creates a new GitHub project
 * - github_create_issue: Creates a GitHub issue
 * - github_link_issue_to_project: Links an issue to a project
 *
 * See: docs/mcp-migration-guide.md for detailed migration instructions.
 *
 * @deprecated Use MCP Server tools instead
 */
export class GitHubProjectCreator {
    constructor() {
        console.warn(
            '[DEPRECATION] GitHubProjectCreator has been deprecated as of January 2026.\n' +
            'The gh CLI dependency has been removed from the codebase.\n' +
            'Please use MCP Server tools instead. See: docs/mcp-migration-guide.md'
        );
    }

    /**
     * @deprecated Use MCP Server tools instead
     */
    public validateConfig(config: ProjectCreationConfig): void {
        throw this.throwDeprecatedError('validateConfig');
    }

    private throwDeprecatedError(methodName: string): Error {
        return new Error(
            `GitHubProjectCreator.${methodName}() has been deprecated as of January 2026.\n\n` +
            `The gh CLI dependency has been removed from the codebase.\n` +
            `Please use MCP Server tools instead:\n` +
            `  - github_create_project: Creates a new GitHub project\n` +
            `  - github_create_issue: Creates a GitHub issue\n` +
            `  - github_link_issue_to_project: Links an issue to a project\n\n` +
            `See: docs/mcp-migration-guide.md for migration instructions.`
        );
    }

    /**
     * @deprecated Use MCP Server tools instead
     */
    public async createProject(
        config: ProjectCreationConfig,
        onProgress?: ProgressCallback
    ): Promise<ProjectCreationResult> {
        throw this.throwDeprecatedError('createProject');
    }

    /**
     * @deprecated Use MCP Server tools instead
     */
    public async checkAuth(): Promise<{ authenticated: boolean; error?: string }> {
        throw this.throwDeprecatedError('checkAuth');
    }

    /**
     * @deprecated Use MCP Server tools instead
     */
    public async checkProjectScope(): Promise<{ hasScope: boolean; error?: string }> {
        throw this.throwDeprecatedError('checkProjectScope');
    }
}
