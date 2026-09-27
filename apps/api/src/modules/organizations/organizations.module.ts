import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [OrganizationsController] })
export class OrganizationsModule {}
