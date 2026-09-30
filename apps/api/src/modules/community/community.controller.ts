import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { phoneSchema } from '@brokeriq/shared';
import { CommunityService } from './community.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser, Public, Roles, type RequestUser, Feature } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const flatmateSchema = z.object({
  lookingFor: z.enum(['FLATMATE', 'ROOM']),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  prefGender: z.enum(['MALE', 'FEMALE', 'ANY']).default('ANY'),
  age: z.number().int().min(16).max(90).optional().nullable(),
  budgetMin: z.number().min(0).optional().nullable(),
  budgetMax: z.number().min(0).optional().nullable(),
  localityIds: z.array(z.string()).max(10).default([]),
  officeHub: z.string().max(40).optional().nullable(),
  food: z.enum(['VEG', 'NONVEG', 'ANY']).default('ANY'),
  smoking: z.boolean().default(false),
  drinking: z.boolean().default(false),
  pets: z.boolean().default(false),
  moveInBy: z.coerce.date().optional().nullable(),
  occupation: z.string().max(60).optional().nullable(),
  about: z.string().max(600).optional().nullable(),
  isActive: z.boolean().default(true),
});

const agreementSchema = z.object({
  listingId: z.string().optional().nullable(),
  landlordName: z.string().trim().min(2).max(100),
  landlordAddress: z.string().max(300).optional().nullable(),
  landlordPhone: z.string().max(20).optional().nullable(),
  tenantName: z.string().trim().min(2).max(100),
  tenantAddress: z.string().max(300).optional().nullable(),
  tenantPhone: z.string().max(20).optional().nullable(),
  propertyAddress: z.string().trim().min(5).max(300),
  rent: z.number().min(0),
  deposit: z.number().min(0),
  maintenance: z.number().min(0).optional().nullable(),
  startDate: z.coerce.date(),
  months: z.number().int().min(1).max(11).default(11),
  lockInMonths: z.number().int().min(0).max(11).default(0),
  noticeMonths: z.number().int().min(0).max(6).default(1),
  escalationPct: z.number().min(0).max(20).default(0),
  furnishing: z.string().max(30).optional().nullable(),
  extraClauses: z.array(z.string().max(500)).max(10).default([]),
});

const partnerSchema = z.object({
  category: z.enum(['PACKERS', 'FURNITURE', 'BROADBAND', 'CLEANING', 'PAINTING', 'OTHER']),
  name: z.string().trim().min(2).max(80),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  description: z.string().max(400).optional().nullable(),
  offer: z.string().max(120).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  website: z.string().url().optional().nullable().or(z.literal('')),
  localityIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

@ApiTags('community')
@Controller()
export class CommunityController {
  constructor(
    private readonly svc: CommunityService,
    private readonly prisma: PrismaService,
  ) {}

  // ------------------------------------------------------------------ flatmates
  @Feature('flatmates')
  @Get('flatmates/me')
  me(@CurrentUser() user: RequestUser) {
    return this.svc.myProfile(user.id);
  }

  @Feature('flatmates')
  @Post('flatmates/me')
  upsert(@CurrentUser() user: RequestUser, @Body(new ZodPipe(flatmateSchema)) body: any) {
    return this.svc.upsertProfile(user.id, body);
  }

  @Feature('flatmates')
  @Get('flatmates/matches')
  matches(@CurrentUser() user: RequestUser) {
    return this.svc.matches(user.id);
  }

  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Feature('flatmates')
  @Post('flatmates/connect/:userId')
  connect(@CurrentUser() user: RequestUser, @Param('userId') toUserId: string, @Body(new ZodPipe(z.object({ message: z.string().max(300).optional().nullable() }))) body: any) {
    return this.svc.connect(user.id, toUserId, body.message);
  }

  @Feature('flatmates')
  @Patch('flatmates/connections/:id')
  respond(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ status: z.enum(['ACCEPTED', 'DECLINED']) }))) body: any) {
    return this.svc.respond(user.id, id, body.status);
  }

  @Feature('flatmates')
  @Get('flatmates/connections')
  connections(@CurrentUser() user: RequestUser) {
    return this.svc.connections(user.id);
  }

  // ------------------------------------------------------------------ rent agreement
  @Feature('rent_agreement')
  @Get('agreements')
  agreements(@CurrentUser() user: RequestUser) {
    return this.svc.listAgreements(user.id);
  }

  @Feature('rent_agreement')
  @Post('agreements')
  createAgreement(@CurrentUser() user: RequestUser, @Body(new ZodPipe(agreementSchema)) body: any) {
    return this.svc.createAgreement(user, body);
  }

  @Feature('rent_agreement')
  @Get('agreements/:id/pdf')
  async agreementPdf(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rent-agreement.pdf"');
    res.send(await this.svc.agreementPdf(user.id, id));
  }

  /** Short-lived signed link so the PDF opens in any browser / the app without an auth header. */
  @Feature('rent_agreement')
  @Post('agreements/:id/link')
  async agreementLink(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.svc.agreementPdf(user.id, id);
    const e = Math.floor(Date.now() / 1000) + 600;
    return { url: `${env().PUBLIC_API_URL.replace(/\/$/, '')}/api/public/agreements/${id}/pdf?e=${e}&s=${this.sign(id, e)}` };
  }

  @Public()
  @Feature('rent_agreement')
  @Get('public/agreements/:id/pdf')
  async signedPdf(@Param('id') id: string, @Query('e') e: string, @Query('s') s: string, @Res() res: Response) {
    const exp = Number(e);
    const expected = this.sign(id, exp);
    if (!exp || exp < Date.now() / 1000 || !s || s.length !== expected.length || !timingSafeEqual(Buffer.from(s), Buffer.from(expected))) throw new ForbiddenException('Link expire हो गया');
    const a = await this.prisma.rentAgreement.findUniqueOrThrow({ where: { id } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rent-agreement.pdf"');
    res.send(await this.svc.renderAgreement(a));
  }

  private sign(id: string, exp: number) {
    return createHmac('sha256', env().ENCRYPTION_MASTER_KEY).update(`agreement:${id}:${exp}`).digest('hex').slice(0, 32);
  }

  // ------------------------------------------------------------------ move-in services
  @Public()
  @Feature('move_in_services')
  @Get('public/services')
  partners(@Query('category') category?: string, @Query('localityId') localityId?: string) {
    return this.svc.partners(category, localityId);
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Feature('move_in_services')
  @Post('services/requests')
  request(@CurrentUser() user: RequestUser, @Body(new ZodPipe(z.object({ partnerId: z.string(), listingId: z.string().optional().nullable(), name: z.string().trim().min(2).max(80), phone: phoneSchema, preferredDate: z.coerce.date().optional().nullable(), notes: z.string().max(400).optional().nullable() }))) body: any) {
    return this.svc.requestService(user, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('admin/services')
  adminPartners() {
    return this.prisma.servicePartner.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }], include: { _count: { select: { requests: true } } } });
  }

  @Roles('SUPER_ADMIN')
  @Post('admin/services')
  createPartner(@Body(new ZodPipe(partnerSchema)) body: any) {
    return this.prisma.servicePartner.create({ data: { ...body, logoUrl: body.logoUrl || null, email: body.email || null, website: body.website || null } });
  }

  @Roles('SUPER_ADMIN')
  @Patch('admin/services/:id')
  updatePartner(@Param('id') id: string, @Body(new ZodPipe(partnerSchema.partial())) body: any) {
    return this.prisma.servicePartner.update({ where: { id }, data: { ...body, ...(body.logoUrl === '' ? { logoUrl: null } : {}), ...(body.email === '' ? { email: null } : {}), ...(body.website === '' ? { website: null } : {}) } });
  }

  @Roles('SUPER_ADMIN')
  @Delete('admin/services/:id')
  deletePartner(@Param('id') id: string) {
    return this.prisma.servicePartner.update({ where: { id }, data: { isActive: false } });
  }

  @Roles('SUPER_ADMIN')
  @Get('admin/service-requests')
  serviceRequests() {
    return this.prisma.serviceRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { partner: { select: { name: true, category: true } } } });
  }
}
