import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BrokerInvitesController } from './broker-invites.controller';
import { BrokerInvitesService } from './broker-invites.service';

@Module({
  controllers: [AuthController, BrokerInvitesController],
  providers: [AuthService, BrokerInvitesService],
  exports: [AuthService, BrokerInvitesService],
})
export class AuthModule {}
