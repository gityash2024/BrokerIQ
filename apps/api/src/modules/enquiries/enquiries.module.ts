import { Module } from '@nestjs/common';
import { EnquiriesController } from './enquiries.controller';
import { EnquiriesService } from './enquiries.service';
import { LeadsModule } from '../leads/leads.module';

@Module({ imports: [LeadsModule], controllers: [EnquiriesController], providers: [EnquiriesService], exports: [EnquiriesService] })
export class EnquiriesModule {}
