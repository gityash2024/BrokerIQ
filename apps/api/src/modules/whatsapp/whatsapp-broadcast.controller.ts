import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { broadcastContactInput, broadcastDraftInput, broadcastGroupInput, type BroadcastDraftInput } from '@brokeriq/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { WhatsAppBroadcastService } from './whatsapp-broadcast.service';

const contactImport = z.object({ contacts: z.array(broadcastContactInput).min(1).max(500) });
const listQuery = z.object({ search: z.string().max(140).optional(), after: z.string().max(80).optional() });

@Roles('BROKER_ADMIN')
@Controller('whatsapp/broadcast')
export class WhatsAppBroadcastController {
  constructor(private readonly broadcasts: WhatsAppBroadcastService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  workspace(@CurrentUser() user: RequestUser, @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    return this.broadcasts.workspace(user, query.search, query.after);
  }

  @Post('contacts')
  importContacts(@CurrentUser() user: RequestUser, @Body(new ZodPipe(contactImport)) input: z.infer<typeof contactImport>) {
    return this.broadcasts.importContacts(user, input.contacts);
  }

  @Delete('contacts/:id')
  archiveContact(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.broadcasts.archiveContact(user, id);
  }

  @Post('groups')
  createGroup(@CurrentUser() user: RequestUser, @Body(new ZodPipe(broadcastGroupInput)) input: z.infer<typeof broadcastGroupInput>) {
    return this.broadcasts.group(user, input);
  }

  @Patch('groups/:id')
  updateGroup(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body(new ZodPipe(broadcastGroupInput)) input: z.infer<typeof broadcastGroupInput>) {
    return this.broadcasts.group(user, input, id);
  }

  @Delete('groups/:id')
  deleteGroup(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.broadcasts.deleteGroup(user, id);
  }

  @Post('preview')
  preview(@CurrentUser() user: RequestUser, @Body(new ZodPipe(broadcastDraftInput)) input: BroadcastDraftInput) {
    return this.broadcasts.preview(user, input);
  }

  @Post(':id/retry-billing')
  retryBilling(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.broadcasts.retryBilling(user, id);
  }

  @Post(':id/queue')
  send(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.broadcasts.enqueue(user, id);
  }
}
