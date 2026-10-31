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
    process.env.ANDROID_RELEASE_URL && !process.env.ANDROID_RELEASE_URL.includes('build26') && !process.env.ANDROID_RELEASE_URL.includes('build36') && !process.env.ANDROID_RELEASE_URL.includes('build37') && !process.env.ANDROID_RELEASE_URL.includes('build38') && !process.env.ANDROID_RELEASE_URL.includes('build39')
      ? process.env.ANDROID_RELEASE_URL
      : '/downloads/BrokerIQ-v2.2.4-build40.apk';
  const releaseChecksum =
    process.env.ANDROID_RELEASE_SHA256 && !process.env.ANDROID_RELEASE_URL?.includes('build26') && !process.env.ANDROID_RELEASE_URL?.includes('build36') && !process.env.ANDROID_RELEASE_URL?.includes('build37') && !process.env.ANDROID_RELEASE_URL?.includes('build38') && !process.env.ANDROID_RELEASE_URL?.includes('build39')
      ? process.env.ANDROID_RELEASE_SHA256
      : 'db10b604fc12406b9b94e341e2a2732e9ef5b5bab09ccf5e4be0040dba3bde30';
  return (
    <BrokerIQLanding
      contact={{ email: config?.app.supportEmail, phone: config?.app.supportPhone, address: config?.app.officeAddress }}
      apkUrl={releaseApkUrl}
      checksum={releaseChecksum}
      releaseUpdates={{
        user: process.env.RELEASE_UPDATED_AT || '2026-10-31T04:35:00Z',
        broker: process.env.RELEASE_UPDATED_AT || '2026-10-31T04:35:00Z',
        android: process.env.RELEASE_UPDATED_AT || '2026-10-31T04:35:00Z',
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
