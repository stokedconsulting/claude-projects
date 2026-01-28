import * as fs from 'fs';
import * as path from 'path';
import { ParsedIdea } from './ideation-executor';
import { ProjectQueueManager } from './project-queue-manager';

/**
 * Result of project creation attempt
 */
export interface ProjectCreationResult {
  success: boolean;
  projectNumber?: number;
  issueNumber?: number;
  error?: string;
  labels?: string[];
}

/**
 * Data structure for tracking self-generated projects
 */
export interface SelfGeneratedProjectData {
  projectNumber: number;
  issueNumber: number;
  category: string;
  ideatedByAgentId: string;
  createdAt: string;
}

/**
 * Internal storage format for self-generated projects
 */
interface SelfGeneratedProjectsStorage {
  projects: SelfGeneratedProjectData[];
}

/**
 * Configuration constants
 */
const SELF_GENERATED_FILE = 'self-generated-projects.json';
const PROJECT_CREATE_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Format a validated idea as input for /project-create command
 *
 * Output format:
 * /project-create {category}: {title}
 *
 * {description}
 *
 * Acceptance Criteria:
 * {acceptanceCriteria}
 *
 * Technical Approach:
 * {technicalApproach}
 *
 * @param idea - The validated idea to format
 * @returns Formatted string for /project-create
 */
export function formatProjectCreateInput(idea: ParsedIdea): string {
  const lines: string[] = [];

  // Command header with category and title
  lines.push(`/project-create ${idea.category}: ${idea.title}`);
  lines.push('');

  // Description
  lines.push(idea.description);
  lines.push('');

  // Acceptance Criteria
  lines.push('Acceptance Criteria:');
  for (const criterion of idea.acceptanceCriteria) {
    lines.push(`- ${criterion}`);
  }
  lines.push('');

  // Technical Approach
  lines.push('Technical Approach:');
  lines.push(idea.technicalApproach);

  return lines.join('\n');
}

/**
 * Parse the response from /project-create command to extract project number
 *
 * Expected response patterns:
 * - "Created project #123"
 * - "Project 123 created successfully"
 * - "GitHub project #123 has been created"
 *
 * @param response - Raw response from /project-create command
 * @returns Extracted project number, or null if parsing fails
 */
export function parseProjectCreateResponse(response: string): number | null {
  // Try multiple regex patterns to match project numbers
  const patterns = [
    /Created project #(\d+)/i,
    /Project (\d+) created/i,
    /GitHub project #(\d+)/i,
    /project #(\d+)/i,
    /#(\d+)/
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match && match[1]) {
      const projectNumber = parseInt(match[1], 10);
      if (!isNaN(projectNumber)) {
        return projectNumber;
      }
    }
  }

  console.error('[ProjectCreator] Failed to parse project number from response:', response);
  return null;
}

/**
 * Simulate execution of /project-create command
 * In production, this would actually invoke Claude Code CLI
 *
 * @param input - Formatted project-create input
 * @returns Promise resolving to simulated response
 */
async function simulateProjectCreate(input: string): Promise<string> {
  // For now, return a mock response
  // In production, this would execute:
  // - `claude-code /project-create` with input piped to stdin
  // - Or call Claude API directly

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Extract title from input to create realistic mock response
  const titleMatch = input.match(/\/project-create [^:]+: (.+)/);
  const title = titleMatch ? titleMatch[1] : 'Project';

  // Simulate success response with project number
  const mockProjectNumber = Math.floor(Math.random() * 1000) + 1;
  return `Created project #${mockProjectNumber}: ${title}`;
}

/**
 * Add labels to a GitHub issue
 * In production, this would use GitHub API to add labels
 *
 * @param issueNumber - GitHub issue number
 * @param category - Category name for label
 * @returns Promise resolving when labels are added
 */
export async function addProjectLabels(
  issueNumber: number,
  category: string
): Promise<void> {
  // For now, log the operation
  // In production, this would use GitHub API:
  // - POST /repos/{owner}/{repo}/issues/{issueNumber}/labels
  // - Body: ["agent-generated", `category:${category}`]

  console.log(
    `[ProjectCreator] Adding labels to issue #${issueNumber}: agent-generated, category:${category}`
  );

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50));
}

/**
 * Enqueue a newly created project to the work queue
 *
 * @param projectNumber - GitHub project number
 * @param issueNumber - GitHub issue number
 * @param queueManager - ProjectQueueManager instance
 * @returns Promise resolving when project is enqueued
 */
export async function enqueueNewProject(
  projectNumber: number,
  issueNumber: number,
  queueManager: ProjectQueueManager
): Promise<void> {
  console.log(
    `[ProjectCreator] Enqueueing project #${projectNumber} (issue #${issueNumber}) to work queue`
  );

  // The project will be available in the queue automatically
  // No explicit enqueue needed - just ensure it's not claimed
  // Other agents will discover it via getAvailableProjects()

  // In production, you might want to notify other agents or trigger a queue refresh
  // For now, just log the operation
}

/**
 * Get the full path to the self-generated projects file
 */
function getSelfGeneratedFilePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }

  const claudeSessionsDir = path.join(homeDir, '.claude-sessions');
  return path.join(claudeSessionsDir, SELF_GENERATED_FILE);
}

/**
 * Ensure the .claude-sessions directory exists
 */
function ensureSessionsDirectory(): void {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }

  const claudeSessionsDir = path.join(homeDir, '.claude-sessions');

  if (!fs.existsSync(claudeSessionsDir)) {
    fs.mkdirSync(claudeSessionsDir, { recursive: true });
  }
}

/**
 * Load self-generated projects data from disk
 */
function loadSelfGeneratedProjects(): SelfGeneratedProjectsStorage {
  const filePath = getSelfGeneratedFilePath();

  if (!fs.existsSync(filePath)) {
    return { projects: [] };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as SelfGeneratedProjectsStorage;
  } catch (error) {
    console.error('[ProjectCreator] Error reading self-generated projects file:', error);
    return { projects: [] };
  }
}

/**
 * Save self-generated projects data to disk atomically
 */
function saveSelfGeneratedProjects(data: SelfGeneratedProjectsStorage): void {
  ensureSessionsDirectory();

  const filePath = getSelfGeneratedFilePath();
  const tempPath = `${filePath}.tmp`;

  try {
    // Write to temp file
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');

    // Atomically rename
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(
      `Failed to save self-generated projects: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Track a self-generated project for metrics and auditing
 *
 * @param data - Self-generated project data to track
 * @returns Promise resolving when data is saved
 */
export async function trackSelfGeneratedProject(
  data: SelfGeneratedProjectData
): Promise<void> {
  const storage = loadSelfGeneratedProjects();

  // Check if already tracked (prevent duplicates)
  const exists = storage.projects.some(
    p => p.projectNumber === data.projectNumber && p.issueNumber === data.issueNumber
  );

  if (exists) {
    console.log(
      `[ProjectCreator] Project #${data.projectNumber} already tracked`
    );
    return;
  }

  storage.projects.push(data);
  saveSelfGeneratedProjects(storage);

  console.log(
    `[ProjectCreator] Tracked self-generated project #${data.projectNumber} (category: ${data.category})`
  );
}

/**
 * Get weekly generation rate for a specific category
 *
 * @param category - Category name
 * @returns Number of projects generated in the last 7 days
 */
export async function getWeeklyGenerationRate(category: string): Promise<number> {
  const storage = loadSelfGeneratedProjects();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentProjects = storage.projects.filter(p => {
    if (p.category !== category) {
      return false;
    }

    const createdDate = new Date(p.createdAt);
    return createdDate >= oneWeekAgo;
  });

  return recentProjects.length;
}

/**
 * Create a GitHub project from a validated idea
 *
 * This function orchestrates the complete project creation workflow:
 * 1. Format idea as /project-create input
 * 2. Execute /project-create command (simulated)
 * 3. Parse response to extract project number
 * 4. Add labels to the issue
 * 5. Enqueue new project to work queue
 * 6. Track self-generated project
 *
 * AC-4.4.a: When idea is validated → /project-create command is formatted within 30 seconds
 * AC-4.4.b: When project is created → issue has agent-generated and category labels
 * AC-4.4.c: When project is created → project number is extracted and stored
 * AC-4.4.d: When project is enqueued → any execution agent can claim it
 * AC-4.4.e: When /project-create fails → error is logged and returned
 * AC-4.4.f: When agent completes creation → agent status returns to idle
 *
 * @param idea - The validated idea to create a project from
 * @param agentId - Agent identifier for tracking
 * @param queueManager - ProjectQueueManager instance for enqueueing
 * @returns Promise resolving to ProjectCreationResult
 */
export async function createProjectFromIdea(
  idea: ParsedIdea,
  agentId: string,
  queueManager: ProjectQueueManager
): Promise<ProjectCreationResult> {
  const startTime = Date.now();

  try {
    // Step 1: Format the input for /project-create
    const input = formatProjectCreateInput(idea);
    console.log('[ProjectCreator] Formatted project-create input:', input);

    // Check AC-4.4.a: within 30 seconds
    const formatDuration = Date.now() - startTime;
    if (formatDuration > PROJECT_CREATE_TIMEOUT_MS) {
      return {
        success: false,
        error: `Project creation timed out after ${formatDuration}ms`
      };
    }

    // Step 2: Execute /project-create command (simulated)
    const response = await simulateProjectCreate(input);
    console.log('[ProjectCreator] Project-create response:', response);

    // Step 3: Parse response to extract project number
    const projectNumber = parseProjectCreateResponse(response);

    if (!projectNumber) {
      return {
        success: false,
        error: 'Failed to parse project number from response'
      };
    }

    // For simulation, generate a mock issue number
    // In production, this would be returned by /project-create or fetched from GitHub API
    const issueNumber = projectNumber + 1000;

    // Step 4: Add labels to the issue
    await addProjectLabels(issueNumber, idea.category);

    const labels = ['agent-generated', `category:${idea.category}`];

    // Step 5: Enqueue the new project
    await enqueueNewProject(projectNumber, issueNumber, queueManager);

    // Step 6: Track self-generated project
    await trackSelfGeneratedProject({
      projectNumber,
      issueNumber,
      category: idea.category,
      ideatedByAgentId: agentId,
      createdAt: new Date().toISOString()
    });

    // Success!
    console.log(
      `[ProjectCreator] Successfully created project #${projectNumber} (issue #${issueNumber})`
    );

    return {
      success: true,
      projectNumber,
      issueNumber,
      labels
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ProjectCreator] Project creation failed:', errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Get all self-generated projects
 *
 * @returns Array of all tracked self-generated projects
 */
export async function getAllSelfGeneratedProjects(): Promise<SelfGeneratedProjectData[]> {
  const storage = loadSelfGeneratedProjects();
  return storage.projects;
}

/**
 * Get self-generated projects by category
 *
 * @param category - Category name to filter by
 * @returns Array of self-generated projects in the category
 */
export async function getSelfGeneratedProjectsByCategory(
  category: string
): Promise<SelfGeneratedProjectData[]> {
  const storage = loadSelfGeneratedProjects();
  return storage.projects.filter(p => p.category === category);
}

/**
 * Clear all self-generated project tracking (for testing)
 * WARNING: This will remove ALL tracked projects
 */
export async function clearSelfGeneratedProjects(): Promise<void> {
  saveSelfGeneratedProjects({ projects: [] });
  console.log('[ProjectCreator] Cleared all self-generated projects');
}
