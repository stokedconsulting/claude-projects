import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionHealthService } from './session-health.service';
import { Session, SessionSchema } from '../../schemas/session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService, SessionHealthService],
  exports: [SessionsService, SessionHealthService],
})
export class SessionsModule {}
