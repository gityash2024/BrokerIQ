import { Module } from '@nestjs/common';
import { AdminPrivacyController, MyPrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({ controllers: [MyPrivacyController, AdminPrivacyController], providers: [PrivacyService] })
export class PrivacyModule {}
