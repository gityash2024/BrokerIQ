import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.service';
import { CoreModule } from './core/core.module';
import { JwtAuthGuard, RolesGuard } from './common/guards/auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { MeModule } from './modules/me/me.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    CoreModule,
    AuthModule,
    MeModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
