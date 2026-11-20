import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ownerCreatePropertySchema,
  ownerEditPropertySchema,
  ownerReportInputSchema,
  type OwnerCreatePropertyInput,
  type OwnerEditPropertyInput,
  type OwnerReportInput,
} from '@brokeriq/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { InventoryOwnerService } from './inventory-owner.service';

@Controller('owner/properties')
@Roles('PROPERTY_OWNER')
export class OwnerPropertiesController {
  constructor(private readonly owners: InventoryOwnerService) {}

  @Get()
  list(@Query(new ZodPipe(z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) }))) query: { page: number }, @CurrentUser() user: RequestUser) {
    return this.owners.myProperties(user, query.page);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.owners.myProperty(id, user);
  }

  @Post()
  create(@Body(new ZodPipe(ownerCreatePropertySchema)) body: OwnerCreatePropertyInput, @CurrentUser() user: RequestUser) {
    return this.owners.create(body, user);
  }

  @Patch(':id')
  edit(@Param('id') id: string, @Body(new ZodPipe(ownerEditPropertySchema)) body: OwnerEditPropertyInput, @CurrentUser() user: RequestUser) {
    return this.owners.edit(id, body, user);
  }

  @Post(':id/update')
  report(@Param('id') id: string, @Body(new ZodPipe(ownerReportInputSchema)) body: OwnerReportInput, @CurrentUser() user: RequestUser) {
    return this.owners.report(id, body, user);
  }
}

const ownerReview = z.strictObject({ proposalId: z.string().min(1).max(100), expectedRevision: z.number().int().positive(), accept: z.boolean() });
const ownerAccept = z.strictObject({ expectedRevision: z.number().int().positive() });
const ownerLink = z.strictObject({ ownerUserId: z.string().min(1).max(100).nullable(), expectedRevision: z.number().int().positive() });

@Controller('inventory')
export class InventoryOwnerController {
  constructor(private readonly owners: InventoryOwnerService) {}

  @Roles('BROKER_ADMIN')
  @Get('owner-submissions')
  submissions(
    @Query(new ZodPipe(z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) }))) query: { page: number },
    @CurrentUser() user: RequestUser,
  ) {
    return this.owners.submissions(user, query.page);
  }

  @Roles('BROKER_ADMIN')
  @Post(':id/owner/accept')
  accept(@Param('id') id: string, @Body(new ZodPipe(ownerAccept)) body: z.infer<typeof ownerAccept>, @CurrentUser() user: RequestUser) {
    return this.owners.acceptSubmission(id, body.expectedRevision, user);
  }

  @Roles('BROKER_ADMIN')
  @Get('owners')
  list(@Query(new ZodPipe(z.object({ search: z.string().trim().max(160).optional() }))) query: { search?: string }, @CurrentUser() user: RequestUser) {
    return this.owners.owners(user, query.search);
  }

  @Roles('BROKER_ADMIN', 'BROKER_AGENT')
  @Get(':id/owner')
  info(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.owners.info(id, user);
  }

  @Roles('BROKER_ADMIN')
  @Post(':id/owner/review')
  review(@Param('id') id: string, @Body(new ZodPipe(ownerReview)) body: z.infer<typeof ownerReview>, @CurrentUser() user: RequestUser) {
    return this.owners.review(id, body.proposalId, body.expectedRevision, body.accept, user);
  }

  @Roles('BROKER_ADMIN')
  @Patch(':id/owner')
  link(@Param('id') id: string, @Body(new ZodPipe(ownerLink)) body: z.infer<typeof ownerLink>, @CurrentUser() user: RequestUser) {
    return this.owners.link(id, body.ownerUserId, body.expectedRevision, user);
  }
}
