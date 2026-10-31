import { Module } from '@nestjs/common';
import { TimeLoggingController } from './time-logging.controller';
import { TimeLoggingService } from './time-logging.service';
import { PrismaModule } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimeLoggingController],
  providers: [TimeLoggingService],
  exports: [TimeLoggingService],
})
export class TimeLoggingModule {}
