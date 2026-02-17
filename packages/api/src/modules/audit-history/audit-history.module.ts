import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditHistoryService } from './audit-history.service';
import { AuditHistory, AuditHistorySchema } from '../../schemas/audit-history.schema';
import { LoggingModule } from '../../common/logging/logging.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditHistory.name, schema: AuditHistorySchema }]),
    LoggingModule,
  ],
  providers: [AuditHistoryService],
  exports: [
    AuditHistoryService,
    MongooseModule.forFeature([{ name: AuditHistory.name, schema: AuditHistorySchema }]),
  ],
})
export class AuditHistoryModule {}
