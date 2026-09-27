import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { PlansModule } from './modules/plans/plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CustomersModule } from './modules/customers/customers.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { FollowUpsModule } from './modules/follow-ups/follow-ups.module';
import { SiteVisitsModule } from './modules/site-visits/site-visits.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AiModule } from './modules/ai/ai.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { HousingModule } from './modules/housing/housing.module';
import { AutomationModule } from './modules/automation/automation.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { AuditModule } from './modules/audit/audit.module';
import { AppGateway } from './gateways/app.gateway';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    PlansModule,
    SubscriptionsModule,
    CustomersModule,
    LeadsModule,
    PropertiesModule,
    FollowUpsModule,
    SiteVisitsModule,
    HealthModule,
    PaymentsModule,
    AiModule,
    WhatsappModule,
    HousingModule,
    AutomationModule,
    AnalyticsModule,
    NotificationsModule,
    StorageModule,
    SettingsModule,
    CredentialsModule,
    AuditModule
  ],
  controllers: [],
  providers: [
    AppGateway
  ],
})
export class AppModule {}
