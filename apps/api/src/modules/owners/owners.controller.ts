import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { phoneSchema } from '@brokeriq/shared';
import { OwnersService } from './owners.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';

const ownerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});
const tenancySchema = z.object({
  listingId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  tenantName: z.string().trim().min(2).max(80),
  tenantPhone: phoneSchema.optional().nullable(),
  rent: z.number().min(0),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

@ApiTags('owners')
@Roles('BROKER_ADMIN', 'BROKER_AGENT')
@Controller('broker')
export class OwnersController {
  constructor(private readonly svc: OwnersService) {}

  @Get('owners')
  list(@CurrentUser() user: RequestUser, @Query('q') q?: string) {
    return this.svc.list(requireOrg(user), q);
  }

  @Get('owners/:id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.get(requireOrg(user), id);
  }

  @Post('owners')
  create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(ownerSchema)) body: any) {
    return this.svc.create(requireOrg(user), body);
  }

  @Patch('owners/:id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(ownerSchema.partial())) body: any) {
    return this.svc.update(requireOrg(user), id, body);
  }

  @Roles('BROKER_ADMIN')
  @Delete('owners/:id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.remove(requireOrg(user), id);
  }

  @Post('owners/:id/listings/:listingId')
  link(@CurrentUser() user: RequestUser, @Param('id') id: string, @Param('listingId') listingId: string) {
    return this.svc.linkListing(requireOrg(user), id, listingId);
  }

  @Get('tenancies')
  tenancies(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.svc.tenancies(requireOrg(user), status);
  }

  @Post('tenancies')
  createTenancy(@CurrentUser() user: RequestUser, @Body(new ZodPipe(tenancySchema)) body: any) {
    return this.svc.createTenancy(requireOrg(user), body);
  }

  @Patch('tenancies/:id')
  updateTenancy(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(
      new ZodPipe(
        tenancySchema.partial().extend({ status: z.enum(['ACTIVE', 'RENEWED', 'ENDED']).optional(), renewMonths: z.number().int().min(1).max(60).optional() }),
      ),
    )
    body: any,
  ) {
    return this.svc.updateTenancy(requireOrg(user), id, body);
  }
}
