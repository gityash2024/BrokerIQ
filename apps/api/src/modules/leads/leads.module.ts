import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { TasksController } from './tasks.controller';
import { LeadsService } from './leads.service';

@Module({ controllers: [LeadsController, TasksController], providers: [LeadsService], exports: [LeadsService] })
export class LeadsModule {}
