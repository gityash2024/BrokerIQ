import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { TasksController } from './tasks.controller';
import { LeadsService } from './leads.service';
import { LeadScoringService } from './lead-scoring.service';

@Module({ controllers: [LeadsController, TasksController], providers: [LeadsService, LeadScoringService], exports: [LeadsService, LeadScoringService] })
export class LeadsModule {}
