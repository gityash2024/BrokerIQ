export const mocks = {
  organizations: [
    { id: 'org_1', name: 'Acme Realty', businessName: 'Acme Properties Pvt Ltd', status: 'ACTIVE', plan: 'PRO', createdAt: '2023-10-01' },
    { id: 'org_2', name: 'Apex Brokers', businessName: 'Apex Real Estate', status: 'SUSPENDED', plan: 'STARTER', createdAt: '2023-11-15' },
    { id: 'org_3', name: 'Prime Estates', businessName: 'Prime Housing LLC', status: 'ACTIVE', plan: 'BUSINESS', createdAt: '2024-01-20' },
    { id: 'org_4', name: 'Metro Homes', businessName: 'Metro Realtors', status: 'TRIAL', plan: 'PRO', createdAt: '2024-03-05' },
  ],
  plans: [
    { name: 'Starter', code: 'STARTER', monthlyPrice: 2999, yearlyPrice: 29990, trialDays: 14, status: 'ACTIVE' },
    { name: 'Pro', code: 'PRO', monthlyPrice: 5999, yearlyPrice: 59990, trialDays: 14, status: 'ACTIVE' },
    { name: 'Business', code: 'BUSINESS', monthlyPrice: 12999, yearlyPrice: 129990, trialDays: 14, status: 'ACTIVE' },
  ],
  subscriptions: [
    { organization: 'Acme Realty', plan: 'PRO', status: 'ACTIVE', periodStart: '2024-03-01', periodEnd: '2024-04-01', provider: 'RAZORPAY' },
    { organization: 'Apex Brokers', plan: 'STARTER', status: 'PAST_DUE', periodStart: '2024-02-15', periodEnd: '2024-03-15', provider: 'STRIPE' },
  ],
  auditLogs: [
    { timestamp: '2024-03-15 10:23:45', user: 'admin@brokeriq.com', action: 'LOGIN', resource: 'System', details: 'Successful login from IP' },
    { timestamp: '2024-03-15 11:05:12', user: 'admin@brokeriq.com', action: 'PLAN_CHANGE', resource: 'org_1', details: 'Upgraded to PRO plan' },
    { timestamp: '2024-03-15 14:30:00', user: 'system', action: 'SUBSCRIPTION_EVENT', resource: 'org_2', details: 'Payment failed, marked past_due' },
  ]
};
