import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { LeadsModule } from '../leads/leads.module';
@Module({ imports: [LeadsModule], controllers: [ChatController] })
export class ChatModule {}
