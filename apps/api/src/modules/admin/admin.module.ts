import { Module } from '@nestjs/common';
import { AdminCoreController } from './admin-core.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminControlController } from './admin-control.controller';
import { AdminControlService } from './admin-control.service';
import { AuthModule } from '../auth/auth.module';
import { PublicModule } from '../public/public.module';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [AuthModule, PublicModule, ListingsModule],
  controllers: [AdminCoreController, AdminContentController, AdminControlController],
  providers: [AdminControlService],
})
export class AdminModule {}
