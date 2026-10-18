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
      releaseUpdates={{
        user: '2026-10-18T06:15:40Z',
        broker: '2026-10-18T06:15:40Z',
        android: '2026-10-18T06:11:44Z',
      }}
      screenshots={[
        {
          src: '/product/android-inventory-build24.png',
          label: 'Actual Android build 24 · Broker inventory with configuration, floor, pricing, availability and private source context.',
          caption: 'Inventory workspace · Build 24',
        },
        {
          src: '/product/android-capture-build24.png',
          label: 'Actual Android build 24 · Scanner and import workspace for camera, multi-page scans, images and WhatsApp TXT or ZIP exports into inventory or requirement review.',
          caption: 'Scanner & WhatsApp import · Build 24',
        },
      ]}
    />
  );
}
