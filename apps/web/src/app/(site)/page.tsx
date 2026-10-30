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
      apkUrl={process.env.ANDROID_RELEASE_URL || '/downloads/BrokerIQ-v2.1.3-build28.apk'}
      checksum={process.env.ANDROID_RELEASE_SHA256 || '32a76e321e3ace7ad97e3ec9424f791547ef184217dec5e7ca30021e8b4d05e4'}
      releaseUpdates={{
        user: '2026-10-30T06:47:41Z',
        broker: '2026-10-30T06:47:41Z',
        android: '2026-10-30T06:47:41Z',
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
