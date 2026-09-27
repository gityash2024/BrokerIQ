import { Role, LeadStage, formatINR } from '@brokeriq/shared';

export const API_INFO = {
  name: 'BrokerIQ API',
  version: '1.0.0',
  defaultRole: Role.BROKER_ADMIN,
  initialStage: LeadStage.NEW,
  sampleCurrency: formatINR(10000000),
};
