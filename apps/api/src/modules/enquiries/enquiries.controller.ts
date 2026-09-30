import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { enquirySchema } from '@brokeriq/shared';
import { EnquiriesService } from './enquiries.service';
import { CurrentUser, Public, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@ApiTags('enquiries')
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post()
  create(@Body(new ZodPipe(enquirySchema)) body: any, @CurrentUser() user?: RequestUser) {
    return this.enquiries.create(body, user);
  }

  @Get('sent')
  sent(@CurrentUser() user: RequestUser) {
    return this.enquiries.sent(user.id);
  }

  @Get('received')
  received(@CurrentUser() user: RequestUser) {
    return this.enquiries.received(user.id);
  }

  @Patch(':id')
  status(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ status: z.enum(['NEW', 'RESPONDED', 'CLOSED']) }))) body: any,
  ) {
    return this.enquiries.setStatus(id, body.status, user);
  }

  @Roles('SUPER_ADMIN')
  @Get('admin/all')
  admin(@Query() q: any) {
    return this.enquiries.adminList(q);
  }
}
