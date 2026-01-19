import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { SessionHealthService } from './session-health.service';
import { Session } from '../../schemas/session.schema';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { StaleSessionDto } from './dto/stale-session.dto';
import { ActiveSessionDto } from './dto/active-session.dto';
import { SessionHealthDto } from './dto/session-health.dto';
import { ProjectSessionsSummaryDto } from './dto/project-sessions-summary.dto';
import { HeartbeatResponseDto } from './dto/heartbeat-response.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionQueryDto } from './dto/session-query.dto';

@ApiTags('sessions')
@Controller('sessions')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('bearer')
@ApiSecurity('api-key')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionHealthService: SessionHealthService,
  ) {}

  @Get('stale')
  @ApiOperation({
    summary: 'Find stale sessions',
    description: 'Returns sessions where last_heartbeat is older than the threshold. Default threshold is 300 seconds (5 minutes).'
  })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Threshold in seconds (default: 300)' })
  @ApiResponse({ status: 200, description: 'Return stale sessions', type: [StaleSessionDto] })
  async findStaleSessions(
    @Query('threshold') threshold?: number,
  ): Promise<StaleSessionDto[]> {
    const thresholdSeconds = threshold ? Number(threshold) : undefined;
    return this.sessionHealthService.findStaleSessions(thresholdSeconds);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Find active sessions',
    description: 'Returns all sessions with status="active". Supports filtering by project_id and machine_id.'
  })
  @ApiQuery({ name: 'project_id', required: false, type: String, description: 'Filter by project ID' })
  @ApiQuery({ name: 'machine_id', required: false, type: String, description: 'Filter by machine ID' })
  @ApiResponse({ status: 200, description: 'Return active sessions', type: [ActiveSessionDto] })
  async findActiveSessions(
    @Query('project_id') projectId?: string,
    @Query('machine_id') machineId?: string,
  ): Promise<ActiveSessionDto[]> {
    return this.sessionHealthService.findActiveSessions(projectId, machineId);
  }

  @Get('by-project/:projectId')
  @ApiOperation({
    summary: 'Get sessions by project',
    description: 'Returns all sessions for a GitHub Project, grouped by status with summary statistics.'
  })
  @ApiResponse({ status: 200, description: 'Return project sessions summary', type: ProjectSessionsSummaryDto })
  async findSessionsByProject(
    @Param('projectId') projectId: string,
  ): Promise<ProjectSessionsSummaryDto> {
    return this.sessionHealthService.findSessionsByProject(projectId);
  }

  @Get('by-machine/:machineId')
  @ApiOperation({
    summary: 'Get sessions by machine',
    description: 'Returns all sessions for a specific machine, including docker slot assignments.'
  })
  @ApiResponse({ status: 200, description: 'Return machine sessions', type: [Session] })
  async findSessionsByMachine(
    @Param('machineId') machineId: string,
  ): Promise<Session[]> {
    return this.sessionHealthService.findSessionsByMachine(machineId);
  }

  @Get(':id/health')
  @ApiOperation({
    summary: 'Get session health status',
    description: 'Returns comprehensive health information for a session, including staleness check and recommendations.'
  })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Stale threshold in seconds (default: 300)' })
  @ApiResponse({ status: 200, description: 'Return session health', type: SessionHealthDto })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionHealth(
    @Param('id') id: string,
    @Query('threshold') threshold?: number,
  ): Promise<SessionHealthDto> {
    const thresholdSeconds = threshold ? Number(threshold) : undefined;
    const health = await this.sessionHealthService.getSessionHealth(id, thresholdSeconds);
    if (!health) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return health;
  }

  @Get()
  @ApiOperation({
    summary: 'List all sessions',
    description: 'Retrieve all sessions with optional filtering by status, project_id, machine_id, and pagination support.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved sessions',
    type: [Session],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async findAll(@Query() queryDto: SessionQueryDto): Promise<Session[]> {
    return this.sessionsService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get session by ID',
    description: 'Retrieve a single session by its unique session_id.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique session identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved session',
    type: Session,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async findOne(@Param('id') id: string): Promise<Session> {
    return this.sessionsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new session',
    description: 'Create a new session. Session ID (UUID v4) is auto-generated. Status defaults to "active", and timestamps are set automatically.',
  })
  @ApiBody({
    type: CreateSessionDto,
    examples: {
      'application/json': {
        value: {
          project_id: '123',
          machine_id: 'macbook-pro-m1',
          docker_slot: 1,
          metadata: {
            vscode_version: '1.85.0',
            extension_version: '0.1.0',
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    type: Session,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSessionDto: CreateSessionDto): Promise<Session> {
    return this.sessionsService.create(createSessionDto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update session',
    description: 'Update session fields. Immutable fields (session_id, project_id, machine_id, started_at) cannot be updated. Metadata is merged with existing values.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique session identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({
    type: UpdateSessionDto,
    examples: {
      'application/json': {
        value: {
          status: 'paused',
          current_task_id: 'task-uuid-456',
          metadata: {
            notes: 'Pausing for lunch break',
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Session updated successfully',
    type: Session,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update data',
  })
  async update(
    @Param('id') id: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ): Promise<Session> {
    return this.sessionsService.update(id, updateSessionDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete session (soft delete)',
    description: 'Soft delete a session by setting status to "completed" and completed_at to current timestamp. Does not physically remove the document.',
  })
  @ApiParam({
    name: 'id',
    description: 'The unique session identifier (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 204,
    description: 'Session deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.sessionsService.delete(id);
  }

  @Post(':id/heartbeat')
  @ApiOperation({
    summary: 'Update session heartbeat',
    description: 'Updates the last_heartbeat timestamp for a session. If the session is stalled, it will be changed back to active. Cannot update heartbeat for completed or failed sessions. Recommended heartbeat interval: 60 seconds.'
  })
  @ApiResponse({ status: 200, description: 'Heartbeat updated successfully', type: HeartbeatResponseDto })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 400, description: 'Cannot update heartbeat for completed/failed session' })
  @HttpCode(HttpStatus.OK)
  async updateHeartbeat(@Param('id') id: string): Promise<HeartbeatResponseDto> {
    const session = await this.sessionsService.updateHeartbeat(id);

    return {
      session_id: session.session_id,
      status: session.status,
      last_heartbeat: session.last_heartbeat,
      message: session.status === 'active'
        ? 'Heartbeat updated successfully'
        : `Heartbeat updated and session reactivated from stalled state`
    };
  }
}
