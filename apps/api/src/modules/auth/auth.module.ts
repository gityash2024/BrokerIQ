import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BrokerInvitesController } from './broker-invites.controller';
import { BrokerInvitesService } from './broker-invites.service';
import { LoginVerificationService } from './login-verification.service';

@Module({
  controllers: [AuthController, BrokerInvitesController],
  providers: [AuthService, BrokerInvitesService, LoginVerificationService],
  exports: [AuthService, BrokerInvitesService],
})
export class AuthModule {}
