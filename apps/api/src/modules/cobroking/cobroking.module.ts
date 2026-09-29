import { Module } from '@nestjs/common';
import { CoBrokingController } from './cobroking.controller';
import { CoBrokingService } from './cobroking.service';

@Module({ controllers: [CoBrokingController], providers: [CoBrokingService], exports: [CoBrokingService] })
export class CoBrokingModule {}
