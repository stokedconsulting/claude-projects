import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { AuditHistoryService, AuditQueryResult } from './audit-history.service';
import { AuditHistory } from '../../schemas/audit-history.schema';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AuditQueryDto } from './dto';
import { AppLoggerService } from '../../common/logging/app-logger.service';

interface PaginatedAuditResponse {
  items: AuditHistory[];
  total: number;
  limit: number;
  offset: number;
}

@ApiTags('audit-history')
@Controller('audit-history')
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('bearer')
@ApiSecurity('api-key')
export class AuditHistoryController {
  constructor(
    private readonly auditHistoryService: AuditHistoryService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('AuditHistoryController');
  }

  /**
   * GET /audit-history - List all audit records with optional filters
   */
  @Get()
  @ApiOperation({
    summary: 'List all audit records',
    description: 'Get all audit records with optional filtering by workspace, project, operation type, and time range. Supports pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return audit records matching query with pagination metadata',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/AuditHistory' } },
        total: { type: 'number', description: 'Total count of matching records' },
        limit: { type: 'number', description: 'Number of records per page' },
        offset: { type: 'number', description: 'Number of records skipped' },
      },
    },
  })
  async findAll(@Query() queryDto: AuditQueryDto): Promise<PaginatedAuditResponse> {
    this.logger.log('Fetching audit records', {
      filters: {
        workspaceId: queryDto.workspaceId,
        projectNumber: queryDto.projectNumber,
        operationType: queryDto.operationType,
        startTime: queryDto.startTime,
        endTime: queryDto.endTime,
      },
      pagination: {
        limit: queryDto.limit || 50,
        offset: queryDto.offset || 0,
      },
    });

    const result: AuditQueryResult = await this.auditHistoryService.findAll({
      workspaceId: queryDto.workspaceId,
      projectNumber: queryDto.projectNumber,
      operationType: queryDto.operationType,
      startTime: queryDto.startTime,
      endTime: queryDto.endTime,
      limit: queryDto.limit,
      offset: queryDto.offset,
    });

    return {
      items: result.items,
      total: result.total,
      limit: queryDto.limit || 50,
      offset: queryDto.offset || 0,
    };
  }

  /**
   * GET /audit-history/:auditId - Get single record by audit_id
   */
  @Get(':auditId')
  @ApiOperation({
    summary: 'Get audit record by ID',
    description: 'Retrieve a single audit record by its audit_id (UUID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Return audit record',
    type: AuditHistory,
  })
  @ApiResponse({
    status: 404,
    description: 'Audit record not found',
  })
  async findOne(@Param('auditId') auditId: string): Promise<AuditHistory> {
    this.logger.log('Fetching audit record by ID', { auditId });
    return this.auditHistoryService.findById(auditId);
  }

  /**
   * GET /audit-history/workspace/:workspaceId - Records by workspace
   */
  @Get('workspace/:workspaceId')
  @ApiOperation({
    summary: 'Get audit records by workspace',
    description: 'Retrieve all audit records for a specific workspace with optional filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Return audit records for workspace with pagination metadata',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/AuditHistory' } },
        total: { type: 'number', description: 'Total count of matching records' },
        limit: { type: 'number', description: 'Number of records per page' },
        offset: { type: 'number', description: 'Number of records skipped' },
      },
    },
  })
  async findByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Query() queryDto: AuditQueryDto,
  ): Promise<PaginatedAuditResponse> {
    this.logger.log('Fetching audit records by workspace', {
      workspaceId,
      filters: {
        operationType: queryDto.operationType,
        startTime: queryDto.startTime,
        endTime: queryDto.endTime,
      },
      pagination: {
        limit: queryDto.limit || 50,
        offset: queryDto.offset || 0,
      },
    });

    const result: AuditQueryResult = await this.auditHistoryService.findByWorkspace(workspaceId, {
      operationType: queryDto.operationType,
      startTime: queryDto.startTime,
      endTime: queryDto.endTime,
      limit: queryDto.limit,
      offset: queryDto.offset,
    });

    return {
      items: result.items,
      total: result.total,
      limit: queryDto.limit || 50,
      offset: queryDto.offset || 0,
    };
  }

  /**
   * GET /audit-history/project/:projectNumber - Records by project
   */
  @Get('project/:projectNumber')
  @ApiOperation({
    summary: 'Get audit records by project',
    description: 'Retrieve all audit records for a specific GitHub project with optional filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Return audit records for project with pagination metadata',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/AuditHistory' } },
        total: { type: 'number', description: 'Total count of matching records' },
        limit: { type: 'number', description: 'Number of records per page' },
        offset: { type: 'number', description: 'Number of records skipped' },
      },
    },
  })
  async findByProject(
    @Param('projectNumber', ParseIntPipe) projectNumber: number,
    @Query() queryDto: AuditQueryDto,
  ): Promise<PaginatedAuditResponse> {
    this.logger.log('Fetching audit records by project', {
      projectNumber,
      filters: {
        workspaceId: queryDto.workspaceId,
        operationType: queryDto.operationType,
        startTime: queryDto.startTime,
        endTime: queryDto.endTime,
      },
      pagination: {
        limit: queryDto.limit || 50,
        offset: queryDto.offset || 0,
      },
    });

    const result: AuditQueryResult = await this.auditHistoryService.findByProject(projectNumber, {
      workspaceId: queryDto.workspaceId,
      operationType: queryDto.operationType,
      startTime: queryDto.startTime,
      endTime: queryDto.endTime,
      limit: queryDto.limit,
      offset: queryDto.offset,
    });

    return {
      items: result.items,
      total: result.total,
      limit: queryDto.limit || 50,
      offset: queryDto.offset || 0,
    };
  }
}
