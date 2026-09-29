import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CoBrokingService, type NetworkQuery } from './cobroking.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const requestSchema = z.object({ listingId: z.string().min(1), leadId: z.string().optional().nullable(), sharePct: z.number().min(0).max(100).optional().nullable(), message: z.string().max(500).optional().nullable() });

@ApiTags('cobroking')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller('cobroking')
export class CoBrokingController {
  constructor(private readonly svc: CoBrokingService) {}

  @Get('network')
  network(@CurrentUser() user: RequestUser, @Query() q: NetworkQuery) {
    return this.svc.network(user, q);
  }

  @Post('requests')
  request(@CurrentUser() user: RequestUser, @Body(new ZodPipe(requestSchema)) body: z.infer<typeof requestSchema>) {
    return this.svc.request(user, body);
  }

  @Get('requests')
  list(@CurrentUser() user: RequestUser, @Query('box') box?: string) {
    return this.svc.list(user, box === 'outgoing' ? 'outgoing' : 'incoming');
  }

  @Patch('requests/:id')
  respond(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ action: z.enum(['accept', 'reject', 'cancel', 'close']) }))) body: { action: 'accept' | 'reject' | 'cancel' | 'close' }) {
    return this.svc.respond(user, id, body.action);
  }
}
