import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AuditHistory, AuditHistoryDocument } from '../../schemas/audit-history.schema';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { randomUUID } from 'crypto';

export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  operationType?: string;
  workspaceId?: string;
  projectNumber?: number;
  startTime?: string;
  endTime?: string;
}

export interface AuditQueryResult {
  items: AuditHistory[];
  total: number;
}

@Injectable()
export class AuditHistoryService {
  private retryBuffer: any[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  constructor(
    @InjectModel(AuditHistory.name) private auditModel: Model<AuditHistoryDocument>,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext('AuditHistoryService');
  }

  /**
   * Write an audit record asynchronously (fire-and-forget)
   * @param data - Partial audit record data
   * @returns void (non-blocking)
   */
  writeAuditRecord(data: Partial<AuditHistory>): void {
    const record = {
      audit_id: randomUUID(),
      timestamp: new Date(),
      ...data,
    };

    // Fire-and-forget write with retry buffer
    this.auditModel.create(record)
      .then(() => {
        // If buffer has entries, flush them
        if (this.retryBuffer.length > 0) {
          const buffered = [...this.retryBuffer];
          this.retryBuffer = [];

          // Attempt to write buffered records
          Promise.all(buffered.map(r =>
            this.auditModel.create(r).catch((err) => {
              // Re-buffer if still failing
              if (this.retryBuffer.length < this.MAX_BUFFER_SIZE) {
                this.retryBuffer.push(r);
              } else {
                this.logger.warn('Audit buffer full during flush, dropping record', {
                  audit_id: r.audit_id,
                  error: err.message
                });
              }
            })
          )).catch(() => {
            // Catch any unexpected errors during buffer flush
            this.logger.warn('Error flushing audit buffer');
          });
        }
      })
      .catch((error) => {
        this.logger.warn('Audit write failed, buffering record', {
          error: error.message,
          audit_id: record.audit_id,
          buffer_size: this.retryBuffer.length
        });

        if (this.retryBuffer.length < this.MAX_BUFFER_SIZE) {
          this.retryBuffer.push(record);
        } else {
          this.logger.warn('Audit buffer full, dropping oldest entry', {
            dropped_audit_id: this.retryBuffer[0].audit_id,
            new_audit_id: record.audit_id
          });
          this.retryBuffer.shift();
          this.retryBuffer.push(record);
        }
      });
  }

  /**
   * Find audit records by workspace ID
   * @param workspaceId - Workspace identifier
   * @param options - Query options (pagination, filters)
   * @returns Audit records and total count
   */
  async findByWorkspace(workspaceId: string, options?: AuditQueryOptions): Promise<AuditQueryResult> {
    const filter: FilterQuery<AuditHistoryDocument> = { workspace_id: workspaceId };

    if (options?.operationType) {
      filter.operation_type = options.operationType;
    }

    if (options?.startTime || options?.endTime) {
      filter.timestamp = {};
      if (options.startTime) {
        filter.timestamp.$gte = new Date(options.startTime);
      }
      if (options.endTime) {
        filter.timestamp.$lte = new Date(options.endTime);
      }
    }

    const limit = Math.min(options?.limit || 50, 200);
    const offset = options?.offset || 0;

    const [items, total] = await Promise.all([
      this.auditModel.find(filter).sort({ timestamp: -1 }).limit(limit).skip(offset).exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /**
   * Find audit records by project number
   * @param projectNumber - GitHub project number
   * @param options - Query options (pagination, filters)
   * @returns Audit records and total count
   */
  async findByProject(projectNumber: number, options?: AuditQueryOptions): Promise<AuditQueryResult> {
    const filter: FilterQuery<AuditHistoryDocument> = { project_number: projectNumber };

    if (options?.operationType) {
      filter.operation_type = options.operationType;
    }

    if (options?.startTime || options?.endTime) {
      filter.timestamp = {};
      if (options.startTime) {
        filter.timestamp.$gte = new Date(options.startTime);
      }
      if (options.endTime) {
        filter.timestamp.$lte = new Date(options.endTime);
      }
    }

    const limit = Math.min(options?.limit || 50, 200);
    const offset = options?.offset || 0;

    const [items, total] = await Promise.all([
      this.auditModel.find(filter).sort({ timestamp: -1 }).limit(limit).skip(offset).exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /**
   * Find a single audit record by audit ID
   * @param auditId - Audit record UUID
   * @returns Audit record
   * @throws NotFoundException if audit record not found
   */
  async findById(auditId: string): Promise<AuditHistory> {
    const audit = await this.auditModel
      .findOne({ audit_id: auditId })
      .exec();

    if (!audit) {
      throw new NotFoundException(`Audit record with ID ${auditId} not found`);
    }

    return audit;
  }

  /**
   * Find all audit records with optional filtering and pagination
   * @param options - Query options (filters, pagination)
   * @returns Audit records and total count
   */
  async findAll(options?: AuditQueryOptions): Promise<AuditQueryResult> {
    const filter: FilterQuery<AuditHistoryDocument> = {};

    if (options?.workspaceId) {
      filter.workspace_id = options.workspaceId;
    }

    if (options?.projectNumber) {
      filter.project_number = options.projectNumber;
    }

    if (options?.operationType) {
      filter.operation_type = options.operationType;
    }

    if (options?.startTime || options?.endTime) {
      filter.timestamp = {};
      if (options.startTime) {
        filter.timestamp.$gte = new Date(options.startTime);
      }
      if (options.endTime) {
        filter.timestamp.$lte = new Date(options.endTime);
      }
    }

    const limit = Math.min(options?.limit || 50, 200);
    const offset = options?.offset || 0;

    const [items, total] = await Promise.all([
      this.auditModel.find(filter).sort({ timestamp: -1 }).limit(limit).skip(offset).exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /**
   * Count audit records matching the given filter
   * @param filter - MongoDB filter query
   * @returns Total count of matching records
   */
  async countByFilter(filter: FilterQuery<AuditHistoryDocument>): Promise<number> {
    return this.auditModel.countDocuments(filter).exec();
  }

  /**
   * Get current retry buffer size (for monitoring/debugging)
   * @returns Number of buffered records awaiting retry
   */
  getBufferSize(): number {
    return this.retryBuffer.length;
  }

  /**
   * Clear the retry buffer (for testing/maintenance)
   * @returns Number of records that were in the buffer
   */
  clearBuffer(): number {
    const size = this.retryBuffer.length;
    this.retryBuffer = [];
    this.logger.log('Audit retry buffer cleared', { records_cleared: size });
    return size;
  }
}
