import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { CONSENT_KINDS, consentSchema, contactsSyncSchema, locationPingSchema } from '@brokeriq/shared';
import { ClientIp, CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrivacyService } from './privacy.service';

/** The signed-in user's own consent, location pings and contact sync. */
@ApiTags('privacy')
@Controller('me')
export class MyPrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('privacy')
  status(@CurrentUser() user: RequestUser) {
    return this.privacy.status(user.id);
  }

  @Post('consent')
  consent(@CurrentUser() user: RequestUser, @Body(new ZodPipe(consentSchema)) body: z.infer<typeof consentSchema>, @ClientIp() ip?: string) {
    return this.privacy.setConsent(user, body.kind, body.granted, body.platform, ip);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('location')
  location(@CurrentUser() user: RequestUser, @Body(new ZodPipe(locationPingSchema)) body: z.infer<typeof locationPingSchema>) {
    return this.privacy.addLocation(user, body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('contacts/sync')
  sync(@CurrentUser() user: RequestUser, @Body(new ZodPipe(contactsSyncSchema)) body: z.infer<typeof contactsSyncSchema>) {
    return this.privacy.syncContacts(user, body.contacts);
  }

  @Delete('data/:kind')
  remove(@CurrentUser() user: RequestUser, @Param('kind', new ZodPipe(z.enum(CONSENT_KINDS))) kind: (typeof CONSENT_KINDS)[number], @ClientIp() ip?: string) {
    return this.privacy.setConsent(user, kind, false, undefined, ip);
  }
}

/** Super Admin only — no other role can reach consented location/contact data. */
@ApiTags('privacy')
@Roles('SUPER_ADMIN')
@Controller('admin/user-data')
export class AdminPrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  list(@Query() q: { q?: string; page?: number }) {
    return this.privacy.adminList(q);
  }

  @Get('map')
  map() {
    return this.privacy.adminMap();
  }

  @Get(':userId')
  detail(@CurrentUser() admin: RequestUser, @Param('userId') userId: string, @Query() q: { q?: string }, @ClientIp() ip?: string) {
    return this.privacy.adminDetail(admin, userId, q, ip);
  }

  @Get(':userId/contacts.csv')
  async csv(@CurrentUser() admin: RequestUser, @Param('userId') userId: string, @Res() res: Response, @ClientIp() ip?: string) {
    const csv = await this.privacy.adminCsv(admin, userId, ip);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="contacts-${userId}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(`﻿${csv}`);
  }
}
