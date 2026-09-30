import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { Response } from 'express';
import { parse } from 'csv-parse/sync';
import { activityInputSchema, leadInputSchema, leadStageSchema, leadUpdateSchema } from '@brokeriq/shared';
import { LeadsService } from './leads.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AccessService } from '../../core/access/access.service';

const bulkSchema = z.object({ ids: z.array(z.string()).min(1).max(500), action: z.enum(['assign', 'stage', 'tag', 'delete']), value: z.string().nullable().optional() });
const assignSchema = z.object({ assignedToId: z.string().nullable() });
const importSchema = z.object({ csv: z.string().min(5).max(5_000_000) });

@ApiTags('leads')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly access: AccessService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() q: any) {
    return this.leads.list(user, q);
  }

  @Get('kanban')
  kanban(@CurrentUser() user: RequestUser, @Query() q: any) {
    return this.leads.kanban(user, q);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@CurrentUser() user: RequestUser, @Query() q: any, @Res() res: Response) {
    const csv = await this.leads.exportCsv(user, q);
    res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + csv);
  }

  @Post('import')
  async import(@CurrentUser() user: RequestUser, @Body(new ZodPipe(importSchema)) body: { csv: string }) {
    const rows = parse(body.csv, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }) as Record<string, string>[];
    return this.leads.importRows(user, rows);
  }

  @Post('bulk')
  bulk(@CurrentUser() user: RequestUser, @Body(new ZodPipe(bulkSchema)) body: any) {
    return this.leads.bulk(user, body);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(leadInputSchema)) body: any) {
    return this.leads.create(body, user);
  }

  @Get(':id')
  detail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.leads.detail(id, user);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(leadUpdateSchema)) body: any) {
    return this.leads.update(id, body, user);
  }

  @Patch(':id/stage')
  stage(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(leadStageSchema)) body: any) {
    return this.leads.changeStage(id, body.stage, user, body.lostReason);
  }

  @Patch(':id/assign')
  assign(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(assignSchema)) body: any) {
    return this.leads.assign(id, body.assignedToId, user);
  }

  @Post(':id/activities')
  activity(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(activityInputSchema)) body: any) {
    return this.leads.addActivity(id, body, user);
  }

  @Get(':id/matches')
  matches(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query('scope') scope?: 'org' | 'all') {
    return this.leads.matches(id, user, scope === 'all' ? 'all' : 'org');
  }

  @Post(':id/share')
  share(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: { listingId: string }) {
    return this.leads.shareListing(id, body.listingId, user);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/ai')
  async ai(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.access.assertAllowed(user, 'ai');
    return this.leads.aiInsights(id, user);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.leads.remove(id, user);
  }
}
