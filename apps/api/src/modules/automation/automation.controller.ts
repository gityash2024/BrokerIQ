import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { automationRuleSchema } from '@brokeriq/shared';
import { AutomationService } from './automation.service';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { requireOrg } from '../../common/utils';
import type { z } from 'zod';

@ApiTags('automations')
@Roles('BROKER_ADMIN')
@Controller('automations')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.automation.list(requireOrg(user));
  }

  @Get('presets')
  presets() {
    return this.automation.presets();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodPipe(automationRuleSchema)) body: z.infer<typeof automationRuleSchema>) {
    return this.automation.create(requireOrg(user), body);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(automationRuleSchema.partial())) body: any) {
    return this.automation.update(requireOrg(user), id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.automation.remove(requireOrg(user), id);
  }

  @Get(':id/runs')
  runs(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.automation.runs(requireOrg(user), id);
  }
}
