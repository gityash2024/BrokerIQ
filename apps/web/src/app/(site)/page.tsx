import { getConfig } from '@/lib/server';
import { BrokerIQLanding } from '@brokeriq/landing';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'BrokerIQ — Your broker workspace',
  description: 'Inventory, client requirements, WhatsApp capture and daily follow-ups for Gurgaon real estate brokers.',
};
export default async function Home() {
  const config = await getConfig();
  return (
    <BrokerIQLanding
      contact={{ email: config?.app.supportEmail, phone: config?.app.supportPhone, address: config?.app.officeAddress }}
      apkUrl={process.env.ANDROID_RELEASE_URL}
      checksum={process.env.ANDROID_RELEASE_SHA256}
      screenshots={[
        { src: '/product/android-workspace-build23.png', label: 'Actual Android build 23 · Broker dashboard with real inventory totals and availability distribution.', caption: 'Broker workspace · Build 23' },
        {
          src: '/product/android-directory-build23.png',
          label: 'Actual Android build 23 · Gurugram Area Directory with clustered source locations. Colony points are approximate.',
          caption: 'Area Directory · Build 23',
        },
      ]}
    />
  );
}
