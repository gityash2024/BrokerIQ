const web = (file: string, label: string) => ({
  src: `/product/web57-${file}.jpg`,
  label,
  caption: 'Web 2.3.16 · Isolated QA workspace',
});

const android = (file: string, label: string) => ({
  src: `/product/android57-${file}.png`,
  label,
  caption: 'Android Build 57 UI · Isolated QA emulator',
});

export const productGalleries = [
  { title: 'Customer portal', screenshots: [web('customer', 'Explore the property marketplace')] },
  {
    title: 'Broker workspace',
    screenshots: [
      web('broker-access', 'Today’s Focus dashboard'),
      web('broker-inventory', 'Inventory and filters'),
      web('broker-leads', 'Lead inbox and actions'),
      web('broker-inbox', 'Inbox channels'),
    ],
  },
  {
    title: 'Android app',
    mobile: true,
    screenshots: [
      android('login', 'Sign in and password visibility'),
      android('access', 'Today’s Focus'),
      android('inventory', 'Mobile inventory'),
      android('leads', 'Leads and compact header'),
      android('lead-detail', 'Lead contact actions'),
      android('inbox', 'Inbox channels'),
      android('notifications', 'Notification centre'),
    ],
  },
  {
    title: 'Super Admin',
    screenshots: [
      web('admin-access', 'Platform overview and sidebar'),
      web('admin-records', 'Business records by firm'),
      web('admin-policy', 'Modules and role permissions'),
      web('admin-operations', 'System workspace'),
    ],
  },
];
