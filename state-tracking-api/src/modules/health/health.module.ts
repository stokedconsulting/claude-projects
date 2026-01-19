import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HeartbeatService } from './heartbeat.service';
import { HeartbeatSchedulerService } from './heartbeat-scheduler.service';
import { SessionsModule } from '../sessions/sessions.module';
import { MachinesModule } from '../machines/machines.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SessionsModule,
    MachinesModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, HeartbeatService, HeartbeatSchedulerService],
  exports: [HeartbeatService],
})
export class HealthModule {}
