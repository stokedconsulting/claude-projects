"use strict";
/**
 * MCP Tool Schemas Index
 *
 * Provides JSON Schema definitions and validation for all MCP tools.
 * Each schema follows JSON Schema Draft 2020-12 specification.
 *
 * Exported schemas are organized by tool name and can be imported and
 * validated using external validators (ajv, zod, etc.).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolSchemas = void 0;
exports.getToolSchema = getToolSchema;
exports.listToolSchemas = listToolSchemas;
exports.hasToolSchema = hasToolSchema;
exports.getAllToolSchemas = getAllToolSchemas;
// Import schema definitions
var health_check_json_1 = __importDefault(require("./health-check.json"));
var read_project_json_1 = __importDefault(require("./read-project.json"));
var list_issues_json_1 = __importDefault(require("./list-issues.json"));
var get_project_phases_json_1 = __importDefault(require("./get-project-phases.json"));
var get_issue_details_json_1 = __importDefault(require("./get-issue-details.json"));
var create_issue_json_1 = __importDefault(require("./create-issue.json"));
var update_issue_json_1 = __importDefault(require("./update-issue.json"));
var update_issue_status_json_1 = __importDefault(require("./update-issue-status.json"));
var update_issue_phase_json_1 = __importDefault(require("./update-issue-phase.json"));
/**
 * Tool schema registry organized by tool name
 */
exports.toolSchemas = {
    health_check: health_check_json_1.default,
    read_project: read_project_json_1.default,
    list_issues: list_issues_json_1.default,
    get_project_phases: get_project_phases_json_1.default,
    get_issue_details: get_issue_details_json_1.default,
    create_issue: create_issue_json_1.default,
    update_issue: update_issue_json_1.default,
    update_issue_status: update_issue_status_json_1.default,
    update_issue_phase: update_issue_phase_json_1.default,
};
/**
 * Get schema for a specific tool
 *
 * @param toolName - Name of the tool
 * @returns Schema definition or undefined if tool not found
 */
function getToolSchema(toolName) {
    return exports.toolSchemas[toolName];
}
/**
 * List all available tools
 *
 * @returns Array of tool names
 */
function listToolSchemas() {
    return Object.keys(exports.toolSchemas);
}
/**
 * Check if a tool schema exists
 *
 * @param toolName - Name of the tool
 * @returns True if tool schema exists
 */
function hasToolSchema(toolName) {
    return toolName in exports.toolSchemas;
}
/**
 * Get all tool schemas
 *
 * @returns Object containing all tool schemas keyed by tool name
 */
function getAllToolSchemas() {
    return exports.toolSchemas;
}
