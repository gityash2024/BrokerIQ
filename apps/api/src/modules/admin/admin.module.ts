import { AdminBusinessService } from './admin-business.service';
import { AdminBusinessController } from './admin-business.controller';
import { Module } from '@nestjs/common';
import { AdminCoreController } from './admin-core.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminListingsController } from './admin-listings.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminControlController } from './admin-control.controller';
import { AdminControlService } from './admin-control.service';
import { AdminModerationController } from './admin-moderation.controller';
import { AuthModule } from '../auth/auth.module';
import { PublicModule } from '../public/public.module';
import { ListingsModule } from '../listings/listings.module';

@Module({
  imports: [AuthModule, PublicModule, ListingsModule],
  controllers: [
    AdminBusinessController,
    AdminCoreController,
    AdminUsersController,
    AdminListingsController,
    AdminContentController,
    AdminControlController,
    AdminModerationController,
  ],
  providers: [AdminBusinessService, AdminControlService],
})
export class AdminModule {}
