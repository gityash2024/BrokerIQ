import { getConfig } from '@/lib/server';
import { BrokerIQLanding } from '@brokeriq/landing';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'BrokerIQ — Your broker workspace',
  description: 'Inventory, client requirements, WhatsApp capture and daily follow-ups for Gurgaon real estate brokers.',
};
export default async function Home() {
  const config = await getConfig();
  const releaseApkUrl =
    process.env.ANDROID_RELEASE_URL && !process.env.ANDROID_RELEASE_URL.includes('build26') && !process.env.ANDROID_RELEASE_URL.includes('build36')
      ? process.env.ANDROID_RELEASE_URL
      : '/downloads/BrokerIQ-v2.2.1-build37.apk';
  const releaseChecksum =
    process.env.ANDROID_RELEASE_SHA256 && !process.env.ANDROID_RELEASE_URL?.includes('build26') && !process.env.ANDROID_RELEASE_URL?.includes('build36')
      ? process.env.ANDROID_RELEASE_SHA256
      : 'b7ed739b8528e1e1e25b9f185a5169c439c4470074212d0f439e4d703b51d518';
  return (
    <BrokerIQLanding
      contact={{ email: config?.app.supportEmail, phone: config?.app.supportPhone, address: config?.app.officeAddress }}
      apkUrl={releaseApkUrl}
      checksum={releaseChecksum}
      releaseUpdates={{
        user: '2026-10-30T17:52:00Z',
        broker: '2026-10-30T17:52:00Z',
        android: '2026-10-30T17:52:00Z',
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
