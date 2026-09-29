import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WaBotService } from './wabot.service';

@Module({ imports: [ListingsModule, WhatsAppModule], providers: [WaBotService], exports: [WaBotService] })
export class WaBotModule {}
