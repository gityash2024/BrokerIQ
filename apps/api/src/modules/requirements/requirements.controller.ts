import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { tenantRequirementSchema, type TenantRequirementInput } from '@brokeriq/shared';
import { RequirementsService } from './requirements.service';
import { CurrentUser, type RequestUser, Feature } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const updateSchema = tenantRequirementSchema.partial().extend({ status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).optional() });

/** "अपनी ज़रूरत बताएँ" — any logged-in user can post a requirement and get matches + alerts. */
@ApiTags('requirements')
@Feature('tenant_requirements')
@Controller('requirements')
export class RequirementsController {
  constructor(private readonly svc: RequirementsService) {}

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(tenantRequirementSchema)) body: TenantRequirementInput) {
    return this.svc.create(user, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: RequestUser) {
    return this.svc.mine(user.id);
  }

  @Get(':id/matches')
  matches(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.matches(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(updateSchema)) body: any) {
    return this.svc.update(user.id, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.remove(user.id, id);
  }
}
