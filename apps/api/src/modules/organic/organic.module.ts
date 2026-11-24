import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { organicDeliveryInput, organicKind, organicQuery, organicSourceInput, organicStatus, organicTarget,
  type OrganicDeliveryInput, type OrganicQuery, type OrganicSourceInput } from '@brokeriq/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { OrganicDeliveryService } from './organic-delivery.service';
import { OrganicService } from './organic.service';

const transferInput = z.object({
  ids: z.array(z.string().min(1).max(80)).min(1).max(1000).optional(),
  query: organicQuery.optional(),
  targets: z.array(organicTarget).min(1).max(10),
}).refine((input) => Boolean(input.ids) !== Boolean(input.query), 'Choose either records or filtered selection');
const time = organicDeliveryInput.shape.time;
const schedule = z.object({ enabled: z.boolean(), time, notifyTime: time });

@Roles('SUPER_ADMIN')
@Controller('admin/organic')
class OrganicController {
  constructor(private readonly records: OrganicService, private readonly delivery: OrganicDeliveryService) {}

  @Get('records')
  list(@Query(new ZodPipe(organicQuery)) query: OrganicQuery) { return this.records.list(query); }

  @Get('records/:id')
  detail(@Param('id') id: string) { return this.records.detail(id); }

  @Patch('records/:id')
  review(@CurrentUser() user: RequestUser, @Param('id') id: string,
    @Body(new ZodPipe(z.object({ status: organicStatus }))) input: { status: string }) {
    return this.records.review(id, input.status, user.id);
  }

  @Get('sources')
  sources() { return this.records.sources(); }

  @Post('sources')
  createSource(@CurrentUser() user: RequestUser, @Body(new ZodPipe(organicSourceInput)) input: OrganicSourceInput) {
    return this.records.saveSource(input, user.id);
  }

  @Patch('sources/:id')
  updateSource(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(organicSourceInput)) input: OrganicSourceInput) {
    return this.records.saveSource(input, user.id, id);
  }

  @Post('discover')
  discover(@Body(new ZodPipe(z.object({ kind: organicKind, sourceId: z.string().max(80).optional() }))) input: { kind: 'SUPPLY' | 'DEMAND'; sourceId?: string }) {
    return this.records.runNow(input.kind, input.sourceId);
  }

  @Patch('discovery/:kind')
  discovery(@CurrentUser() user: RequestUser, @Param('kind', new ZodPipe(organicKind)) kind: 'SUPPLY' | 'DEMAND',
    @Body(new ZodPipe(schedule)) input: z.infer<typeof schedule>) {
    return this.records.updateSettings(kind, input, user.id);
  }

  @Get('targets')
  targets() { return this.delivery.targets(); }

  @Post('transfer/preview')
  async preview(@Body(new ZodPipe(transferInput)) input: z.infer<typeof transferInput>) {
    const ids = await this.records.selectedIds(input.ids, input.query);
    return { ids, firms: await this.delivery.previewTransfer(ids, input.targets) };
  }

  @Post('transfer')
  async transfer(@CurrentUser() user: RequestUser, @Body(new ZodPipe(transferInput)) input: z.infer<typeof transferInput>) {
    return this.delivery.queueTransfer(await this.records.selectedIds(input.ids, input.query), input.targets, user.id);
  }

  @Get('delivery')
  rules() { return this.delivery.schedules(); }

  @Post('delivery/preview')
  deliveryPreview(@Body(new ZodPipe(organicDeliveryInput)) input: OrganicDeliveryInput) {
    return this.delivery.preview(input);
  }

  @Post('delivery')
  deliverySave(@CurrentUser() user: RequestUser, @Body(new ZodPipe(organicDeliveryInput)) input: OrganicDeliveryInput) {
    return this.delivery.save(input, user.id);
  }

  @Post('delivery/runs/:id/retry')
  deliveryRetry(@Param('id') id: string) { return this.delivery.retry(id); }
}

@Module({ controllers: [OrganicController], providers: [OrganicService, OrganicDeliveryService] })
export class OrganicModule {}
