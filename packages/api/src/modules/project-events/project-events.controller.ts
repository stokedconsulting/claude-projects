import { Controller, Post, Put, Get, Param, Body, HttpCode, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { OrchestrationGateway } from '../orchestration/orchestration.gateway';
import { ProjectEvent, PROJECT_EVENT_TYPES } from './project-event.types';
import { AuditHistoryService } from '../audit-history/audit-history.service';
import { HttpMethod } from '../../schemas/audit-history.schema';
import {
  ProjectCache,
  ProjectCacheDocument,
} from '../../schemas/project-cache.schema';

@Controller('api/events')
export class ProjectEventsController {
  private recentEvents: Map<number, ProjectEvent[]> = new Map();
  private static readonly MAX_EVENTS_PER_PROJECT = 50;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly gateway: OrchestrationGateway,
    private readonly auditHistoryService: AuditHistoryService,
    @InjectModel(ProjectCache.name)
    private readonly projectCacheModel: Model<ProjectCacheDocument>,
  ) {
    this.logger.setContext('ProjectEventsController');
  }

  @Post('project')
  @HttpCode(202)
  handleProjectEvent(@Body() event: ProjectEvent) {
    const projectNumber = (event.data as any).projectNumber;

    if (!event.type || !event.data || !projectNumber) {
      this.logger.warn('Invalid project event received', { event });
      return { accepted: false, error: 'Missing type, data, or projectNumber' };
    }

    // Validate event type
    if (!PROJECT_EVENT_TYPES.includes(event.type)) {
      this.logger.warn('Unknown project event type', { type: event.type, projectNumber });
      throw new BadRequestException(`Unknown event type: ${event.type}`);
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    this.logger.log('Project event received', {
      type: event.type,
      projectNumber,
      event: 'project_event.received',
    });

    // Buffer event for replay
    this.bufferEvent(projectNumber, event);

    // Broadcast via Socket.io gateway
    this.gateway.broadcastProjectEvent(projectNumber, event);

    // Write audit record for the event
    try {
      const eventData = event.data as any;
      this.auditHistoryService.writeAuditRecord({
        api_endpoint: '/api/events/project',
        http_method: HttpMethod.POST,
        operation_type: event.type,
        project_number: projectNumber,
        workspace_id: eventData.workspaceId || undefined,
        worktree_path: eventData.worktreePath || undefined,
        response_status: 202,
        duration_ms: 0,
        request_summary: { type: event.type, projectNumber },
      });
    } catch (error) {
      this.logger.warn('Failed to write audit record for project event', {
        error: error instanceof Error ? error.message : error,
      });
    }

    return {
      accepted: true,
      type: event.type,
      projectNumber,
      timestamp: event.timestamp,
    };
  }

  private bufferEvent(projectNumber: number, event: ProjectEvent): void {
    if (!this.recentEvents.has(projectNumber)) {
      this.recentEvents.set(projectNumber, []);
    }

    const events = this.recentEvents.get(projectNumber)!;
    events.push(event);

    // Keep only the most recent events
    if (events.length > ProjectEventsController.MAX_EVENTS_PER_PROJECT) {
      events.splice(0, events.length - ProjectEventsController.MAX_EVENTS_PER_PROJECT);
    }
  }

  /**
   * Update worktree status for a project.
   * Persists to MongoDB and broadcasts via Socket.io.
   */
  @Put('worktree/:projectNumber')
  @HttpCode(200)
  async updateWorktreeStatus(
    @Param('projectNumber', ParseIntPipe) projectNumber: number,
    @Body()
    body: {
      hasWorktree: boolean;
      worktreePath: string;
      branch: string;
      hasUncommittedChanges: boolean;
      hasUnpushedCommits: boolean;
      hasPR: boolean;
      prNumber: number | null;
      prMerged: boolean;
      workspaceId?: string;
    },
  ) {
    this.logger.log('Worktree status update received', {
      projectNumber,
      hasWorktree: body.hasWorktree,
      branch: body.branch,
      event: 'worktree_status.update',
    });

    // Upsert into project cache
    const worktreeStatus = {
      has_worktree: body.hasWorktree,
      worktree_path: body.worktreePath,
      branch: body.branch,
      has_uncommitted_changes: body.hasUncommittedChanges,
      has_unpushed_commits: body.hasUnpushedCommits,
      has_pr: body.hasPR,
      pr_number: body.prNumber,
      pr_merged: body.prMerged,
      updated_at: new Date(),
      updated_by_workspace: body.workspaceId,
    };

    try {
      await this.projectCacheModel.findOneAndUpdate(
        { project_number: projectNumber },
        { $set: { worktree_status: worktreeStatus } },
        { upsert: false }, // Don't create if project cache doesn't exist
      );
    } catch (error) {
      this.logger.warn('Failed to persist worktree status to cache', {
        projectNumber,
        error: error instanceof Error ? error.message : error,
      });
      // Non-fatal — still broadcast the event
    }

    // Broadcast via Socket.io so other extensions get the update
    this.gateway.broadcastProjectEvent(projectNumber, {
      type: 'worktree.updated' as any,
      data: {
        projectNumber,
        worktree: {
          hasWorktree: body.hasWorktree,
          worktreePath: body.worktreePath,
          branch: body.branch,
          hasUncommittedChanges: body.hasUncommittedChanges,
          hasUnpushedCommits: body.hasUnpushedCommits,
          hasPR: body.hasPR,
          prNumber: body.prNumber,
          prMerged: body.prMerged,
        },
      },
    });

    return {
      accepted: true,
      projectNumber,
      worktreeStatus,
    };
  }

  /**
   * Get cached worktree status for a project.
   */
  @Get('worktree/:projectNumber')
  async getWorktreeStatus(
    @Param('projectNumber', ParseIntPipe) projectNumber: number,
  ) {
    const cached = await this.projectCacheModel
      .findOne({ project_number: projectNumber })
      .select('worktree_status')
      .lean()
      .exec();

    if (!cached || !cached.worktree_status) {
      return { projectNumber, worktree: null };
    }

    const wt = cached.worktree_status;
    return {
      projectNumber,
      worktree: {
        hasWorktree: wt.has_worktree,
        worktreePath: wt.worktree_path,
        branch: wt.branch,
        hasUncommittedChanges: wt.has_uncommitted_changes,
        hasUnpushedCommits: wt.has_unpushed_commits,
        hasPR: wt.has_pr,
        prNumber: wt.pr_number,
        prMerged: wt.pr_merged,
        updatedAt: wt.updated_at,
        updatedByWorkspace: wt.updated_by_workspace,
      },
    };
  }
}
