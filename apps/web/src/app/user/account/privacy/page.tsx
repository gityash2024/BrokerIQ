'use client';
import { PageHeader } from '@/components/panel/shell';
import { PrivacySettings } from '@/components/privacy/privacy';

export default function Page() {
  return (
    <>
      <PageHeader title="Privacy & data sharing" subtitle="Location / contacts — पूरी तरह आपकी मर्ज़ी, कभी भी बदलें" />
      <PrivacySettings />
    </>
  );
}
