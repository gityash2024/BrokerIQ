import { Role, PlanTier, formatINR } from '@brokeriq/shared';

export const ADMIN_INFO = {
  name: 'BrokerIQ Super Admin Panel',
  version: '1.0.0',
  adminRole: Role.SUPER_ADMIN,
  highestTier: PlanTier.BUSINESS,
  sampleCurrency: formatINR(5999),
};
