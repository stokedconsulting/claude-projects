/**
 * MCP Tool Schemas Index
 *
 * Provides JSON Schema definitions and validation for all MCP tools.
 * Each schema follows JSON Schema Draft 2020-12 specification.
 *
 * Exported schemas are organized by tool name and can be imported and
 * validated using external validators (ajv, zod, etc.).
 */

// Import schema definitions
import healthCheckSchema from './health-check.json';
import readProjectSchema from './read-project.json';
import listIssuesSchema from './list-issues.json';
import getProjectPhasesSchema from './get-project-phases.json';
import getIssueDetailsSchema from './get-issue-details.json';
import createIssueSchema from './create-issue.json';
import updateIssueSchema from './update-issue.json';
import updateIssueStatusSchema from './update-issue-status.json';
import updateIssuePhaseSchema from './update-issue-phase.json';

/**
 * Tool schema registry organized by tool name
 */
export const toolSchemas = {
  health_check: healthCheckSchema,
  read_project: readProjectSchema,
  list_issues: listIssuesSchema,
  get_project_phases: getProjectPhasesSchema,
  get_issue_details: getIssueDetailsSchema,
  create_issue: createIssueSchema,
  update_issue: updateIssueSchema,
  update_issue_status: updateIssueStatusSchema,
  update_issue_phase: updateIssuePhaseSchema,
} as const;

/**
 * Tool names type for type safety
 */
export type ToolName = keyof typeof toolSchemas;

/**
 * Get schema for a specific tool
 *
 * @param toolName - Name of the tool
 * @returns Schema definition or undefined if tool not found
 */
export function getToolSchema(toolName: string): unknown {
  return toolSchemas[toolName as ToolName];
}

/**
 * List all available tools
 *
 * @returns Array of tool names
 */
export function listToolSchemas(): ToolName[] {
  return Object.keys(toolSchemas) as ToolName[];
}

/**
 * Check if a tool schema exists
 *
 * @param toolName - Name of the tool
 * @returns True if tool schema exists
 */
export function hasToolSchema(toolName: string): boolean {
  return toolName in toolSchemas;
}

/**
 * Get all tool schemas
 *
 * @returns Object containing all tool schemas keyed by tool name
 */
export function getAllToolSchemas(): typeof toolSchemas {
  return toolSchemas;
}
