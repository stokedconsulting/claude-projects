import * as vscode from 'vscode';

export interface ProjectItem {
    id: string;
    number: string;
    title: string;
    status: 'Todo' | 'In Progress' | 'Done' | string;
    phase: string;
    content?: {
        title: string;
        number?: number;
        state?: string;
    };
}

export interface ProjectPhase {
    name: string;
    status: 'Todo' | 'In Progress' | 'Done' | string;
    items: ProjectItem[];
    phaseNumber: number;
}

export interface ProjectState {
    projectNumber: number;
    phases: ProjectPhase[];
    completionPercentage: number;
    nextIncompleteItem?: ProjectItem;
    totalItems: number;
    completedItems: number;
}

export class ProjectStateValidator {
    /**
     * DEPRECATED: This method used `gh CLI` which has been deprecated as of January 2026.
     *
     * The gh CLI dependency has been removed from the codebase. This method is preserved
     * for backwards compatibility but should not be used in new code.
     *
     * Migration path: Use the MCP Server tools instead:
     * - get-project-phases: Fetches all phases in a project
     * - list-issues: Lists all issues with their status
     *
     * See: docs/mcp-migration-guide.md
     *
     * @deprecated Use MCP Server tools instead
     * @throws Error Always throws with deprecation message
     */
    async fetchProjectState(projectNumber: number): Promise<ProjectState> {
        throw new Error(
            `ProjectStateValidator.fetchProjectState() has been deprecated as of January 2026.\n\n` +
            `The gh CLI dependency has been removed from the codebase.\n` +
            `Please use MCP Server tools instead:\n` +
            `  - get-project-phases: Fetches all phases in a project\n` +
            `  - list-issues: Lists all issues with their status\n\n` +
            `See: docs/mcp-migration-guide.md for migration instructions.\n` +
            `Project #${projectNumber} state should now be fetched via the State Tracking API.`
        );
    }

    /**
     * Extract phase name from item title
     * Assumes format like "Phase 1: Name" or "(Phase 1.1) Title"
     */
    private extractPhase(title: string): string {
        // Try to match "Phase N" or "Phase N.M"
        const phaseMatch = title.match(/Phase\s+(\d+(?:\.\d+)?)/i);
        if (phaseMatch) {
            return `Phase ${phaseMatch[1]}`;
        }

        // Try to match "(N.M)" at start
        const numberMatch = title.match(/^\((\d+)\.(\d+)\)/);
        if (numberMatch) {
            return `Phase ${numberMatch[1]}`;
        }

        return 'Uncategorized';
    }

    /**
     * Validate if "In Progress" items are actually complete
     * This checks the actual state vs. the GitHub status
     */
    async validateInProgressItems(items: ProjectItem[]): Promise<Map<string, boolean>> {
        const validationResults = new Map<string, boolean>();

        for (const item of items) {
            if (item.status !== 'In Progress') {
                continue;
            }

            // For now, we trust the GitHub status
            // In a more advanced implementation, we could:
            // - Check if files mentioned in the item exist
            // - Run tests to verify completion
            // - Check git commits for related work
            validationResults.set(item.id, false); // Assume incomplete
        }

        return validationResults;
    }

    /**
     * Find the next item that should be worked on
     * Prioritizes: In Progress items first, then first Todo item
     */
    findNextItem(state: ProjectState): ProjectItem | undefined {
        // First, check for "In Progress" items
        for (const phase of state.phases) {
            const inProgressItem = phase.items.find(i => i.status === 'In Progress');
            if (inProgressItem) {
                return inProgressItem;
            }
        }

        // Then, find first "Todo" item
        for (const phase of state.phases) {
            const todoItem = phase.items.find(i => i.status === 'Todo' || i.status === '');
            if (todoItem) {
                return todoItem;
            }
        }

        return undefined; // All items complete
    }

    /**
     * Format project state as a readable string
     */
    formatProjectState(state: ProjectState): string {
        let output = `📊 Project #${state.projectNumber} Current State\n\n`;
        output += `**Progress:** ${state.completedItems}/${state.totalItems} items (${state.completionPercentage}%)\n\n`;

        for (const phase of state.phases) {
            const statusIcon = phase.status === 'Done' ? '✓' : phase.status === 'In Progress' ? '⏳' : '○';
            output += `**${phase.name}:** ${phase.status} ${statusIcon}\n`;

            for (const item of phase.items) {
                const itemIcon = item.status === 'Done' ? '✓' : item.status === 'In Progress' ? '⏳' : '○';
                const isNext = state.nextIncompleteItem?.id === item.id ? ' ← NEXT' : '';
                output += `- ${item.title}: ${item.status} ${itemIcon}${isNext}\n`;
            }
            output += '\n';
        }

        if (state.nextIncompleteItem) {
            output += `**Next Action:** Resume work on "${state.nextIncompleteItem.title}"\n`;
        } else {
            output += `**Status:** All items complete! 🎉\n`;
        }

        return output;
    }
}
