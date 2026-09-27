import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import {
  changePasswordSchema,
  googleLoginSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@brokeriq/shared';
import { AuthService } from './auth.service';
import { CurrentUser, Public, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const meta = (req: any) => ({ ip: (req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip)?.trim(), userAgent: req.headers['user-agent'] });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) body: any, @Req() req: any) {
    return this.auth.register(body, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body(new ZodPipe(loginSchema)) body: any, @Req() req: any) {
    return this.auth.login(body.email, body.password, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/request')
  requestOtp(@Body(new ZodPipe(otpRequestSchema)) body: any) {
    return this.auth.requestOtp(body.email, body.purpose);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('otp/verify')
  verifyOtp(@Body(new ZodPipe(otpVerifySchema)) body: any, @Req() req: any) {
    return this.auth.verifyOtp(body, meta(req));
  }

  @Public()
  @HttpCode(200)
  @Post('google')
  google(@Body(new ZodPipe(googleLoginSchema)) body: any, @Req() req: any) {
    return this.auth.google(body.idToken, body.accountType, meta(req));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body(new ZodPipe(refreshSchema)) body: any, @Req() req: any) {
    return this.auth.refresh(body.refreshToken, meta(req));
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  logout(@Body() body: { refreshToken?: string }) {
    return this.auth.logout(body?.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('password/reset')
  reset(@Body(new ZodPipe(resetPasswordSchema)) body: any) {
    return this.auth.resetPassword(body.email, body.code, body.password);
  }

  @HttpCode(200)
  @Post('password/change')
  change(@CurrentUser() user: RequestUser, @Body(new ZodPipe(changePasswordSchema)) body: any) {
    return this.auth.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }
}
