import { IsOptional, IsString, IsNumber, Min, Max, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AuditQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by workspace ID',
    example: 'workspace-123',
  })
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by GitHub project number',
    example: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  projectNumber?: number;

  @ApiPropertyOptional({
    description: 'Filter by operation type (e.g., "task.started", "session.created")',
    example: 'task.started',
  })
  @IsOptional()
  @IsString()
  operationType?: string;

  @ApiPropertyOptional({
    description: 'Filter by start time (ISO 8601 format)',
    example: '2026-02-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Filter by end time (ISO 8601 format)',
    example: '2026-02-17T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of records to return',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of records to skip (for pagination)',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
