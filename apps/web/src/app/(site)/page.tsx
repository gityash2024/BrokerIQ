import { BrokerIQLanding } from '@brokeriq/landing';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'BrokerIQ — Your broker workspace',
  description: 'Inventory, client requirements, WhatsApp capture and daily follow-ups for Gurgaon real estate brokers.',
};
export default function Home() {
  return (
    <BrokerIQLanding
      apkUrl={process.env.ANDROID_RELEASE_URL}
      checksum={process.env.ANDROID_RELEASE_SHA256}
      screenshots={[
        { src: '/product/android-area-map.png', label: 'Android · Gurugram Area Directory with clustered source locations. Colony points are approximate.' },
        {
          src: '/product/android-area-list.png',
          label: 'Android · Searchable public source records. Registration does not confirm a unit’s current availability.',
        },
      ]}
    />
  );
}
