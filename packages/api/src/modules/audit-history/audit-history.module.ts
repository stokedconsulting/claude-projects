import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditHistoryService } from './audit-history.service';
import { AuditHistoryController } from './audit-history.controller';
import { AuditHistory, AuditHistorySchema } from '../../schemas/audit-history.schema';
import { LoggingModule } from '../../common/logging/logging.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditHistory.name, schema: AuditHistorySchema }]),
    LoggingModule,
    AuthModule,
  ],
  controllers: [AuditHistoryController],
  providers: [AuditHistoryService],
  exports: [
    AuditHistoryService,
    MongooseModule.forFeature([{ name: AuditHistory.name, schema: AuditHistorySchema }]),
  ],
})
export class AuditHistoryModule {}
