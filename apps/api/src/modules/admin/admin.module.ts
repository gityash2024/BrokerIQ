import { Module } from '@nestjs/common';
import { AdminCoreController } from './admin-core.controller';
import { AdminContentController } from './admin-content.controller';
import { AuthModule } from '../auth/auth.module';
import { PublicModule } from '../public/public.module';

@Module({ imports: [AuthModule, PublicModule], controllers: [AdminCoreController, AdminContentController] })
export class AdminModule {}
