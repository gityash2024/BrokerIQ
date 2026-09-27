import { Global, Module } from '@nestjs/common';
import { IntegrationTesterService } from './integration-tester.service';

@Global()
@Module({ providers: [IntegrationTesterService], exports: [IntegrationTesterService] })
export class IntegrationsModule {}
