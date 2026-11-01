import { getConfig } from '@/lib/server';
import { BrokerIQLanding } from '@brokeriq/landing';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const envDate = process.env.RELEASE_UPDATED_AT;
  const releaseDate = envDate && !envDate.startsWith('2026-10-30') ? envDate : '2026-11-01T04:45:00Z';

  return (
    <BrokerIQLanding
      contact={{ email: config?.app.supportEmail, phone: config?.app.supportPhone, address: config?.app.officeAddress }}
      apkUrl={releaseApkUrl}
      checksum={releaseChecksum}
      builds={{
        user: 'Build v2.2.4',
        broker: 'Build v2.2.4',
        android: 'Build 40 (v2.2.4)',
      }}
      releaseUpdates={{
        user: releaseDate,
        broker: releaseDate,
        android: releaseDate,
      }}
      screenshots={[
        {
          src: '/product/android-inventory-build26.png',
          label: 'Actual Android build 40 · Broker inventory with configuration, floor, pricing, availability and private source context.',
          caption: 'Inventory workspace · Build 40',
        },
        {
          src: '/product/android-capture-build26.png',
          label: 'Actual Android build 40 · Scanner and import workspace for camera, multi-page scans, images and WhatsApp TXT or ZIP exports into inventory or requirement review.',
          caption: 'Scanner & WhatsApp import · Build 40',
        },
      ]}
    />
  );
}
