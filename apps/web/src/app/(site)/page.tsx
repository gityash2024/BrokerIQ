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
      apkUrl={process.env.ANDROID_RELEASE_URL || '/downloads/BrokerIQ-v2.1.3-build27.apk'}
      checksum={process.env.ANDROID_RELEASE_SHA256 || 'bcedc7f3695e659e335d772942a96937840868ed796ea035ce5863a1842a9170'}
      releaseUpdates={{
        user: '2026-10-29T17:15:00Z',
        broker: '2026-10-29T17:15:00Z',
        android: '2026-10-29T17:15:00Z',
      }}
      screenshots={[
        {
          src: '/product/android-inventory-build26.png',
          label: 'Actual Android build 26 · Broker inventory with configuration, floor, pricing, availability and private source context.',
          caption: 'Inventory workspace · Build 26',
        },
        {
          src: '/product/android-capture-build26.png',
          label: 'Actual Android build 26 · Scanner and import workspace for camera, multi-page scans, images and WhatsApp TXT or ZIP exports into inventory or requirement review.',
          caption: 'Scanner & WhatsApp import · Build 26',
        },
      ]}
    />
  );
}
