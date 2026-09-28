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
import { ListingsModule } from './modules/listings/listings.module';
import { LeadsModule } from './modules/leads/leads.module';
import { EnquiriesModule } from './modules/enquiries/enquiries.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PublicModule } from './modules/public/public.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AdminModule } from './modules/admin/admin.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { AutomationModule } from './modules/automation/automation.module';
import { BillingModule } from './modules/billing/billing.module';
import { InsightsModule } from './modules/insights/insights.module';
import { AiModule } from './modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.service';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { MediaModule } from './modules/media/media.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    PrismaModule,
    CoreModule,
    AuthModule,
    MeModule,
    HealthModule,
    ListingsModule,
    LeadsModule,
    EnquiriesModule,
    OrganizationsModule,
    PublicModule,
    IntegrationsModule,
    AdminModule,
    WhatsAppModule,
    ConnectorsModule,
    AutomationModule,
    BillingModule,
    InsightsModule,
    AiModule,
    ChatModule,
    MaintenanceModule,
    FeedbackModule,
    MediaModule,
    PrivacyModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
