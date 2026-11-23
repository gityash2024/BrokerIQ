import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { PhotoBrandingService } from './photo-branding.service';

import { PropertyVideoController } from './property-video.controller';
import { PropertyVideoService } from './property-video.service';

@Module({ controllers: [MediaController, PropertyVideoController], providers: [PhotoBrandingService, PropertyVideoService], exports: [PhotoBrandingService] })
export class MediaModule {}
