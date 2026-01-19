import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionCleanupService } from './session-cleanup.service';

/**
 * Scheduled jobs for session cleanup and archival
 * Handles automatic cleanup of old sessions and TTL warnings
 */
@Injectable()
export class SessionCleanupSchedulerService {
  private readonly logger = new Logger(SessionCleanupSchedulerService.name);

  constructor(private readonly cleanupService: SessionCleanupService) {}

  /**
   * Daily job to archive old completed sessions (> 90 days)
   * Runs every day at 2:00 AM UTC
   * Archived sessions are kept in the database but excluded from normal queries
   */
  @Cron('0 2 * * *') // Every day at 2:00 AM UTC
  async handleDailyArchiveOldSessions(): Promise<void> {
    this.logger.debug('Starting daily archive of old completed sessions...');

    try {
      const result = await this.cleanupService.cleanupOldArchivedSessions();

      if (result.archived_count > 0) {
        this.logger.log(
          `Successfully archived ${result.archived_count} old sessions`
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to archive old sessions',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Weekly job to warn about sessions approaching TTL (30 days)
   * Runs every Monday at 3:00 AM UTC
   * Identifies sessions that will be auto-deleted by MongoDB TTL index in ~5 days
   */
  @Cron('0 3 * * 1') // Every Monday at 3:00 AM UTC
  async handleWeeklyTTLWarning(): Promise<void> {
    this.logger.debug('Starting weekly TTL warning check...');

    try {
      const sessionIds = await this.cleanupService.findSessionsApproachingTTL();

      if (sessionIds.length > 0) {
        this.logger.warn(
          `WARNING: ${sessionIds.length} sessions will be auto-deleted by TTL in ~5 days. ` +
          `Consider archiving them first if you want to keep historical records. ` +
          `Session IDs: ${sessionIds.slice(0, 5).join(', ')}${sessionIds.length > 5 ? '...' : ''}`
        );
      } else {
        this.logger.debug('No sessions approaching TTL');
      }
    } catch (error) {
      this.logger.error(
        'Failed to check for sessions approaching TTL',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
