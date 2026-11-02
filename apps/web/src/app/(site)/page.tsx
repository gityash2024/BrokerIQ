import { getConfig } from '@/lib/server';
import { getRelease } from '@/lib/release';
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
  const release = await getRelease();

  return (
    <BrokerIQLanding
      contact={{ email: config?.app.supportEmail, phone: config?.app.supportPhone, address: config?.app.officeAddress }}
      apkUrl={release?.android.url}
      checksum={release?.android.sha256}
      builds={
        release
          ? {
              user: `Build v${release.portals.version} · ${release.portals.commit.slice(0, 7)}`,
              broker: `Build v${release.portals.version} · ${release.portals.commit.slice(0, 7)}`,
              android: `Build ${release.android.versionCode} (v${release.android.version})`,
            }
          : undefined
      }
      releaseUpdates={release ? { user: release.portals.publishedAt, broker: release.portals.publishedAt, android: release.android.publishedAt } : undefined}
      screenshots={
        release?.screenshots.map((screenshot) => ({
          src: screenshot.src,
          label: `${screenshot.description} · Android Build ${screenshot.versionCode}`,
          caption: `${screenshot.description} · Captured Build ${screenshot.versionCode}`,
        })) || []
      }
    />
  );
}
