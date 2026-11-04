const web = (file: string, label: string) => ({
  src: `/product/${file}.jpg`,
  label,
  caption: 'Web 2.3.14 · Isolated workspace capture',
});

const android = (file: string, label: string, build: number) => ({
  src: `/product/${file}.png`,
  label,
  caption: `Android · Captured in Build ${build}`,
});

export const productGalleries = [
  { title: 'Customer portal', screenshots: [web('web55-customer', 'Search the property marketplace')] },
  {
    title: 'Broker workspace',
    screenshots: [
      web('web55-broker-access', 'Today’s Focus dashboard'),
      web('web55-broker-inventory', 'Inventory and filters'),
      web('web55-broker-inbox', 'Lead conversations and channels'),
    ],
  },
  {
    title: 'Android app',
    mobile: true,
    screenshots: [
      android('android-workspace-build23-public', 'Broker workspace', 23),
      android('android-inventory-build24-public', 'Mobile inventory', 24),
      android('android-capture-build24', 'Capture and import', 24),
      android('android-directory-build23', 'Area Directory', 23),
    ],
  },
  {
    title: 'Super Admin',
    screenshots: [
      web('web55-admin-access', 'Platform overview and sidebar'),
      web('web55-admin-records', 'Business records by firm'),
      web('web55-admin-policy', 'Modules and role permissions'),
    ],
  },
];
