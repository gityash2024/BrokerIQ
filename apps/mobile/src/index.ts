import { Role, LeadStage, formatINR } from '@brokeriq/shared';

export const MOBILE_INFO = {
  name: 'BrokerIQ Mobile App',
  version: '1.0.0',
  brokerRole: Role.BROKER_STAFF,
  defaultStage: LeadStage.NEW,
  sampleCurrency: formatINR(25000),
};
