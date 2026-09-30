import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { PhotoBrandingService } from './photo-branding.service';

@Module({ controllers: [MediaController], providers: [PhotoBrandingService], exports: [PhotoBrandingService] })
export class MediaModule {}
