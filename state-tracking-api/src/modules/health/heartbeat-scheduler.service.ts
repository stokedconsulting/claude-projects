import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HeartbeatService } from './heartbeat.service';

/**
 * Scheduled jobs for heartbeat health monitoring
 */
@Injectable()
export class HeartbeatSchedulerService {
  private readonly logger = new Logger(HeartbeatSchedulerService.name);

  constructor(private readonly heartbeatService: HeartbeatService) {}

  /**
   * Runs every minute to detect stale sessions and offline machines
   * Stale threshold: 5 minutes for sessions
   * Offline threshold: 10 minutes for machines
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleHealthCheck() {
    this.logger.debug('Starting scheduled heartbeat health check...');

    try {
      const result = await this.heartbeatService.runHealthCheck();

      // Log results if any issues were found
      if (result.stalledSessions.length > 0) {
        this.logger.warn(
          `Marked ${result.stalledSessions.length} sessions as stalled: ${result.stalledSessions.join(', ')}`
        );
      }

      if (result.offlineMachines.length > 0) {
        this.logger.warn(
          `Marked ${result.offlineMachines.length} machines as offline: ${result.offlineMachines.join(', ')}`
        );
      }
    } catch (error) {
      this.logger.error('Failed to run scheduled heartbeat health check', error);
    }
  }
}
