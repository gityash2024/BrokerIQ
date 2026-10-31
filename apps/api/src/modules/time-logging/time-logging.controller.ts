import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { Roles, CurrentUser, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { TimeLoggingService } from './time-logging.service';
import {
  punchInSchema,
  punchOutSchema,
  locationUpdateSchema,
  pauseShiftSchema,
  resumeShiftSchema,
  timelineQuerySchema,
  historyQuerySchema,
  summaryQuerySchema,
  type PunchInDto,
  type PunchOutDto,
  type LocationUpdateDto,
  type PauseShiftDto,
  type ResumeShiftDto,
  type TimelineQueryDto,
  type HistoryQueryDto,
  type SummaryQueryDto,
} from './time-logging.dto';

@Controller('time-logging')
@Roles('BROKER_AGENT', 'BROKER_ADMIN', 'SUPER_ADMIN')
export class TimeLoggingController {
  constructor(private readonly service: TimeLoggingService) {}

  @Post('punch-in')
  async punchIn(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(punchInSchema)) body: PunchInDto,
  ) {
    return this.service.punchIn(user, body);
  }

  @Post('punch-out')
  async punchOut(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(punchOutSchema)) body: PunchOutDto,
  ) {
    return this.service.punchOut(user, body);
  }

  @Post('location')
  async recordLocation(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(locationUpdateSchema)) body: LocationUpdateDto,
  ) {
    return this.service.recordLocation(user, body);
  }

  @Post('pause')
  async pauseShift(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(pauseShiftSchema)) body: PauseShiftDto,
  ) {
    return this.service.pauseShift(user, body);
  }

  @Post('resume')
  async resumeShift(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(resumeShiftSchema)) body: ResumeShiftDto,
  ) {
    return this.service.resumeShift(user, body);
  }

  @Get('status')
  async getStatus(
    @CurrentUser() user: RequestUser,
    @Query('agentId') agentId?: string,
  ) {
    return this.service.getStatus(user, agentId);
  }

  @Get('timeline')
  async getTimeline(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(timelineQuerySchema)) query: TimelineQueryDto,
  ) {
    return this.service.getTimeline(user, query);
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(historyQuerySchema)) query: HistoryQueryDto,
  ) {
    return this.service.getHistory(user, query);
  }

  @Roles('BROKER_ADMIN', 'SUPER_ADMIN')
  @Get('summary')
  async getSummary(
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(summaryQuerySchema)) query: SummaryQueryDto,
  ) {
    return this.service.getSummary(user, query);
  }
}
