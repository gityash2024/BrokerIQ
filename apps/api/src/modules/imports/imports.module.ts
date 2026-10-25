import { ImportUploadsService } from './import-uploads.service';
import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { OcrService } from './ocr.service';
@Module({ controllers: [ImportsController], providers: [ImportsService, OcrService, ImportUploadsService] })
export class ImportsModule {}
